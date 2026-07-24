## Architecture

The Product Intelligence Engine enhances DerList's existing product import system (`src/lib/products/`) and background job system (`src/lib/jobs/`) with a modular, multi-strategy extraction pipeline. It does NOT replace the existing architecture — it extends it.

### Current Architecture (Preserved)

```
src/lib/products/
├── index.ts          # importProductFromUrl() — main entry point
├── fetch.ts          # fetchProductPage() — HTTP fetch with User-Agent
├── metadata.ts       # extractMetadata() — JSON-LD, OG, Twitter, HTML
├── normalize.ts      # normalizeUrl(), extractDomain(), getRetailerName()
└── price.ts          # extractBestPrice() — confidence-based candidates

src/lib/jobs/
├── index.ts          # barrel exports
├── queue.ts          # enqueueProductRefresh(), claimJobs(), etc.
├── scheduler.ts      # scheduleProductRefreshes()
├── worker.ts         # processJobs(), drainQueue()
└── product-sync.ts   # syncProduct() — fetch + compare + history
```

### New Architecture (Extensions)

```
src/lib/products/
├── index.ts                    # Enhanced: orchestrates extraction pipeline
├── fetch.ts                    # Enhanced: retry logic, browser fallback trigger
├── metadata.ts                 # Enhanced: accepts domain, uses price engine
├── normalize.ts                # Unchanged
├── price.ts                    # Enhanced: consensus voting across all sources
│
├── engine/
│   ├── pipeline.ts             # NEW: orchestrates parallel extraction
│   ├── types.ts                # NEW: shared interfaces (ExtractionResult, etc.)
│   └── consensus.ts            # NEW: merge + vote across extractor results
│
├── parsers/
│   ├── index.ts                # NEW: parser registry + domain→parser mapping
│   ├── types.ts                # NEW: RetailerParser interface
│   ├── amazon.ts               # NEW: Amazon-specific extraction
│   ├── bestbuy.ts              # NEW: Best Buy extraction
│   ├── newegg.ts               # NEW: Newegg extraction
│   ├── walmart.ts              # NEW: Walmart extraction
│   ├── target.ts               # NEW: Target extraction
│   ├── apple.ts                # NEW: Apple extraction
│   ├── bh-photo.ts             # NEW: B&H Photo extraction
│   ├── microcenter.ts          # NEW: Micro Center extraction
│   ├── ebay.ts                 # NEW: eBay extraction
│   └── steam.ts                # NEW: Steam extraction
│
├── extractors/
│   ├── index.ts                # NEW: barrel export
│   ├── json-ld.ts              # NEW: dedicated JSON-LD extractor
│   ├── opengraph.ts            # NEW: dedicated OG extractor
│   ├── html-heuristic.ts       # NEW: generic HTML price/image/title
│   └── microdata.ts            # NEW: itemprop-based extraction
│
├── browser/
│   ├── index.ts                # NEW: browser pool manager (Playwright)
│   ├── render.ts               # NEW: renderPage() with stealth
│   └── domains.ts              # NEW: list of JS-requiring domains
│
└── ai/
    ├── index.ts                # NEW: AI verification orchestrator
    ├── providers.ts            # NEW: Gemini/OpenAI/Anthropic/Ollama adapters
    └── prompts.ts              # NEW: extraction + verification prompts
```

## Components

### Component 1: Extraction Pipeline (`engine/pipeline.ts`)

**Purpose:** Orchestrates all extraction strategies in parallel and produces a single high-confidence result.

**Integration with existing code:**
- Called by `importProductFromUrl()` in `index.ts` (replaces the current `extractMetadata()` call)
- Also called by `syncProduct()` in `src/lib/jobs/product-sync.ts` during background refresh

**Interface:**
```typescript
interface PipelineInput {
  html: string;
  url: string;
  domain: string | null;
  existingProduct?: { id: string; currentPrice: number | null };
}

interface PipelineResult {
  title: string | null;
  description: string | null;
  image: string | null;
  gallery: string[];
  price: number | null;
  currency: string | null;
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  inStock: boolean | null;
  availability: string | null;
  retailer: string | null;
  confidence: number;        // 0-100 overall confidence
  priceSource: string;       // which extractor won the price vote
  needsReview: boolean;      // true if confidence < 60
}

async function runExtractionPipeline(input: PipelineInput): Promise<PipelineResult>;
```

**Behavior:**
1. Detect retailer from domain → select parser
2. Run extractors in parallel: [JSON-LD, OpenGraph, Microdata, Site-Specific Parser, HTML Heuristic]
3. Collect all results
4. Run consensus voting on prices
5. Merge non-price fields (title, image, brand) taking highest-confidence sources
6. If confidence < 70% and AI is configured → invoke AI verification
7. Return merged result with confidence score

### Component 2: Retailer Parser Registry (`parsers/index.ts`)

**Purpose:** Maps domains to specialized parsers and provides a standardized interface.

**Interface:**
```typescript
interface RetailerParser {
  name: string;
  domains: string[];  // e.g. ['amazon.com', 'amazon.co.uk', 'amazon.de']
  extract(html: string, url: string): ExtractionResult;
}

interface ExtractionResult {
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  brand: string | null;
  sku: string | null;
  availability: string | null;
  inStock: boolean | null;
  confidence: number;  // 0-100
}

function getParserForDomain(domain: string): RetailerParser | null;
function getAllParsers(): RetailerParser[];
```

**Design decisions:**
- Each parser is a pure function (no side effects, no I/O)
- Parsers only work with the HTML string — no network access
- Parsers use string regex (not cheerio/DOM parsing) to stay lightweight and avoid new dependencies
- Each parser assigns its own confidence score based on how much data it could extract

### Component 3: Consensus Engine (`engine/consensus.ts`)

**Purpose:** Merges results from multiple extractors using confidence-weighted voting.

**Interface:**
```typescript
interface VotableResult {
  price: number | null;
  currency: string | null;
  title: string | null;
  image: string | null;
  brand: string | null;
  confidence: number;
  source: string;
}

interface ConsensusResult {
  price: number | null;
  currency: string | null;
  title: string | null;
  image: string | null;
  brand: string | null;
  overallConfidence: number;
  priceSource: string;
  agreement: number;  // 0-1, how much extractors agree
}

function buildConsensus(results: VotableResult[]): ConsensusResult;
```

**Voting algorithm:**
1. Group prices that are within 5% of each other
2. The largest group wins (most extractors agree)
3. Within the winning group, pick the highest-confidence candidate
4. If no group has majority, flag `needsReview = true`
5. For non-price fields (title, image, brand): take from highest-confidence extractor

### Component 4: Browser Rendering (`browser/index.ts`)

**Purpose:** Provides headless browser rendering for JS-heavy sites.

**Design decisions:**
- Uses Playwright (not Puppeteer) — better API, first-party stealth
- Playwright is an OPTIONAL dependency — imported dynamically
- If not installed, the system logs a warning and skips browser rendering
- Browser is only invoked when: (a) HTTP fetch got no price, (b) 403/429 detected, (c) domain is in the JS-required list

**Interface:**
```typescript
interface BrowserRenderResult {
  html: string;
  finalUrl: string;
}

async function renderWithBrowser(url: string): Promise<BrowserRenderResult | null>;
function isBrowserAvailable(): boolean;
```

**Integration:**
- `importProductFromUrl()` calls the pipeline
- If pipeline returns `confidence < 40` AND `isBrowserAvailable()`:
  - Re-render page with browser
  - Re-run extraction pipeline on browser-rendered HTML
  - Use the better result

### Component 5: AI Verification (`ai/index.ts`)

**Purpose:** Optional AI layer for resolving conflicts and verifying low-confidence extractions.

**Design decisions:**
- Completely optional — no AI SDKs in `dependencies` (only in dynamic imports)
- Configured via env vars: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`
- Three operations: Extract, Verify, Arbitrate
- AI results participate in voting (they don't override)
- AI is invoked AFTER deterministic extraction, only when needed

**Interface:**
```typescript
interface AIVerificationInput {
  html: string;  // truncated to ~20k chars
  extractedPrice: number | null;
  candidates: PriceCandidate[];
  url: string;
}

interface AIVerificationResult {
  suggestedPrice: number | null;
  currency: string | null;
  confidence: number;
  reason: string;
}

async function verifyWithAI(input: AIVerificationInput): Promise<AIVerificationResult | null>;
function isAIConfigured(): boolean;
```

### Component 6: Enhanced Product Sync (`jobs/product-sync.ts`)

**Purpose:** Upgrade the existing sync to use the new extraction pipeline.

**Changes to existing file:**
- Replace `extractMetadata(html)` call with `runExtractionPipeline({ html, url, domain, existingProduct })`
- Use `existingProduct.currentPrice` for change detection (already exists)
- Add `confidence` to the sync result logging
- If confidence < 60%, mark the fetch job as needing review (new status or metadata flag)

## Data Flow

### Import Flow (User pastes a URL)

```
User pastes URL
      │
      ▼
importProductFromUrl()                    [src/lib/products/index.ts]
      │
      ├── normalizeUrl()                  [normalize.ts]
      ├── Check 5-min cache              [prisma query]
      ├── fetchProductPage()              [fetch.ts]
      │
      ▼
runExtractionPipeline()                   [engine/pipeline.ts]
      │
      ├── getParserForDomain()            [parsers/index.ts]
      ├── Promise.allSettled([
      │     extractJsonLd(html),          [extractors/json-ld.ts]
      │     extractOpenGraph(html),       [extractors/opengraph.ts]
      │     extractMicrodata(html),       [extractors/microdata.ts]
      │     parser.extract(html, url),    [parsers/amazon.ts etc.]
      │     extractHtmlHeuristic(html),   [extractors/html-heuristic.ts]
      │   ])
      │
      ├── buildConsensus(results)         [engine/consensus.ts]
      │
      ├── (if confidence < 70 && AI configured)
      │     verifyWithAI()                [ai/index.ts]
      │
      ├── (if confidence < 40 && browser available)
      │     renderWithBrowser() → re-run pipeline
      │
      ▼
Return PipelineResult
      │
      ▼
confirmImportAction()                     [product-actions.ts]
      │
      ├── Deduplication check             [canonical URL, SKU, GTIN, MPN]
      ├── Create/reuse Product            [prisma]
      ├── Record PriceHistory             [prisma]
      ├── Create WishlistItem             [prisma]
      └── enqueueProductRefresh()         [jobs/queue.ts]
```

### Background Refresh Flow (Scheduled)

```
scheduleProductRefreshes()                [jobs/scheduler.ts]
      │
      ▼
claimJobs() → worker picks up job        [jobs/queue.ts → worker.ts]
      │
      ▼
syncProduct(productId)                    [jobs/product-sync.ts]
      │
      ├── fetchProductPage()
      ├── runExtractionPipeline()         [engine/pipeline.ts]
      ├── Compare price/stock/title/image
      ├── Record PriceHistory             [always, even if unchanged]
      ├── Record ProductChange            [if price/stock/image/title changed]
      └── Update Product record           [prisma]
```

## Integration Points

| Existing Code | Change | Reason |
|---------------|--------|--------|
| `src/lib/products/index.ts` | Call `runExtractionPipeline()` instead of `extractMetadata()` | Use the new parallel pipeline |
| `src/lib/products/metadata.ts` | Keep as-is, used by individual extractors | Extractors reuse existing OG/Twitter/title helpers |
| `src/lib/products/price.ts` | Keep as fallback in `extractors/html-heuristic.ts` | The price engine becomes one extractor among many |
| `src/lib/jobs/product-sync.ts` | Use `runExtractionPipeline()` | Background refresh benefits from multi-strategy |
| `src/app/(app)/wishlists/[id]/product-actions.ts` | No change needed | Already calls `importProductFromUrl()` which gains the pipeline internally |
| `src/app/admin/products/actions.ts` | No change needed | Already calls `syncProduct()` which gains the pipeline internally |
| `prisma/schema.prisma` | No changes | Existing Product, PriceHistory, ProductFetchJob models are sufficient |

## Implementation Order (Tasks)

1. **Create shared types** (`engine/types.ts`) — ExtractionResult interface, RetailerParser interface
2. **Create parser registry** (`parsers/index.ts`, `parsers/types.ts`) — domain→parser mapping
3. **Create Amazon parser** (`parsers/amazon.ts`) — highest priority retailer
4. **Create extractors** (`extractors/*.ts`) — JSON-LD, OG, Microdata, HTML heuristic as separate modules
5. **Create consensus engine** (`engine/consensus.ts`) — price voting with 5% tolerance grouping
6. **Create extraction pipeline** (`engine/pipeline.ts`) — orchestrates all extractors
7. **Integrate pipeline** — update `index.ts` and `product-sync.ts` to use it
8. **Create remaining parsers** — Best Buy, Newegg, Walmart, Target, etc.
9. **Create browser module** (optional) — Playwright dynamic import, render function
10. **Create AI module** (optional) — provider adapters, verification prompts

## Performance Considerations

- Extractors run in parallel via `Promise.allSettled` (no sequential blocking)
- Browser rendering is a last resort (only when confidence < 40)
- AI is only invoked when needed (confidence < 70 with conflicts)
- 5-minute import cache prevents re-fetching the same URL
- Parsers are pure functions with no I/O (sub-millisecond execution)
- Background worker processes jobs with 1-second delay between items

## Testing Strategy

Each component can be tested independently:
- Parsers: pass sample HTML → verify extracted fields
- Extractors: pass sample HTML → verify confidence + values
- Consensus: pass multiple VotableResults → verify winner selection
- Pipeline: integration test with real HTML samples
- Browser: requires Playwright installed (skip in CI if unavailable)
- AI: mock the provider response, verify integration logic
