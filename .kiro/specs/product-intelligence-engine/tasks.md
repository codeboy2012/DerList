## Tasks

- [x] 1. Create shared types and interfaces for the extraction pipeline
  Create `src/lib/products/engine/types.ts` with:
  - `ExtractionResult` interface (title, price, currency, image, brand, sku, mpn, gtin, inStock, availability, description, confidence, source)
  - `PipelineInput` interface (html, url, domain, existingProduct?)
  - `PipelineResult` interface (extends ExtractionResult + gallery, retailer, priceSource, needsReview)
  - `VotableResult` interface for consensus engine
  - `RetailerParser` interface (name, domains[], extract(html, url) → ExtractionResult)

- [x] 2. Create parser registry with domain-to-parser mapping
  Create `src/lib/products/parsers/index.ts` with:
  - `getParserForDomain(domain: string): RetailerParser | null` function
  - `getAllParsers(): RetailerParser[]` function
  - Domain matching logic (supports subdomains like amazon.co.uk)
  - Registry that maps domain patterns to parser modules

- [x] 3. Create Amazon site-specific parser
  Create `src/lib/products/parsers/amazon.ts` with:
  - Buy box price extraction (priceToPay, corePriceDisplay, corePrice_feature_div)
  - Coupon/savings filtering (never mistake "Save $59" for the price)
  - Product title from #productTitle
  - Image from #landingImage or data-a-dynamic-image
  - Brand extraction
  - Stock status from #availability and add-to-cart button presence
  - SKU/ASIN extraction from URL
  - Confidence scoring based on how much was successfully extracted

- [x] 4. Create individual extractors as separate modules
  Create files in `src/lib/products/extractors/`:
  - `json-ld.ts` — Extract from schema.org Product JSON-LD (confidence 95-100)
  - `opengraph.ts` — Extract from og:title, og:image, og:price:amount (confidence 75-80)
  - `microdata.ts` — Extract from itemprop attributes (confidence 85-90)
  - `html-heuristic.ts` — Generic price/image/title from CSS classes + HTML patterns (confidence 40-60)
  - `index.ts` — barrel export of all extractors
  Each extractor returns an ExtractionResult with its own confidence score.

- [x] 5. Create consensus engine for merging extraction results
  Create `src/lib/products/engine/consensus.ts` with:
  - `buildConsensus(results: VotableResult[]): ConsensusResult` function
  - Price grouping: cluster candidates within 5% tolerance
  - Majority voting: largest group wins
  - Within winning group: highest-confidence candidate is selected
  - Non-price fields (title, image, brand): take from highest-confidence extractor
  - Agreement score: proportion of extractors that agree
  - needsReview flag when no clear majority exists (agreement < 0.5)

- [x] 6. Create extraction pipeline orchestrator
  Create `src/lib/products/engine/pipeline.ts` with:
  - `runExtractionPipeline(input: PipelineInput): Promise<PipelineResult>` function
  - Detects retailer parser from domain
  - Runs all extractors in parallel via Promise.allSettled
  - Collects successful results, ignores failures
  - Passes results to consensus engine
  - Returns merged PipelineResult with overall confidence
  - Does NOT invoke browser or AI (those are triggered by callers if needed)

- [x] 7. Integrate pipeline into import flow and background sync
  Modify `src/lib/products/index.ts`:
  - Replace `extractMetadata(html, domain)` call with `runExtractionPipeline({ html, url: canonicalUrl, domain })`
  - Map PipelineResult fields back to ImportedProductData format
  - Preserve existing 5-minute cache check and error handling
  Modify `src/lib/jobs/product-sync.ts`:
  - Replace `extractMetadata(html)` with `runExtractionPipeline({ html, url, domain, existingProduct })`
  - Use pipeline's confidence score in sync result logging

- [x] 8. Create remaining retailer parsers (Best Buy, Newegg, Walmart, Target, Micro Center)
  Create files in `src/lib/products/parsers/`:
  - `bestbuy.ts` — priceView-hero-price, sku-title, primary-image
  - `newegg.ts` — price-current, product-title, product-image
  - `walmart.ts` — __NEXT_DATA__ JSON extraction, itemprop price, product title
  - `target.ts` — data-test="product-price", product-title, image gallery
  - `microcenter.ts` — #pricing section, product info
  Register all in `parsers/index.ts`

- [x] 9. Create browser rendering module (optional, Playwright)
  Create `src/lib/products/browser/`:
  - `index.ts` — `isBrowserAvailable()` (dynamic import check), `renderWithBrowser(url)` 
  - `render.ts` — Playwright launch with stealth (random UA, viewport, delays), 30s timeout
  - `domains.ts` — List of domains known to require JS rendering
  - Graceful fallback: if playwright not installed, return null
  - Integration: callers check `isBrowserAvailable()` before invoking

- [x] 10. Create AI verification module (optional)
  Create `src/lib/products/ai/`:
  - `index.ts` — `isAIConfigured()`, `verifyWithAI(input)` orchestrator
  - `providers.ts` — adapter for Gemini/OpenAI/Anthropic/Ollama (dynamic imports)
  - `prompts.ts` — verification prompt template (price correctness, stock status)
  - Only invoked when confidence < 70% AND AI env vars are set
  - Returns AIVerificationResult with suggestedPrice, confidence, reason
  - AI result participates in voting (does not override deterministic results)
