/**
 * POST /api/products/enrich-stream — Real-time AI research via SSE.
 *
 * Emits user-facing research events (not internal debug logs).
 * The frontend renders these directly as a research timeline.
 */

import { getCurrentUser } from '@/lib/auth';
import { fetchProductPage } from '@/lib/products/fetch';
import { extractMetadata } from '@/lib/products/metadata';
import { getProviderManager } from '@/lib/providers';
import { EnrichmentService, type EnrichmentInput } from '@/lib/services/enrichment';

interface ResearchEvent {
  type: 'activity' | 'discovery' | 'stat' | 'source' | 'complete' | 'error';
  message: string;
  icon?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let body: { product?: EnrichmentInput };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  if (!body.product?.title)
    return new Response(JSON.stringify({ error: 'Product title required' }), { status: 400 });

  const input = body.product;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      const elapsed = () => parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

      const emit = (event: ResearchEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Stats accumulator
      const stats = {
        specs: 0,
        images: 0,
        sellers: 0,
        sources: 0,
        fields: 0,
        identifiers: 0,
        prices: 0,
      };

      try {
        // ─── Research Phase: Product Page ───
        if (input.url) {
          const hostname = new URL(input.url).hostname.replace('www.', '');
          emit({
            type: 'activity',
            message: 'Researching official product information...',
            icon: '🧠',
            timestamp: elapsed(),
          });
          emit({
            type: 'source',
            message: hostname,
            icon: '🌐',
            timestamp: elapsed(),
            data: { url: input.url },
          });
          stats.sources++;

          try {
            const { html, finalUrl } = await fetchProductPage(input.url);
            const domain = new URL(finalUrl).hostname.replace('www.', '');

            const meta = extractMetadata(html, domain);
            emit({
              type: 'discovery',
              message: `Official product page located`,
              icon: '📄',
              timestamp: elapsed(),
            });

            if (meta.title) {
              emit({
                type: 'discovery',
                message: 'Product title verified',
                icon: '✓',
                timestamp: elapsed(),
              });
              stats.fields++;
            }
            if (meta.brand) {
              emit({
                type: 'discovery',
                message: `Manufacturer identified: ${meta.brand}`,
                icon: '🏭',
                timestamp: elapsed(),
              });
              stats.fields++;
              stats.identifiers++;
              if (!input.brand) input.brand = meta.brand;
            }
            if (meta.price) {
              emit({
                type: 'discovery',
                message: `Price found: $${meta.price}`,
                icon: '💰',
                timestamp: elapsed(),
              });
              stats.prices++;
              if (!input.currentPrice) input.currentPrice = meta.price;
            }
            if (meta.sku) {
              emit({
                type: 'discovery',
                message: `SKU identified: ${meta.sku}`,
                icon: '🏷️',
                timestamp: elapsed(),
              });
              stats.identifiers++;
              if (!input.sku) input.sku = meta.sku;
            }
            if (meta.gtin) {
              emit({
                type: 'discovery',
                message: 'UPC/EAN identified',
                icon: '📊',
                timestamp: elapsed(),
              });
              stats.identifiers++;
              if (!input.upc) input.upc = meta.gtin;
            }
            if (meta.image) {
              stats.images++;
              if (!input.image) input.image = meta.image;
            }
            if (meta.gallery && meta.gallery.length > 0) {
              stats.images += meta.gallery.length;
              emit({
                type: 'discovery',
                message: `${meta.gallery.length + 1} product images collected`,
                icon: '🖼️',
                timestamp: elapsed(),
              });
            }
            if (meta.inStock !== null) {
              emit({
                type: 'discovery',
                message: meta.inStock ? 'Product in stock' : 'Product out of stock',
                icon: meta.inStock ? '✅' : '⚠️',
                timestamp: elapsed(),
              });
            }

            emit({
              type: 'stat',
              message: 'Page research complete',
              icon: '📋',
              timestamp: elapsed(),
              data: { ...stats },
            });
          } catch {
            emit({
              type: 'discovery',
              message: 'Product page unavailable, continuing with AI',
              icon: '⚠️',
              timestamp: elapsed(),
            });
          }
        }

        // ─── AI Research Phase ───
        emit({
          type: 'activity',
          message: 'AI is analyzing collected information...',
          icon: '🤖',
          timestamp: elapsed(),
        });
        emit({ type: 'source', message: 'openrouter.ai', icon: '🤖', timestamp: elapsed() });
        stats.sources++;

        const providers = getProviderManager();
        const enrichment = new EnrichmentService(providers);

        emit({
          type: 'discovery',
          message: 'Sending research to AI...',
          icon: '📤',
          timestamp: elapsed(),
        });

        const result = await enrichment.enrichProduct(input, user.id);

        emit({
          type: 'discovery',
          message: 'AI analysis complete',
          icon: '✅',
          timestamp: elapsed(),
          data: { model: result.modelUsed },
        });

        // Report AI findings
        if (result.brand && !input.brand) {
          emit({
            type: 'discovery',
            message: `Brand identified: ${result.brand}`,
            icon: '🏷️',
            timestamp: elapsed(),
          });
          stats.fields++;
        }
        if (result.model) {
          emit({
            type: 'discovery',
            message: `Model verified: ${result.model}`,
            icon: '📋',
            timestamp: elapsed(),
          });
          stats.fields++;
        }
        if (result.category) {
          emit({
            type: 'discovery',
            message: `Category: ${result.category}`,
            icon: '📂',
            timestamp: elapsed(),
          });
          stats.fields++;
        }
        if (result.specifications && result.specifications.length > 0) {
          stats.specs = result.specifications.length;
          emit({
            type: 'discovery',
            message: `${result.specifications.length} technical specifications discovered`,
            icon: '⚙️',
            timestamp: elapsed(),
          });
        }
        if (result.sellers && result.sellers.length > 0) {
          stats.sellers = result.sellers.length;
          emit({
            type: 'discovery',
            message: `${result.sellers.length} retailers found`,
            icon: '🛒',
            timestamp: elapsed(),
          });
        }
        if (result.images && result.images.length > 0) {
          stats.images = Math.max(stats.images, result.images.length);
          emit({
            type: 'discovery',
            message: `${result.images.length} product images collected`,
            icon: '🖼️',
            timestamp: elapsed(),
          });
        }
        if (result.tags && result.tags.length > 0) {
          emit({
            type: 'discovery',
            message: `${result.tags.length} tags generated`,
            icon: '🏷️',
            timestamp: elapsed(),
          });
          stats.fields += result.tags.length;
        }
        if (result.pros && result.pros.length > 0) {
          emit({
            type: 'discovery',
            message: 'Pros & cons analyzed',
            icon: '⚖️',
            timestamp: elapsed(),
          });
        }
        if (result.description) {
          emit({
            type: 'discovery',
            message: 'Product description generated',
            icon: '📝',
            timestamp: elapsed(),
          });
          stats.fields++;
        }
        if (result.asin) {
          emit({ type: 'discovery', message: 'ASIN identified', icon: '📊', timestamp: elapsed() });
          stats.identifiers++;
        }
        if (result.mpn) {
          emit({ type: 'discovery', message: 'MPN identified', icon: '📊', timestamp: elapsed() });
          stats.identifiers++;
        }

        stats.fields += Object.values(result).filter((v) => v !== undefined && v !== null).length;

        // ─── Finalize ───
        emit({
          type: 'activity',
          message: 'Finalizing results...',
          icon: '✔️',
          timestamp: elapsed(),
        });
        emit({
          type: 'discovery',
          message: 'Product saved successfully',
          icon: '💾',
          timestamp: elapsed(),
        });

        emit({
          type: 'complete',
          message: 'Product successfully researched',
          icon: '✅',
          timestamp: elapsed(),
          data: {
            success: true,
            duration: elapsed(),
            model: result.modelUsed,
            provider: 'OpenRouter',
            specs: stats.specs,
            images: stats.images,
            sellers: stats.sellers,
            sources: stats.sources,
            fields: stats.fields,
            identifiers: stats.identifiers,
            prices: stats.prices,
            result,
          },
        });
      } catch (error) {
        emit({
          type: 'error',
          message: error instanceof Error ? error.message : 'Research failed',
          icon: '❌',
          timestamp: elapsed(),
        });
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
