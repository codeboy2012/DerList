## Introduction

DerList's current product import engine uses a single-pass extraction approach that often produces incorrect prices (e.g., picking up coupon amounts instead of actual prices on Amazon). This spec defines the Product Intelligence Engine — a parallel extraction pipeline with confidence-based voting, site-specific parsers, optional headless browser rendering, and optional AI verification.

The engine is inspired by PriceGhost's multi-strategy voting system but redesigned for DerList's shared product database architecture where products are global entities reused across all users.

## Requirements

### Requirement 1

**User Story:** As a user importing a product from Amazon, I want the correct product price to be extracted (not coupon discounts, reviews, or accessories) so that I can trust the pricing information in my wishlists.

1. JSON-LD Product offers are the primary price source (confidence 100)
2. Amazon-specific parser targets buy box sections only (confidence 90-95)
3. Coupon/savings amounts are never mistaken for product prices
4. Monthly payment and financing prices are filtered out
5. When multiple prices are found, the highest-confidence result wins
6. If overall confidence is below 60%, the product is flagged for manual review

### Requirement 2

**User Story:** As a user importing from a major retailer, I want specialized parsers that understand each retailer's page structure so that product title, image, price, and availability are always correct.

1. Dedicated parsers exist for Amazon, Best Buy, Newegg, Walmart, Target, Apple, B&H, Micro Center, eBay, and Steam
2. Each parser extracts title, price, currency, image, brand, availability, and SKU using retailer-specific selectors
3. Unknown retailers fall back to the generic extractor pipeline (JSON-LD + OG + HTML heuristics)
4. Parser selection is automatic based on domain detection from the normalized URL
5. Parsers are organized under src/lib/products/parsers/ with one file per retailer

### Requirement 3

**User Story:** As a developer, I want multiple extractors to run in parallel and vote on results so that no single extraction failure produces incorrect data.

1. JSON-LD, OpenGraph, site-specific parser, and generic HTML extractors run simultaneously via Promise.allSettled
2. Each extractor returns a standardized result with a confidence score between 0 and 100
3. Results are merged using consensus voting where majority agreement wins
4. Outlier prices (more than 50% deviation from the median) are automatically discarded
5. The final merged result includes the winning price, its source, and overall confidence

### Requirement 4

**User Story:** As a user importing from JS-heavy retailers, I want DerList to render the page properly before extracting so that prices hidden behind JavaScript are still captured.

1. Playwright is the rendering backend (optional dependency — system works without it)
2. Browser mode activates when HTTP fetch returns no price, anti-bot is detected (403/429), or the domain is known to require JS
3. Browser instances have a 30-second timeout and stealth measures (random user-agent, viewport, human-like delays)
4. If Playwright is not installed, the system gracefully falls back to HTTP-only extraction
5. Browser rendering is never used for retailers that work fine with HTTP fetch

### Requirement 5

**User Story:** As a system operator, I want an optional AI layer that verifies extractions when confidence is low so that ambiguous cases are resolved correctly.

1. AI providers supported are Gemini, OpenAI, Anthropic, and Ollama (configured via environment variables)
2. AI is only invoked when extraction confidence is below 70% OR when price candidates from different extractors conflict
3. AI never replaces high-confidence deterministic extraction results
4. The system works completely without any AI API keys configured
5. AI results include their own confidence score and participate in the voting system

### Requirement 6

**User Story:** As a user, I want products to be automatically deduplicated across the platform so that importing the same product that another user already imported reuses existing data and price history.

1. Before creating a new Product record, the system checks for matches by canonical URL, SKU+retailer, GTIN, and MPN+brand
2. If a match is found, the existing Product record is reused and its price/availability are updated
3. Price history is always appended (never overwritten) when a product is re-imported or refreshed
4. WishlistItems reference the shared Product record via the productId foreign key
5. Orphaned products (not on any wishlist) are retained for future instant imports

### Requirement 7

**User Story:** As a user tracking product prices, I want products to refresh automatically at appropriate intervals so that I always see current pricing without manual action.

1. Products with active wishlist items refresh every 12 hours
2. Products without active wishlist items refresh every 24 hours
3. Failed refreshes use exponential backoff with a maximum of 5 attempts
4. Every successful refresh records a PriceHistory entry (even if price unchanged)
5. Price changes automatically create ProductChange records with old and new values
6. Stale products (more than 48 hours without refresh) are prioritized in the queue

### Requirement 8

**User Story:** As a user viewing a product page, I want to see comprehensive pricing analytics so that I can make informed purchase decisions.

1. Product detail page displays current price, lowest ever, highest ever, and 30-day average
2. A price trend indicator shows whether the price is trending up, down, or stable
3. The page shows how many wishlists and unique users are tracking this product
4. Price history is displayed as a table with date, price, change delta, and availability
5. A refresh button allows manual price update (scoped to products on the user's wishlists)
