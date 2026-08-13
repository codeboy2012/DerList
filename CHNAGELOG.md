# Changelog

All notable changes to DerList will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned

#### AI Product Identification

- AI-powered identification directly from product URLs
- Use the user's configured AI provider for product research
- Send the original product URL to the configured AI provider
- Require structured JSON responses from AI identification
- Identify exact product name
- Identify brand
- Identify manufacturer
- Identify model
- Identify category and subcategory
- Identify SKU
- Identify UPC
- Identify ASIN
- Identify MPN
- Identify product URL
- Identify store URL
- Generate product description
- Generate product notes
- Generate product tags
- Identify current pricing
- Identify MSRP
- Identify discounts
- Identify shipping information
- Identify sellers
- Identify product images
- Identify technical specifications
- Generate AI metadata
- Generate suggested product name
- Generate suggested category
- Generate AI confidence score
- Verify AI results against the original product URL
- Prevent incorrect product identification
- Prevent AI from inventing product information

#### AI Provider Handling

- Use whichever AI provider is configured for the user
- Support all currently configured AI providers
- Provider-aware product research
- Provider fallback handling
- Provider timeout handling
- Better AI error reporting
- AI research history
- AI provider usage tracking

#### Manual Product Entry

- Detect when no AI provider is configured
- Clearly notify the user that AI identification is unavailable
- Preserve the original product URL
- Preserve detected retailer information
- Preserve detected product identifiers
- Allow complete manual product entry
- Never present failed identification as successful

#### Product Import

- Improved Amazon product identification
- Exact ASIN verification
- Improved retailer detection
- Product variant detection
- Better multi-retailer importing
- Product seller detection
- Improved image resolution
- Improved product metadata extraction
- Import history
- Re-identify imported products

#### Live AI Research

- Live AI research status
- Show current research stage
- Show current product being researched
- Show provider currently being used
- Show search progress
- Show pricing progress
- Show image lookup progress
- Show specification lookup progress
- Show live field updates
- AI activity timeline
- Cancel running research
- Retry failed research
- Undo AI changes

#### Wishlist

- Advanced wishlist organization
- Folders
- Subfolders
- Custom labels
- Wishlist history
- Bulk editing
- Public wishlists
- Private wishlists
- Wishlist sharing
- Wishlist import/export

#### Price Tracking

- Historical price charts
- Price history
- Price-drop alerts
- Lowest recorded price
- Retailer price comparisons
- Automatic price refresh
- Desired-price alerts
- Coupon tracking
- Promo code tracking
- Shipping-cost tracking

#### Product Images

- Keepa image integration
- Multiple product images
- Image galleries
- Automatic primary image selection
- Image caching
- Image quality scoring
- Broken image detection
- Automatic image replacement
- Additional retailer image providers

#### Shopping Assistant

- Product comparisons
- Product alternatives
- "Find cheaper" research
- "Find similar" research
- Deal discovery
- Compatibility research
- AI buying recommendations
- Automated shopping research

#### PC Builder

- Free PC Builder
- Component compatibility checking
- Power consumption estimation
- Build validation
- Build pricing
- PC Builder wishlist integration

#### Platform Expansion

- Browser extension
- Native mobile applications
- Desktop application
- Public collections
- Shared collections
- Gift registries
- Offline support

---

# [0.11.5] - 2026-08-13

## Product Importer & AI Research Fixes

**Pre-release**

This release redesigns the product identification pipeline to use AI as the primary product identification source. The system now verifies product identity strictly, tracks data sources per-field, and provides clear fallback when AI is unavailable.

### Changed

#### AI-First Product Identification

- AI is now the PRIMARY product identification source (previously a fallback)
- Configured AI provider researches the exact product from the user's URL
- Strict structured JSON response schema enforced on all AI output
- AI receives all available evidence: URL, ASIN, retailer, search results, structured metadata
- AI prompt explicitly prohibits inventing prices, images, UPCs, SKUs, or URLs
- AI must return `null` for any field it cannot verify
- AI confidence scored per-field (name, brand, model, category, price, image, etc.)

#### Product Identity Verification

- New identity validator with 10 verification checks
- ASIN exact match enforcement: input ASIN must match identified product ASIN
- Critical conflict detection rejects misidentified products
- Title-not-URL check prevents URLs from being used as product names
- Title-not-retailer check rejects generic retailer names as product titles
- Title consistency cross-check between AI and search evidence
- Brand consistency verification across sources
- Price reasonableness validation
- Multiple evidence agreement scoring

#### Search as Supporting Evidence

- Search providers (SerpAPI, Brave) now gather supporting evidence for AI
- Search results no longer independently identify products
- Search-only results capped at 60% confidence (always needs review)
- Multi-query ASIN search strategy preserved for evidence gathering
- Evidence stored and passed to AI for verification

#### Import Status & Field Source Tracking

- Full import lifecycle states: idle, analyzing, identifying, verifying, needs_review, ready, added, failed, no_ai_configured, conflict
- Per-field source tracking (ai, url, search, keepa, structured-data, manual)
- Per-field confidence scores
- Import metadata: provider used, model, tokens, duration, timestamp

### Added

#### No-AI-Configured Handling

- Explicit `no_ai_configured` status when user has no AI provider
- Clear UI message: "AI identification isn't configured"
- Product Editor opens for manual entry with verified context (URL, ASIN, retailer) preserved
- System never fabricates product information when AI is unavailable

#### AI Failure Handling

- Dedicated failure states with clear user messaging
- Timeout handling (30s limit)
- Invalid JSON response rejection
- Graceful degradation: keeps verified info, opens Product Editor for manual completion

#### Image Validation & SSRF Protection

- SSRF protection blocks localhost, private IPs, IPv6 loopback, link-local, cloud metadata endpoints, unsafe ports
- Rejects encrypted Google thumbnails, favicons, placeholders, CAPTCHA images
- HTTP-verifies images before acceptance
- Trusted domain allowlist for Amazon CDN, Best Buy, Walmart, etc.
- Keepa image provider extracts real Amazon CDN image IDs from imagesCSV

#### Live Wishlist Events

- New SSE event types: `wishlist.identification.started`, `wishlist.identification.progress`, `wishlist.identification.completed`, `wishlist.identification.failed`, `wishlist.identification.conflict`
- Identification events include product data, confidence, provider, activity timeline
- `emitIdentificationEvent()` helper for pipeline integration
- `buildActivityTimeline()` constructs UI-ready activity data

#### Product Editor Enhancements

- Import status banner (no_ai_configured, ready, needs_review, conflict, failed states)
- Field source badges showing where each value came from (AI, URL, Search, Keepa, Manual)
- AI activity timeline panel showing step-by-step identification progress
- ASIN, UPC, MPN fields added
- Identify button now works with URL input (not just product name)

#### Tests

- 54 new tests covering the AI identification pipeline
- Amazon URL parsing and ASIN extraction (9 tests)
- Exact ASIN matching and wrong ASIN rejection
- AI response parsing with code-fence stripping
- Invalid JSON handling
- URL-as-title regression tests
- Price validation (negative prices, unreasonable values)
- Image validation (placeholder rejection, CDN acceptance)
- SSRF protection (localhost, private IPs, metadata endpoints, unsafe ports)
- Identifier format validation (ASIN, UPC)
- Prompt building and context assembly
- SSE event generation and activity timeline
- **Critical regression test**: B0GSS4SGZR must NOT be identified as Beats Solo 4

### Fixed

- Product URLs no longer used as product titles
- Mismatched ASINs no longer silently accepted
- Search results no longer override AI when identifiers conflict
- Price never fabricated (returns null when unverifiable)
- Image URLs never constructed from ASINs
- Retailer names no longer accepted as product brands

---

# [0.11.0] - 2026-07-XX

## 🚀 AI Research Update

**Pre-release**

This release transforms DerList from a traditional wishlist into an intelligent shopping platform.

Products can now be researched automatically using AI, with information gathered from manufacturers, retailers, documentation, and multiple online sources.

### Added

#### AI Auto Fill

- AI-powered product research from product URLs
- Automatic product name detection
- Brand detection
- Manufacturer detection
- Model detection
- Product description generation
- Product image discovery
- Technical specification discovery
- Category detection
- Tag generation
- Retailer detection
- Pricing discovery
- Product identifier detection
- Purchase link discovery
- Seller information
- AI-generated product metadata

#### Multiple AI Providers

- OpenRouter support
- OpenAI support
- Automatic model selection
- Manual model selection
- Provider switching
- Model overrides
- Fallback model support
- Improved AI request handling
- Improved AI error recovery

#### Product Research

- Manufacturer research
- Retailer research
- Technical documentation research
- Product specification research
- Product image research
- Product identifier research
- Pricing research
- Category research
- Multi-source product profiles

#### Pricing

- Automatic MSRP detection
- Original price support
- Sale price tracking
- Automatic savings calculation
- Automatic discount percentages
- Multiple seller pricing
- Shipping support
- Tax support
- Coupon support
- Promo code support
- Manual pricing lock

#### Multi-Seller Support

- Multiple sellers per product
- Seller store information
- Seller pricing
- Seller shipping
- Seller tax
- Seller coupons
- Seller promo codes
- Seller availability
- Preferred seller
- Seller verification
- Seller purchase URLs

#### Product Metadata

- UPC
- ASIN
- MPN
- SKU
- Brand
- Manufacturer
- Product URLs
- Store URLs
- Categories
- Subcategories
- Custom labels
- Product specifications
- AI metadata

#### AI Research Experience

- Research progress dialog
- Live research stages
- Progress tracking
- Completion summaries
- Research cancellation
- Improved loading states
- Faster research feedback

### Changed

- Reworked product research architecture
- Improved product validation
- Improved AI prompts
- Improved specification handling
- Improved image importing
- Improved retailer parsing
- Improved API architecture
- Improved logging
- Improved error reporting
- Improved product editor

### Improved

- Product editor
- Wishlist layout
- Seller cards
- Pricing cards
- Dark mode
- Responsive layouts
- Mobile experience
- Accessibility
- Page performance
- API performance
- AI request efficiency
- Database queries
- Application caching

### Fixed

- AI enrichment failures
- Model selection bugs
- Provider switching issues
- Pricing calculation bugs
- Seller synchronization issues
- Image import failures
- Product form validation problems
- Wishlist editing issues
- Product parsing edge cases
- UI inconsistencies
- General stability issues

---

# [0.10.0] - 2026-07-XX

## 🎉 First Public Alpha

This release marks the first public alpha release of DerList.

It introduces the redesigned wishlist experience, administration panel, database backend, and foundation for future AI-powered organization, price tracking, and PC Builder features.

### Added

#### Wishlist

- Completely redesigned wishlist interface
- Category-based organization
- Grouped wishlist items
- Five-level priority system
- Top 3 Most Wanted section
- Rich product cards
- Product images
- Multi-retailer product support
- Price tracking
- Discount indicators
- Shopping Assistant foundation

#### Administration

- New administration dashboard
- Administrative controls
- Improved application management

#### Infrastructure

- Prisma backend
- PostgreSQL database
- Responsive dark interface
- Improved backend architecture

### Changed

- Redesigned wishlist experience
- Improved spacing
- Improved organization
- Improved application performance
- Removed unnecessary priority tooltips
- More consistent UI styling

### Improved

- Wishlist loading
- Product organization
- Responsive layouts
- Application stability
- Overall UI consistency

### Coming Next

- AI Organizer
- Automatic wishlist organization
- Product-name cleanup
- Duplicate detection
- Folder suggestions
- Category suggestions
- Free PC Builder
- Live Price Alerts
- Mobile applications
- Public wishlists
- Additional shopping features

---

## Version History

| Version | Release Date | Status |
|---|---|---|
| Unreleased | — | In Development |
| 0.11.0 | July 2026 | Pre-release |
| 0.10.0 | July 2026 | First Public Alpha |