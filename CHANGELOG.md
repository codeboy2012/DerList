# Changelog

All notable changes to DerList will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

---

## [0.14.0] - 2026-11-19

**Open Beta — public registration**

> **Status:** released. This is the Open Beta release announcement.

### Added

#### Public registration

- Registration is open to everyone at `/register`; no invite code, administrator approval,
  allowlist or waitlist is consulted.
- **Username registration:** choose a username, an email address and a password. Usernames are
  3–32 characters, may contain letters, numbers, hyphens and underscores, start and end with a
  letter or number, and are stored lowercase.
- **Email registration:** register with an email address and password; a valid username is
  generated from the address and can be changed later in Settings → Profile.
- Both methods create the same account shape, establish a session immediately and redirect to
  `/dashboard?welcome=1`.
- Case-insensitive, normalised email and username uniqueness at the application and database
  layers.
- Duplicate-email and duplicate-username messages that point at the conflicting field.
- A hidden honeypot field and per-IP/per-email registration limits.

#### OAuth registration

- First-time GitHub and Google sign-in creates an account when the provider returns a verified
  email address.
- Returning provider accounts sign in through their existing link.
- An existing account with the same provider-verified email is linked once and signed in.
- An unverified or missing provider email never creates or links an account, and a provider
  account already linked to a different user is rejected.
- OAuth accounts are created without a usable password. Settings → Account lets the user set one.
- The registration interface renders only providers whose client ID and secret are configured.

#### Sign-in and recovery

- Sign in with either an email address or a username from the same field.
- Open Beta badge and public-registration messaging on the login page.
- Password recovery request and reset pages, with single-use, hashed, one-hour tokens.
- Email verification page, resend control and verification status in Settings → Account.
- Both email flows are hidden when SMTP is not configured; the recovery page explains the
  limitation instead of claiming a message was sent.
- OAuth-only accounts can set a password without a current password; account deletion requires
  the typed confirmation instead of a password in that case.

#### First-run experience

- The dashboard shows a first-run onboarding card with three real steps when the account has no
  collections or products.
- The card contains no sample products, fake activity or fabricated data.
- The dashboard and app navigation display the account's username.

### Changed

- The landing page, header, footer, About, Features, Security, Roadmap and changelog pages now
  describe an Open Beta that anyone can join.
- The previous “Request Beta Access” links were replaced with working `/register` links.
- Accepting an administrator invitation now lands in the dashboard instead of the admin area.
- The seeded owner account normalises `ADMIN_EMAIL` and `ADMIN_USERNAME` to lowercase.

### Security

- Registration is limited to 10 attempts per IP and 5 per email per hour. Password recovery is
  limited to 5 requests per IP and 3 per identifier per 15 minutes, and verification resends to
  3 per account per hour.
- Password and verification tokens are 256-bit random values; only their SHA-256 hashes are
  stored. Reset tokens expire after one hour, verification tokens after 24 hours, and each token
  is consumed atomically once.
- A successful password reset revokes every existing session before issuing a new one.
- Password reset rejects disabled accounts.
- Existing protections are unchanged: provider-verified email required for OAuth linking,
  Argon2id hashing, SHA-256 hashed session tokens, HttpOnly/SameSite cookies, owner-scoped data
  queries and admin role checks.
- The email sender never exposes credentials to the client. A malformed or missing password hash
  now fails closed instead of throwing during sign-in.

### Database

- Additive migration `20261119180000_public_registration` adds the `EmailTokenType` enum and the
  `email_tokens` table, lowercases existing `users.email` and `users.username` values, and adds
  CHECK constraints that keep both lowercase.
- The migration fails closed: if two accounts already share an email address or username
  case-insensitively, it raises an exception before changing any data.
- `scripts/preflight-public-registration.sql` is a read-only preflight that reports duplicate
  identities, rows needing normalisation, and whether the migration objects already exist. It
  requires `blocking_violations_total = 0`.

### Deployment

- Back up the database, run both `scripts/preflight-wishlist-category-integrity.sql` and
  `scripts/preflight-public-registration.sql`, then start the new image and let the entrypoint
  apply migrations.
- SMTP is optional. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and
  `SMTP_FROM`, with `NEXT_PUBLIC_APP_URL` set to the public origin, to enable verification and
  recovery. Otherwise both flows stay hidden.
- The Docker CI job now also verifies that `/register` and `/forgot-password` render in the
  production image.
- Not verified in this release cycle: a live SMTP delivery, real GitHub/Google credentials, a
  production database preflight/migration, a screen-reader audit, and any production deployment.
  No production target was identified and no deployment was performed.

### Testing

- 42 new Vitest tests cover public account creation, case-insensitive duplicate rejection,
  generated usernames, OAuth-only accounts, first-time and returning OAuth callbacks, OAuth route
  state/failure handling, single-use and expired email tokens, session expiry and revocation,
  password-reset success/expiry/disabled-account handling, registration and recovery limits, and
  the optional SMTP configuration and templates.
- 8 new Playwright tests cover username and email registration, first-run onboarding, sign-in
  with either identifier, duplicate rejection, inline validation, mobile registration and
  signed-out dashboard protection.
- Full Vitest suite: 374 tests across 40 files. Playwright suite: 32 tests across 9 files.

---

## [0.13.0] - 2026-11-19

**Wishlist and organization**

> **Status:** released. This is the v0.13.0 release announcement.

### Added

#### Bulk product management

- Product selection checkboxes in list and category views
- Select all visible products
- Select all products in the current collection, including ones hidden by the active search or filter
- Clear selection and a live selected-product count
- Bulk-action toolbar that appears only while products are selected
- Move selected products into another collection
- Set or clear the category of selected products, creating the category record when needed
- Change the star priority of selected products
- Archive selected products
- Delete selected products behind a confirmation dialog
- Per-action result reporting, including updated and skipped counts for partial selections

#### Product archive

- Archive individual products from their row or in bulk
- Dedicated archived-products view for each collection
- Owner-scoped archived-product detail pages that can be opened from the archive row
- Archived details show description, images, product and store links, notes, current and target
  prices, quantity, priority, category, tags, condition, availability, store/source information,
  archive date, archive status and specifications when saved
- Restore an archived product directly from its detail page
- Permanently delete an archived product from its detail page behind a confirmation dialog
- Archived details are read-only until restored; the item form, quick edit, purchased toggle,
  priority control, detail editor and item-editor API all reject edits to archived products
- Dedicated archive 404 state for missing, permanently deleted, restored or foreign items
- Search/category context is preserved when opening an archived product and returning to the archive
- Search archived products and filter them by category
- Archived counts on the collection header and collection cards

#### Wishlist organization

- Manual wishlist ordering with move-up / move-down card actions
- Per-card actions for duplicate, archive, and delete
- Product counts that exclude archived items
- Archived-item counts per collection card
- Empty descriptions are labelled instead of leaving a blank card

### Changed

- Duplicating a wishlist now copies every item field, category metadata, category relationships,
  priorities, notes, metadata, source URLs, and product links into independent wishlist-item
  records, then opens the new collection.
- Wishlist cards expose descriptions, counts and actions without making the whole card a single
  link target.
- Archived products are excluded from collection views, statistics, dashboard counts and feeds,
  global search, the live wishlist panel, AI organizer input, folder suggestions, assistant
  inventory, product pages, copies, and ordinary queries. Account export still includes them.
- Archive rows link to the product detail view and expose an explicit Details action.
- Viewing an archived product is strictly read-only and never restores it.
- Bulk priority changes update both the star priority and the matching priority level.
- The header Copy dialog now matches full collection duplication: every item field, metadata and
  specifications, tags, store/source data and category relationships are copied into independent
  records. `copyTags` and `copyMetadata` are honoured independently instead of being ignored.
- Account export is lossless for stored data: archive state and date, metadata, product links,
  deal information, model, condition, availability, target price and category relations are
  included, along with collection slug, ordering, visibility, notice and Top Picks.
- Imported specifications now use the canonical `metadata.specs` key. Existing rows written with
  `metadata.specifications` continue to display in archived details and the product editor.
- Dashboard counters now report active collections and active product counts; the label reads
  "Active Wishlists". Totals, recent items, recently imported products and price drops also
  exclude archived collections, so every dashboard number describes the active view. Archived
  collections are reordered within their own list and no longer disturb active collection
  ordering.

### Fixed

- Editing a wishlist no longer archives it: the string `"false"` was previously coerced to
  `true` by the validation schema, and an omitted value is now left unchanged.
- Row star priorities refresh after a bulk priority change instead of showing a stale local value.
- Collection totals and counts no longer include archived products.
- Collection page metadata is owner-scoped, so requesting a foreign collection no longer exposes
  its title through the document title while the page body shows "Page not found".
- A bulk delete with an omitted or malformed archive mode is now rejected instead of widening its
  scope; an explicit `active` or `archived` mode is required at both the action and service layer.
- Moving a product no longer leaves `wishlistCategoryId` pointing at a category in the source
  collection. Categories are remapped to the destination collection (or the relation is cleared)
  across bulk move, the product details dialog, quick edit, the product editor API and the AI
  organizer.
- Archived collections are rejected as move destinations by the UI, the bulk service and the
  details action.
- Saving the full product editor now merges the submitted metadata into the stored blob instead
  of replacing it, so enrichment-owned keys such as `pros`, `cons`, `buyingAdvice` and
  `fieldConfidence` survive an edit.
- Dashboard cards and collection cards can no longer force horizontal scrolling on a phone:
  grid items are allowed to shrink and truncate long, unbroken product titles.
- Modal dialogs restore focus to their trigger when they close, and action menus open on the
  first enabled item. A disabled first action (such as "Move up" on the first collection) no
  longer leaves keyboard focus outside the menu.
- An action menu reopened while a pending action still disables every entry keeps a valid
  keyboard target once that action finishes, so Enter and Space no longer do nothing.
- Activating a menu item with Space restores focus to its trigger on key release instead of
  letting the keyup reopen the menu, and the product editor drawer keeps Tab focus inside its
  `aria-modal` panel.
- The `worker` compose service no longer inherits the image's `/api/health` check, which probes a
  port the worker never listens on and therefore reported it unhealthy forever. Worker liveness is
  verified by the CI worker job and by the worker's own log output.

### Security

- Bulk mutations are scoped by collection, owner, and item id in the same query; foreign or
  mismatched ids are skipped and reported.
- Moving products validates ownership of the destination collection.
- Duplicate, archive, restore, and permanent-delete paths reject foreign collections and items
  the same way as missing records.
- Archived detail queries scope the item, collection and owner in one predicate; foreign or
  mismatched ids render the archive 404 state without exposing titles, notes or private metadata.
- Archived items are read-only server-side: editor API writes return `409`, and item actions reject
  archived records until restore. Client-side UI restrictions are not the only barrier.
- AI assistant item update/reorder/remove tools reject archived products, folder application skips
  them and cannot create a folder from an archived-only selection, product enrichment ignores
  archived items, and assistant "clear wishlist" removes active items while preserving the archive.
- Wishlist document metadata is looked up by collection id _and_ owner id. Missing, foreign and
  signed-out requests receive generic metadata; no foreign title or description is emitted.
- Bulk deletion requires an explicit archive state at both the Server Action and service layers,
  so a crafted call cannot omit the mode, submit an unexpected value, or widen its scope. Owner
  and collection scoping remain in the same deletion predicate.
- Bulk and single-item moves validate destination ownership and active status server-side, and
  re-link categories only to records owned by the destination collection.
- Multi-record moves, category changes, quick edits, editor writes and AI organizer applies run in
  database transactions.
- Upload storage paths opt out of Turbopack's whole-project file tracing, and the `postbuild` step
  removes Next's intentional `.env` / `.env.production` copies from `.next/standalone`. The
  supported Docker build already excluded those files via `.dockerignore`; a direct standalone
  deployment no longer ships them either.

### Database

- Additive migration `20261119000000_add_item_archive` adds `archived` and `archivedAt` to
  `wishlist_items` plus an index on `(wishlistId, archived)`. No existing columns or relations were
  restructured.
- Additive migration `20261119120000_enforce_wishlist_category_integrity` adds a unique
  `(id, wishlistId)` key to `wishlist_categories` and replaces the single-column category foreign
  key with a composite `(wishlistCategoryId, wishlistId)` foreign key. The migration aborts without
  changing data if any existing row already references a category in another collection.
- Archived detail access required no additional migration; it reads the existing item, product,
  category and metadata fields.
- `scripts/preflight-wishlist-category-integrity.sql` is a read-only preflight for the composite
  category migration. It reports item and category totals, products with a category, every
  blocking integrity condition and the migration's own index/constraint preconditions, and it
  documents the expected clean result. It ran clean against the local database (0 blocking
  violations) and was verified to report a cross-collection row as 1.

### Deployment

- Upgrading an existing installation: back up the database, run the read-only preflight, then
  start the new image. `blocking_violations_total` must be `0`; a nonzero value aborts the
  migration without changing data. See the README upgrade section for the exact command.
- The production image is built and exercised by the `docker-verify` CI job: it builds the image,
  starts the compose stack with a disposable PostgreSQL database, applies migrations through the
  entrypoint, checks `/api/health` and `/login`, confirms the non-root runtime user (uid 1001),
  checks that no `.env` file or test/build artifact is inside the image, restarts the database and
  the app to prove PostgreSQL and upload persistence, and checks the worker and container logs.
- Verified against PostgreSQL 16 and Node 22 in CI. The image does not contain runtime secrets;
  configuration is supplied through the container environment.
- Not verified in this release cycle: a production database preflight (no production credentials
  or identified production target were available) and a screen-reader accessibility audit.

### Testing

- The database-backed tests cover bulk category/priority/move/archive/delete behaviour, required
  archive-state deletion, mixed active/archived selections, cross-account attempts, archived detail
  read-only enforcement, the editor API, assistant/folder/clear guards, restore/delete safety, the
  500-item cap, wishlist duplication, the Copy API options, account export completeness, move and
  category integrity (including the database composite foreign key), collection ordering,
  collection-metadata privacy, metadata merging and canonical import specification keys.
- 24 Playwright browser tests cover archived detail access, cross-account denial, restore from the
  detail page, confirmed permanent deletion, read-only viewing, deleted-detail handling, mobile
  archive navigation, the 501-item cap, filtered selection, partial bulk failures, archive category
  selection, collection duplication, legacy specification rendering, cross-account metadata
  privacy, dashboard counts for mixed active/archived collections, responsive layout bounds,
  dialog/menu focus management, keyboard collection ordering (including disabled actions),
  drawer/dialog focus containment and restoration, bulk-selection announcements and canonical vs.
  legacy specifications in the product editor.
- Full Vitest suite: 336 tests across 33 files. Playwright suite: 24 tests across 8 files.

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

#### Authentication

- Passkeys and WebAuthn.
- Two-factor authentication.
- Change email with re-verification.
- Login history and security notifications.
- Shared rate limiting for multiple app replicas.

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

| Version    | Release Date | Status             |
| ---------- | ------------ | ------------------ |
| Unreleased | —            | In Development     |
| 0.14.0     | 2026-11-19   | Open Beta          |
| 0.13.0     | 2026-11-19   | Stable             |
| 0.12.0     | 2026-11-18   | Stable             |
| 0.11.5     | 2026-08-13   | Stable             |
| 0.11.0     | July 2026    | Pre-release        |
| 0.10.0     | July 2026    | First Public Alpha |
