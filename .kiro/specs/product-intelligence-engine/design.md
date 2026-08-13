## Overview

The Product Intelligence Engine enhances DerList's existing product import system (`src/lib/products/`) and background job system (`src/lib/jobs/`) with a modular, multi-strategy extraction pipeline. It does NOT replace the existing architecture — it extends it.

The engine runs multiple extraction strategies in parallel (JSON-LD, OpenGraph, Microdata, retailer-specific parsers, HTML heuristics), merges their results through a confidence-weighted consensus algorithm, and optionally invokes AI verification or headless browser rendering for low-confidence cases. The result is a single `PipelineResult` with a confidence score that feeds into the existing product creation and background refresh flows.

## Architecture

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

## Components and Interfaces

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

## Data Models

### PipelineInput

Passed into the extraction pipeline from both the import flow and background refresh:

```typescript
interface PipelineInput {
  html: string;                // Raw HTML content of the product page
  url: string;                 // Canonical product URL
  domain: string | null;       // Extracted domain for parser selection
  existingProduct?: {          // Present during background refresh
    id: string;
    currentPrice: number | null;
  };
}
```

### PipelineResult

The unified output of the extraction pipeline, consumed by `confirmImportAction()` and `syncProduct()`:

```typescript
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
```

### ExtractionResult

Returned by each individual extractor and retailer parser:

```typescript
interface ExtractionResult {
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  brand: string | null;
  sku: string | null;
  availability: string | null;
  inStock: boolean | null;
  confidence: number;        // 0-100, self-assessed by extractor
}
```

### VotableResult

Enriched extraction result used as input to the consensus engine:

```typescript
interface VotableResult extends ExtractionResult {
  source: string;            // e.g. 'json-ld', 'opengraph', 'amazon-parser'
}
```

### Database Models (Unchanged)

No schema changes are required. The engine uses the existing Prisma models:

- **Product** — stores the final extracted fields (title, price, image, brand, etc.)
- **PriceHistory** — records every price observation during import and refresh
- **ProductFetchJob** — tracks background refresh scheduling and status
- **ProductChange** — logs field-level changes detected during refresh

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

## Correctness Properties

The following invariants must hold for the extraction pipeline to be considered correct:

1. **Never invent data** — If an extractor cannot find a field in the HTML, it must return `null`. No field may be guessed, interpolated, or hallucinated.

2. **Consensus requires agreement** — A price is only accepted if at least two extractors report values within 5% of each other, OR a single extractor reports with confidence >= 85.

3. **AI cannot override deterministic consensus** — AI verification results participate in voting with the same rules as any other extractor. They do not have veto or override power.

4. **Confidence reflects actual evidence** — The `confidence` score must decrease when extractors disagree, when fewer fields are populated, or when the pipeline falls back to weaker strategies.

5. **No silent product substitution** — During background refresh, if the extracted title/brand/SKU differ significantly from the stored product, the job is flagged `needsReview` rather than overwriting the product.

6. **Graceful degradation** — Every optional component (AI, browser, specific parsers) must be skippable. The pipeline must always produce a result, even if confidence is 0 and all fields are null.

7. **Idempotent extraction** — Running the pipeline twice on the same HTML input must produce the same `PipelineResult` (no randomness, no time-dependent logic in extraction).

8. **Parser isolation** — A failing parser must not crash the pipeline. `Promise.allSettled` ensures all extractors run independently.

## Error Handling

### Extractor Failures

Each extractor runs inside `Promise.allSettled`. If an individual extractor throws:
- The error is logged with the extractor name and URL
- The extractor's result is excluded from consensus
- The pipeline continues with remaining results
- If ALL extractors fail, the pipeline returns a result with `confidence: 0`, `needsReview: true`, and all fields null

### Network Failures (Fetch)

- **Timeout** (>10s): Logged, returns empty HTML → pipeline produces low-confidence result
- **HTTP 403/429**: Triggers browser fallback if available; otherwise treated as empty HTML
- **DNS failure / connection refused**: Returns immediately with fetch error; no pipeline run

### Browser Failures

- **Playwright not installed**: `isBrowserAvailable()` returns false, browser path is skipped entirely
- **Browser timeout** (>30s): Returns null from `renderWithBrowser()`, original HTTP result is used
- **Browser crash**: Caught, logged, returns null — does not block the pipeline

### AI Provider Failures

- **Not configured**: `isAIConfigured()` returns false, AI verification is skipped
- **API timeout / rate limit / auth error**: Caught, logged, returns null from `verifyWithAI()`
- **Malformed response**: Parsed with fallback; if unparseable, treated as null result
- AI failure never blocks product creation or background refresh

### Consensus Edge Cases

- **Zero valid results**: Returns `confidence: 0`, `needsReview: true`, all fields null
- **Single extractor only**: Uses that result directly; confidence capped at the extractor's own confidence (no boost from agreement)
- **All prices disagree**: No majority group → `needsReview: true`, price set to highest-confidence extractor's value

### Background Refresh Errors

- **Product not found in DB**: Job marked as failed, not retried
- **Fetch failure**: Job rescheduled with exponential backoff (existing behavior in `queue.ts`)
- **Pipeline low confidence** (<60%): Job metadata flagged for review; product fields are NOT updated to avoid corrupting existing data

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
