/**
 * POST /api/products/enrich-stream
 *
 * Streaming enrichment endpoint using Server-Sent Events.
 * Emits real progress events as each stage completes.
 * The client receives live updates of what the backend is actually doing.
 */

import { getCurrentUser } from '@/lib/auth';
import { fetchProductPage } from '@/lib/products/fetch';
import { extractMetadata } from '@/lib/products/metadata';
import { getProviderManager } from '@/lib/providers';
import { EnrichmentService, type EnrichmentInput } from '@/lib/services/enrichment';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { product?: EnrichmentInput };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!body.product?.title) {
    return new Response(JSON.stringify({ error: 'Product title required' }), { status: 400 });
  }

  const input = body.product;

  // Create a readable stream that emits SSE events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (
        stage: string,
        message: string,
        percent: number,
        data?: Record<string, unknown>
      ) => {
        const event = JSON.stringify({ stage, message, percent, ...data });
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      };

      const startTime = Date.now();

      try {
        // ─── Stage 1: Fetch product page (if URL provided) ───
        let pageMetadata: ReturnType<typeof extractMetadata> | null = null;

        if (input.url) {
          emit('fetch_page', `Downloading ${new URL(input.url).hostname}...`, 5);
          try {
            const { html, finalUrl } = await fetchProductPage(input.url);
            const domain = new URL(finalUrl).hostname.replace('www.', '');
            emit('parse_html', `Parsing ${domain} page...`, 12);

            pageMetadata = extractMetadata(html, domain);
            emit('extract_metadata', 'Reading structured product data...', 20);

            // Fill input from page metadata
            if (pageMetadata.title && !input.title) input.title = pageMetadata.title;
            if (pageMetadata.brand && !input.brand) input.brand = pageMetadata.brand;
            if (pageMetadata.price && !input.currentPrice) input.currentPrice = pageMetadata.price;
            if (pageMetadata.image && !input.image) input.image = pageMetadata.image;
            if (pageMetadata.sku && !input.sku) input.sku = pageMetadata.sku;

            emit('page_complete', `Extracted data from ${domain}`, 25);
          } catch {
            emit('fetch_failed', 'Product page unavailable, continuing with AI...', 15);
          }
        } else {
          emit('no_url', 'No URL provided, using AI research only...', 10);
        }

        // ─── Stage 2: Prepare AI request ───
        emit('prepare_ai', 'Preparing AI research request...', 30);

        const providers = getProviderManager();
        const enrichment = new EnrichmentService(providers);

        emit('connect_provider', 'Connecting to AI provider...', 35);

        // ─── Stage 3: Call AI ───
        emit('call_ai', 'Sending product to AI for research...', 40);
        emit('waiting_ai', 'Waiting for AI response...', 45);

        const result = await enrichment.enrichProduct(input, user.id);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        emit('receive_ai', `AI response received (${elapsed}s)`, 70, { model: result.modelUsed });

        // ─── Stage 4: Validate ───
        emit('validate', 'Validating AI results...', 78);

        // ─── Stage 5: Build result ───
        emit('build', 'Building product object...', 85);

        const summary = {
          specifications: result.specifications?.length ?? 0,
          images: result.images?.length ?? 0,
          sellers: result.sellers?.length ?? 0,
          tags: result.tags?.length ?? 0,
          fields: Object.values(result).filter((v) => v !== undefined && v !== null).length,
        };

        emit(
          'summary',
          `Found ${summary.specifications} specs, ${summary.images} images, ${summary.sellers} sellers`,
          92,
          summary
        );

        // ─── Stage 6: Complete ───
        emit('complete', 'Research complete', 100, {
          success: true,
          duration: parseFloat(elapsed),
          model: result.modelUsed,
          provider: 'OpenRouter',
          ...summary,
          result,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Enrichment failed';
        emit('error', msg, -1, { success: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
