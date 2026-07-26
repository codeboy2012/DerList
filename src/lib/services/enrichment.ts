/**
 * AI Product Enrichment Service
 *
 * Takes an already-identified product and makes it as complete as possible
 * using AI. Fills missing fields: specs, descriptions, sellers, images,
 * identifiers (SKU, UPC, ASIN, MPN), categories, tags.
 *
 * Rules:
 * - Never overwrites user-edited fields
 * - Never overwrites manually-locked pricing
 * - Returns structured JSON only
 * - Category-aware spec generation
 * - Automatic model failover via ProviderManager
 */

import type { ProviderManager } from '@/lib/providers';
import type { AIProvider, Message } from '@/lib/providers/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichmentInput {
  title: string;
  brand?: string;
  category?: string;
  description?: string;
  url?: string;
  retailer?: string;
  currentPrice?: number;
  originalPrice?: number;
  image?: string;
  sku?: string;
  asin?: string;
  upc?: string;
  mpn?: string;
}

export interface EnrichmentResult {
  // Product identity
  title?: string;
  brand?: string;
  model?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  tags?: string[];
  // Identifiers
  sku?: string;
  upc?: string;
  asin?: string;
  mpn?: string;
  // Pricing
  msrp?: number;
  currentPrice?: number;
  // Images
  images?: string[];
  // Sellers
  sellers?: EnrichmentSeller[];
  // Specifications (category-aware)
  specifications?: EnrichmentSpec[];
  // AI metadata
  confidence: number;
  reasoning?: string;
  suggestedTitle?: string;
  suggestedCategory?: string;
  // Provider info
  modelUsed?: string;
  providerSwitched?: boolean;
  switchReason?: string;
}

export interface EnrichmentSeller {
  name: string;
  url?: string;
  price?: number;
  shipping?: string;
  availability?: string;
}

export interface EnrichmentSpec {
  key: string;
  value: string;
  unit?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category-aware specification templates
// ─────────────────────────────────────────────────────────────────────────────

const SPEC_TEMPLATES: Record<string, string[]> = {
  gpu: ['VRAM', 'Boost Clock', 'Power Draw', 'Outputs', 'Length', 'Bus Width', 'Architecture'],
  motherboard: [
    'Socket',
    'Chipset',
    'Memory Type',
    'Max Memory',
    'PCIe Slots',
    'M.2 Slots',
    'WiFi',
    'Bluetooth',
    'USB Ports',
    'Ethernet',
    'Form Factor',
  ],
  cpu: [
    'Cores',
    'Threads',
    'Base Clock',
    'Boost Clock',
    'TDP',
    'Socket',
    'Architecture',
    'Cache',
    'Integrated Graphics',
  ],
  ram: ['Capacity', 'Speed', 'Type', 'CAS Latency', 'Voltage', 'Form Factor', 'Modules'],
  ssd: [
    'Capacity',
    'Interface',
    'Read Speed',
    'Write Speed',
    'Form Factor',
    'NAND Type',
    'Endurance',
  ],
  monitor: [
    'Size',
    'Resolution',
    'Refresh Rate',
    'Panel Type',
    'Response Time',
    'HDR',
    'Ports',
    'Adaptive Sync',
  ],
  keyboard: ['Switch Type', 'Layout', 'Connectivity', 'Backlight', 'Key Count', 'Polling Rate'],
  mouse: ['Sensor', 'DPI', 'Polling Rate', 'Weight', 'Connectivity', 'Buttons', 'Battery Life'],
  headphones: [
    'Driver Size',
    'Frequency Response',
    'Impedance',
    'Connectivity',
    'Battery Life',
    'Noise Canceling',
    'Microphone',
  ],
  phone: [
    'Display',
    'Storage',
    'RAM',
    'Battery',
    'Camera',
    'CPU',
    'OS',
    'Weight',
    'Dimensions',
    '5G',
  ],
  laptop: ['CPU', 'RAM', 'Storage', 'Display', 'GPU', 'Battery', 'Weight', 'OS', 'Ports'],
  tablet: [
    'Display',
    'Storage',
    'RAM',
    'Battery',
    'CPU',
    'OS',
    'Weight',
    'Camera',
    'Stylus Support',
  ],
  smartwatch: [
    'Display',
    'Battery Life',
    'Water Resistance',
    'Sensors',
    'Connectivity',
    'OS',
    'Storage',
  ],
  camera: [
    'Sensor',
    'Megapixels',
    'ISO Range',
    'Video',
    'Lens Mount',
    'Stabilization',
    'Battery',
    'Weight',
  ],
  speaker: [
    'Driver Size',
    'Power Output',
    'Frequency Range',
    'Connectivity',
    'Battery Life',
    'Water Resistance',
  ],
  case: [
    'Form Factor',
    'Material',
    'Max GPU Length',
    'Max CPU Cooler Height',
    'Drive Bays',
    'Fan Slots',
    'Radiator Support',
  ],
  psu: ['Wattage', 'Efficiency Rating', 'Modularity', 'Fan Size', 'Connectors', 'Form Factor'],
  cooler: ['Type', 'Fan Size', 'TDP Support', 'Height', 'Noise Level', 'Socket Compatibility'],
  default: ['Dimensions', 'Weight', 'Color', 'Material', 'Warranty'],
};

function getSpecTemplate(category: string, title: string): string[] {
  const lower = (category + ' ' + title).toLowerCase();

  if (
    lower.includes('gpu') ||
    lower.includes('graphics card') ||
    lower.includes('rtx') ||
    lower.includes('radeon')
  )
    return SPEC_TEMPLATES.gpu;
  if (lower.includes('motherboard') || lower.includes('mobo')) return SPEC_TEMPLATES.motherboard;
  if (
    lower.includes('cpu') ||
    lower.includes('processor') ||
    lower.includes('ryzen') ||
    lower.includes('core i')
  )
    return SPEC_TEMPLATES.cpu;
  if (lower.includes('ram') || lower.includes('memory') || lower.includes('ddr'))
    return SPEC_TEMPLATES.ram;
  if (
    lower.includes('ssd') ||
    lower.includes('nvme') ||
    lower.includes('storage') ||
    lower.includes('hard drive')
  )
    return SPEC_TEMPLATES.ssd;
  if (lower.includes('monitor') || lower.includes('display')) return SPEC_TEMPLATES.monitor;
  if (lower.includes('keyboard')) return SPEC_TEMPLATES.keyboard;
  if (lower.includes('mouse') || lower.includes('mice')) return SPEC_TEMPLATES.mouse;
  if (lower.includes('headphone') || lower.includes('earbuds') || lower.includes('airpods'))
    return SPEC_TEMPLATES.headphones;
  if (
    lower.includes('phone') ||
    lower.includes('iphone') ||
    lower.includes('galaxy') ||
    lower.includes('pixel')
  )
    return SPEC_TEMPLATES.phone;
  if (lower.includes('laptop') || lower.includes('macbook') || lower.includes('notebook'))
    return SPEC_TEMPLATES.laptop;
  if (lower.includes('tablet') || lower.includes('ipad')) return SPEC_TEMPLATES.tablet;
  if (lower.includes('watch') || lower.includes('apple watch')) return SPEC_TEMPLATES.smartwatch;
  if (lower.includes('camera') || lower.includes('dslr') || lower.includes('mirrorless'))
    return SPEC_TEMPLATES.camera;
  if (lower.includes('speaker') || lower.includes('soundbar')) return SPEC_TEMPLATES.speaker;
  if (lower.includes('case') || lower.includes('chassis') || lower.includes('enclosure'))
    return SPEC_TEMPLATES.case;
  if (lower.includes('psu') || lower.includes('power supply')) return SPEC_TEMPLATES.psu;
  if (lower.includes('cooler') || lower.includes('aio') || lower.includes('heatsink'))
    return SPEC_TEMPLATES.cooler;

  return SPEC_TEMPLATES.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildEnrichmentPrompt(input: EnrichmentInput): Message[] {
  const specFields = getSpecTemplate(input.category || '', input.title);

  const existingFields: string[] = [];
  if (input.brand) existingFields.push(`Brand: ${input.brand}`);
  if (input.category) existingFields.push(`Category: ${input.category}`);
  if (input.description) existingFields.push(`Description: ${input.description}`);
  if (input.currentPrice) existingFields.push(`Price: $${input.currentPrice}`);
  if (input.retailer) existingFields.push(`Retailer: ${input.retailer}`);
  if (input.sku) existingFields.push(`SKU: ${input.sku}`);
  if (input.asin) existingFields.push(`ASIN: ${input.asin}`);
  if (input.upc) existingFields.push(`UPC: ${input.upc}`);
  if (input.mpn) existingFields.push(`MPN: ${input.mpn}`);

  const systemPrompt = `You are a product data enrichment assistant for a shopping wishlist application.

Your job: Given a product name and any existing information, fill in ALL missing fields with accurate data.

RULES:
- Return ONLY a JSON object. No markdown, no explanation outside JSON.
- Only return fields you are confident about (>70% confidence).
- Never invent prices. Only include prices you know from real sources.
- For specifications, use the exact field names provided.
- For sellers, only include real retailers that actually carry this product.
- URLs must be plausible (you can construct them from known URL patterns).
- If you cannot determine a field, omit it entirely.

SPECIFICATIONS to fill (category-specific):
${specFields.map((s) => `- ${s}`).join('\n')}

Return this JSON structure:
{
  "title": "Best/official product name",
  "brand": "Brand name",
  "model": "Model number/name",
  "category": "Product category",
  "subCategory": "Subcategory",
  "description": "2-3 sentence product description",
  "tags": ["tag1", "tag2", "tag3"],
  "sku": "SKU if known",
  "upc": "UPC if known",
  "asin": "ASIN if known",
  "mpn": "MPN if known",
  "msrp": 0.00,
  "images": ["url1", "url2"],
  "sellers": [
    {"name": "Amazon", "url": "...", "price": 0.00, "shipping": "Free", "availability": "In Stock"},
    {"name": "Best Buy", "url": "...", "price": 0.00, "shipping": "Free", "availability": "In Stock"}
  ],
  "specifications": [
    {"key": "VRAM", "value": "16", "unit": "GB"},
    {"key": "Boost Clock", "value": "2550", "unit": "MHz"}
  ],
  "confidence": 85,
  "reasoning": "Brief explanation of data sources",
  "suggestedTitle": "Better title if current one is incomplete",
  "suggestedCategory": "Better category if applicable"
}`;

  const userContent = [
    `Product: ${input.title}`,
    existingFields.length > 0 ? `\nKnown information:\n${existingFields.join('\n')}` : '',
    input.url ? `\nURL: ${input.url}` : '',
    '\nFill in everything missing. Return JSON only.',
  ]
    .filter(Boolean)
    .join('');

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userContent },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Failover with temporary failure memory
// ─────────────────────────────────────────────────────────────────────────────

/** Track provider failures to avoid retrying immediately */
const failureMemory = new Map<string, { failedAt: number; reason: string }>();
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isProviderCoolingDown(providerId: string): boolean {
  const failure = failureMemory.get(providerId);
  if (!failure) return false;
  if (Date.now() - failure.failedAt > FAILURE_COOLDOWN_MS) {
    failureMemory.delete(providerId);
    return false;
  }
  return true;
}

function recordFailure(providerId: string, reason: string): void {
  failureMemory.set(providerId, { failedAt: Date.now(), reason });
}

function classifyError(
  message: string
): 'rate_limit' | 'quota' | 'timeout' | 'unavailable' | 'unknown' {
  const lower = message.toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('rate_limit'))
    return 'rate_limit';
  if (
    lower.includes('quota') ||
    lower.includes('usage limit') ||
    lower.includes('billing') ||
    lower.includes('insufficient')
  )
    return 'quota';
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout'))
    return 'timeout';
  if (
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable')
  )
    return 'unavailable';
  return 'unknown';
}

/** Execute with smart failover: skips cooling-down providers, records failures */
async function withSmartFailover(
  providers: AIProvider[],
  operation: (provider: AIProvider) => Promise<EnrichmentResult>
): Promise<EnrichmentResult & { providerSwitched?: boolean; switchReason?: string }> {
  const available = providers.filter((p) => !isProviderCoolingDown(p.id));

  if (available.length === 0) {
    // All providers cooling down — try the one that failed longest ago
    const oldest = [...failureMemory.entries()].sort((a, b) => a[1].failedAt - b[1].failedAt);
    if (oldest.length > 0) {
      failureMemory.delete(oldest[0][0]);
      const fallback = providers.find((p) => p.id === oldest[0][0]);
      if (fallback) available.push(fallback);
    }
    if (available.length === 0) {
      throw new Error(
        'All AI providers are temporarily unavailable. Please try again in a few minutes.'
      );
    }
  }

  let lastError: Error | null = null;
  let switched = false;
  let switchReason = '';

  for (let i = 0; i < available.length; i++) {
    const provider = available[i];
    try {
      const result = await operation(provider);
      result.modelUsed = provider.name;
      if (switched) {
        result.providerSwitched = true;
        result.switchReason = switchReason;
      }
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const errorType = classifyError(msg);

      // Record failure for non-transient errors
      if (errorType !== 'unknown') {
        recordFailure(provider.id, msg);
      }

      lastError = error instanceof Error ? error : new Error(msg);
      switched = true;
      switchReason = `${provider.name}: ${errorType}`;
    }
  }

  throw lastError ?? new Error('All AI providers failed.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment Service
// ─────────────────────────────────────────────────────────────────────────────

export class EnrichmentService {
  constructor(private readonly providers: ProviderManager) {}

  /**
   * Enrich a single product with AI.
   * Uses smart failover across all configured AI providers.
   */
  async enrichProduct(input: EnrichmentInput, userId: string): Promise<EnrichmentResult> {
    const aiProviders = await this.providers.getAIProviders(userId);

    if (aiProviders.length === 0) {
      return { confidence: 0, reasoning: 'No AI provider configured.' };
    }

    const messages = buildEnrichmentPrompt(input);

    return withSmartFailover(aiProviders, async (provider) => {
      const response = await provider.chat(messages, {
        maxTokens: 2000,
        temperature: 0.2,
        json: true,
      });

      return this.parseEnrichmentResponse(response.content, provider.name);
    });
  }

  /**
   * Enrich multiple products concurrently with rate limiting.
   * Max 3 concurrent enrichments to avoid API abuse.
   */
  async enrichBatch(
    inputs: EnrichmentInput[],
    userId: string,
    options?: { concurrency?: number; onProgress?: (completed: number, total: number) => void }
  ): Promise<EnrichmentResult[]> {
    const concurrency = options?.concurrency ?? 3;
    const results: EnrichmentResult[] = new Array(inputs.length);
    let completed = 0;

    // Process in chunks
    for (let i = 0; i < inputs.length; i += concurrency) {
      const chunk = inputs.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map((input) => this.enrichProduct(input, userId))
      );

      chunkResults.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          results[i + j] = result.value;
        } else {
          results[i + j] = {
            confidence: 0,
            reasoning: `Enrichment failed: ${result.reason?.message || 'Unknown error'}`,
          };
        }
        completed++;
        options?.onProgress?.(completed, inputs.length);
      });

      // Brief pause between chunks to avoid rate limiting
      if (i + concurrency < inputs.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Smart merge: apply enrichment to existing data without overwriting user edits.
   * Only fills empty/missing fields.
   */
  smartMerge(
    existing: Record<string, unknown>,
    enrichment: EnrichmentResult,
    options?: { priceLocked?: boolean }
  ): Record<string, unknown> {
    const merged = { ...existing };

    // Only fill fields that are currently empty
    const fillIfEmpty = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === '') return;
      const current = merged[key];
      if (current === undefined || current === null || current === '') {
        merged[key] = value;
      }
    };

    fillIfEmpty('brand', enrichment.brand);
    fillIfEmpty('model', enrichment.model);
    fillIfEmpty('category', enrichment.category);
    fillIfEmpty('subCategory', enrichment.subCategory);
    fillIfEmpty('description', enrichment.description);
    fillIfEmpty('sku', enrichment.sku);
    fillIfEmpty('upc', enrichment.upc);
    fillIfEmpty('asin', enrichment.asin);
    fillIfEmpty('mpn', enrichment.mpn);

    // Tags: append new ones
    if (enrichment.tags && enrichment.tags.length > 0) {
      const existingTags = (merged.tags as string) || '';
      const existing_arr = existingTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const newTags = enrichment.tags.filter((t) => !existing_arr.includes(t.toLowerCase()));
      if (newTags.length > 0) {
        merged.tags = existingTags ? `${existingTags}, ${newTags.join(', ')}` : newTags.join(', ');
      }
    }

    // Pricing: only if not locked
    if (!options?.priceLocked) {
      fillIfEmpty('currentPrice', enrichment.currentPrice?.toString());
      fillIfEmpty('originalPrice', enrichment.msrp?.toString());
    }

    // Images: append new ones
    if (enrichment.images && enrichment.images.length > 0) {
      const existingImages = (merged.images as string[]) || [];
      const newImages = enrichment.images.filter((img) => !existingImages.includes(img));
      if (newImages.length > 0) {
        merged.images = [...existingImages, ...newImages];
      }
    }

    // Sellers: append new ones (by name)
    if (enrichment.sellers && enrichment.sellers.length > 0) {
      const existingSellers = (merged.sellers as EnrichmentSeller[]) || [];
      const existingNames = new Set(existingSellers.map((s) => s.name.toLowerCase()));
      const newSellers = enrichment.sellers.filter((s) => !existingNames.has(s.name.toLowerCase()));
      if (newSellers.length > 0) {
        merged.sellers = [...existingSellers, ...newSellers];
      }
    }

    // Specifications: append new ones (by key)
    if (enrichment.specifications && enrichment.specifications.length > 0) {
      const existingSpecs = (merged.specs as EnrichmentSpec[]) || [];
      const existingKeys = new Set(existingSpecs.map((s) => s.key.toLowerCase()));
      const newSpecs = enrichment.specifications.filter(
        (s) => !existingKeys.has(s.key.toLowerCase())
      );
      if (newSpecs.length > 0) {
        merged.specs = [
          ...existingSpecs,
          ...newSpecs.map((s) => ({ id: String(Date.now() + Math.random()), ...s })),
        ];
      }
    }

    // AI metadata
    merged.aiConfidence = String(enrichment.confidence);
    if (enrichment.suggestedTitle) merged.aiSuggestedName = enrichment.suggestedTitle;
    if (enrichment.suggestedCategory) merged.aiSuggestedCategory = enrichment.suggestedCategory;
    if (enrichment.tags) merged.aiTags = enrichment.tags.join(', ');
    if (enrichment.reasoning) merged.aiReasoning = enrichment.reasoning;

    return merged;
  }

  // ─── Private ───

  private parseEnrichmentResponse(content: string, modelName: string): EnrichmentResult {
    try {
      // Try to extract JSON from potential markdown fences
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      return {
        title: parsed.title || undefined,
        brand: parsed.brand || undefined,
        model: parsed.model || undefined,
        category: parsed.category || undefined,
        subCategory: parsed.subCategory || parsed.subcategory || undefined,
        description: parsed.description || undefined,
        tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
        sku: parsed.sku || undefined,
        upc: parsed.upc || undefined,
        asin: parsed.asin || undefined,
        mpn: parsed.mpn || undefined,
        msrp: typeof parsed.msrp === 'number' && parsed.msrp > 0 ? parsed.msrp : undefined,
        currentPrice:
          typeof parsed.currentPrice === 'number' && parsed.currentPrice > 0
            ? parsed.currentPrice
            : undefined,
        images: Array.isArray(parsed.images)
          ? parsed.images.filter((u: unknown) => typeof u === 'string' && u.startsWith('http'))
          : undefined,
        sellers: Array.isArray(parsed.sellers)
          ? parsed.sellers
              .map((s: Record<string, unknown>) => ({
                name: String(s.name || ''),
                url: String(s.url || ''),
                price: typeof s.price === 'number' ? s.price : undefined,
                shipping: String(s.shipping || ''),
                availability: String(s.availability || 'Unknown'),
              }))
              .filter((s: EnrichmentSeller) => s.name)
          : undefined,
        specifications: Array.isArray(parsed.specifications)
          ? parsed.specifications
              .map((s: Record<string, unknown>) => ({
                key: String(s.key || ''),
                value: String(s.value || ''),
                unit: String(s.unit || ''),
              }))
              .filter((s: EnrichmentSpec) => s.key && s.value)
          : undefined,
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.min(100, Math.max(0, parsed.confidence))
            : 50,
        reasoning: parsed.reasoning || undefined,
        suggestedTitle: parsed.suggestedTitle || undefined,
        suggestedCategory: parsed.suggestedCategory || undefined,
        modelUsed: modelName,
      };
    } catch {
      return {
        confidence: 0,
        reasoning: 'Failed to parse AI response.',
        modelUsed: modelName,
      };
    }
  }
}
