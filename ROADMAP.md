# DerList — Complete Feature Inventory

**Your private wishlist and personal product organizer.**

Collect products. Organize collections. Research what you want. Compare options. Track prices. Let AI help. Keep everything under your control.

> **Purpose of this document**
>
> This is the canonical feature inventory and master roadmap for DerList. It records the
> implemented foundation, incomplete work, planned features, and exploratory ideas so good
> ideas are not lost between releases.
>
> Status labels describe the maturity of a feature area as a whole. They do **not** guarantee
> that every bullet in that area is implemented. Some older functionality — especially
> wishlist duplication/archive and parts of AI identification — needs a fresh code audit before
> it is treated as definitively complete or missing.
>
> This is a planning reference, not a release promise or a fixed schedule.

## Status key

| Status          | Meaning                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| **Implemented** | Existing functionality or infrastructure.                                    |
| **Incomplete**  | Foundation exists, but needs completion, real integrations, or verification. |
| **Planned**     | A feature we want to build.                                                  |
| **Exploratory** | An idea worth considering, not a commitment.                                 |

Section labels such as **Existing foundation**, **Partial implementation**, and
**Repository published** preserve the original planning language and sit alongside the four
status categories above.

## Contents

1. [Wishlist management](#1-wishlist-management)
2. [Product importing](#2-product-importing)
3. [Product management and details](#3-product-management-and-details)
4. [Private search and organization](#4-private-search-and-organization)
5. [Product comparison](#5-product-comparison)
6. [AI product intelligence](#6-ai-product-intelligence)
7. [Price tracking and price intelligence](#7-price-tracking-and-price-intelligence)
8. [Availability and retailer research](#8-availability-and-retailer-research)
9. [Notifications and reminders](#9-notifications-and-reminders)
10. [Product research workspace](#10-product-research-workspace)
11. [Account management and authentication](#11-account-management-and-authentication)
12. [Privacy and data security](#12-privacy-and-data-security)
13. [Appearance and personalization](#13-appearance-and-personalization)
14. [Dashboard and navigation](#14-dashboard-and-navigation)
15. [Data export, import, and backups](#15-data-export-import-and-backups)
16. [Administration and project management](#16-administration-and-project-management)
17. [Mobile and platform experience](#17-mobile-and-platform-experience)
18. [Browser integrations and automation](#18-browser-integrations-and-automation)
19. [Developer experience and open-source ecosystem](#19-developer-experience-and-open-source-ecosystem)
20. [Older ideas and explicitly excluded directions](#20-older-ideas-and-explicitly-excluded-directions)
21. [Technical improvements that support everything](#21-technical-improvements-that-support-everything)
22. [Suggested implementation roadmap](#suggested-implementation-roadmap)
23. [Master feature checklist](#master-feature-checklist)

---

## 1. Wishlist management

**Status:** Existing foundation — v0.13.0 organization work implemented

The central feature of DerList.

> **v0.13.0 implementation notes**
>
> Delivered in the v0.13.0 development cycle: bulk selection with select-all-visible and
> select-all-in-collection, bulk move/category/priority/archive/delete with per-item ownership
> scoping and partial-result reporting; product archive, restore and permanent delete with a
> dedicated archived-products view that supports search and category filtering; a read-only
> archived-product detail page for inspecting descriptions, images, links, notes, prices,
> quantity, priority, category, tags, store/source data, archive date and specifications without
> restoring the item; compact wishlist duplication that creates independent item records and
> copies category relationships; manual wishlist ordering with keyboard-accessible move up/down
> controls; collection cards with active and archived product counts, descriptions and per-card
> actions. Archived products are excluded from normal views, dashboard statistics, global search,
> the live panel, AI organizer input, folder suggestions and copies. Account export still includes
> them so no data is lost.
>
> Archived details are read-only: the standard item form, quick edit, purchased toggle, priority
> control, detail editor, item-editor API, AI assistant mutations, folder application and product
> enrichment all reject or skip archived items until restored. Active bulk actions cannot include
> archived items, and active delete cannot permanently remove one.
> Archived detail URLs are owner-scoped; the final UI for a missing or foreign item is the archive
> 404 state (the App Router may return an HTTP 200 shell while streaming that state).
>
> Release hardening applied to this area: collection page metadata is scoped by owner, bulk
> deletion requires an explicit active/archived mode at both the action and service layers,
> archived collections are rejected as move destinations, category relations are remapped (or
> cleared) on every move and category edit, the header Copy dialog matches full duplication and
> honours its tag/metadata options, account export preserves archive state, metadata, product
> links and category relations, and dashboard counts report active collections and active
> products. Imported specifications now use the canonical `metadata.specs` key while legacy
> `metadata.specifications` rows remain readable. A composite foreign key now enforces at the
> database layer that a product's category belongs to its own collection; the migration refuses
> to apply rather than rewrite existing invalid rows. Product-editor saves merge metadata so
> enrichment-owned keys survive an edit, and the responsive audit fixed mobile grid overflow,
> dialog focus restoration and keyboard navigation through action menus with disabled items.
>
> Still open in this area: nested collections, wishlist templates and cover images, bulk mark
> purchased, wishlist activity history, recently viewed wishlists, product drag-and-drop
> organization, and collection tag/label systems.

- Create wishlists.
- Rename wishlists.
- Delete wishlists.
- Add products to wishlists.
- Remove products from wishlists.
- Organize products into collections.
- Mark products as purchased.
- Set product priorities.
- Mark top-pick products.
- Search within collections.
- Sort and filter products.
- Display wishlist statistics.
- Display empty states.
- Move products between collections.
- Duplicate entire wishlists.
- Archive wishlists without deleting them.
- Restore archived wishlists.
- Bulk-select products.
- Bulk-delete products.
- Bulk-move products.
- Bulk-edit product information.
- Bulk-change priorities.
- Bulk-mark products as purchased.
- Custom wishlist colors and icons.
- Wishlist descriptions.
- Wishlist-specific cover images.
- Wishlist activity history.
- Recently modified wishlists.
- Recently viewed wishlists.
- Wishlist templates.
- Nested collections and subcollections.
- Drag-and-drop product organization.
- Custom collection ordering.
- Collection labels and tags.
- Collection-specific notes.

## 2. Product importing

**Status:** Existing foundation — major improvements planned

Importing should be one of DerList's strongest features.

### Import methods

- Import through a URL.
- Import using a product name.
- Import multiple URLs.
- Manual product creation.
- Generic product-page importing.
- Amazon importer.
- Best Buy importer.
- Newegg importer.
- PCPartPicker importer.
- Metadata extraction.
- Product image resolution.
- AI-assisted product identification foundation.
- More retailer integrations.
- Import from browser share menus.
- Browser extension for importing.
- Import from copied product text.
- Import from screenshots or product images.
- Import from supported product feeds.
- Import from existing wishlist exports.

### Import accuracy

- Exact product identification.
- Exact model identification.
- Brand verification.
- Product variant identification.
- Seller identification.
- Product condition identification.
- Currency detection and validation.
- Distinguish product price from unrelated page prices.
- Detect unavailable products.
- Detect invalid or redirected URLs.
- Detect duplicate products.
- Confidence scores for extracted information.
- Source attribution for every extracted field.
- Allow users to correct incorrect information.

### Import experience

- Live import progress.
- Individual import stages.
- Show what information is being extracted.
- Show which fields were successfully identified.
- Update product information as extraction progresses.
- Import timeline.
- Cancel imports.
- Retry failed imports.
- Undo imports.
- Import history.
- Re-import existing products.
- Re-identify incorrectly identified products.
- Import error explanations.
- Better fallback behavior when retailers block extraction.

## 3. Product management and details

**Status:** Existing foundation

Every product should have a detailed, editable record.

### Product information

- Product name.
- Brand.
- Model.
- Product image.
- Description.
- Product category.
- Product condition.
- Current price.
- Currency.
- Target price.
- Availability.
- Quantity.
- Product priority.
- Personal notes.
- Original source URL.
- Collection assignment.
- Product SKU.
- UPC, EAN, and ISBN identifiers where relevant.
- Manufacturer product number.
- Product dimensions.
- Product weight.
- Technical specifications.
- Color and size variants.
- Product attributes.
- Retailer information.
- Seller information.
- Shipping information.
- Warranty information.
- Release date.
- Product launch information.

### Product editing

- Edit product information.
- Edit prices.
- Edit descriptions and notes.
- Change product images.
- Change collections.
- Product image gallery.
- Multiple product images.
- Image cropping and positioning.
- Image replacement history.
- Product version history.
- Undo product edits.
- Duplicate product merging.
- Product-specific tags.
- Product-specific custom fields.
- Custom product attributes.

### Product lifecycle

- Mark products as purchased.
- Purchase date.
- Actual purchase price.
- Purchase retailer.
- Purchase notes.
- Product return status.
- Product replacement tracking.
- Product ownership status.
- Archive products.
- Restore archived products.
- Product activity history.

## 4. Private search and organization

**Status:** Existing foundation — expansion planned

Search should work across the user's own saved information. It must never become a public
product marketplace.

- Search saved products.
- Search within collections.
- Search across all wishlists.
- Search by brand.
- Search by model.
- Search by retailer.
- Search by product identifier.
- Search by notes and descriptions.
- Search by custom tags.
- Search by price range.
- Search by availability.
- Search by condition.
- Search by priority.
- Search by purchased status.
- Search by collection.
- Advanced search filters.
- Combined filters.
- Saved searches.
- Recent searches.
- Search suggestions.
- Search autocomplete.
- Search history controls.
- Keyboard shortcuts.
- Command palette.
- Search result grouping.
- Search result pagination.
- Duplicate detection within personal products.
- Optional personal product indexing.
- Clear personal search index.

## 5. Product comparison

**Status:** Planned

This deserves its own feature area.

- Compare two products.
- Compare multiple products.
- Side-by-side product cards.
- Compare prices.
- Compare specifications.
- Compare product dimensions.
- Compare available variants.
- Compare retailers.
- Compare availability.
- Highlight specification differences.
- Highlight advantages and disadvantages.
- Custom comparison criteria.
- Save comparisons.
- Compare products from different collections.
- AI-generated comparison summaries.
- AI recommendations based on user-defined requirements.

The goal is to answer questions like: _Which of these three laptops actually makes the most
sense for what I need?_

## 6. AI product intelligence

**Status:** Foundation exists — further integration needed

This is one of the biggest opportunities for DerList.

### AI product identification

- Reliable exact URL identification.
- Product identification from names.
- Product identification from images.
- Identify exact brands and models.
- Identify product variants.
- Extract technical specifications.
- Detect incorrect product matches.
- Confidence scoring.
- Explain identification results.
- Manual correction and confirmation.

### AI organization

- Automatically suggest categories.
- Suggest collections.
- Suggest product tags.
- Detect duplicates.
- Suggest missing information.
- Suggest product priorities based on user criteria.
- Organize large wishlists.
- Suggest collection names.
- Summarize collections.

### AI personal shopping assistant

- Ask questions about saved products.
- Ask questions about collections.
- Compare saved products.
- Summarize product specifications.
- Explain differences between models.
- Evaluate products against requirements.
- Identify potential drawbacks.
- Help research products.
- Generate comparison reports.
- Recommend products from the user's own saved items.
- Remember user-defined product preferences.
- Reference personal notes.
- Maintain conversation history.
- Allow users to delete assistant history.
- Context-aware collection assistance.

### AI provider management

- Provider configuration infrastructure.
- Encrypted provider credentials infrastructure.
- Structured AI response foundation.
- Additional provider integrations.
- Provider selection.
- Model selection.
- Provider failover.
- AI usage controls.
- AI request history.
- Provider testing.
- Per-feature AI configuration.
- Usage and cost visibility where supported.
- Manual fallback when AI is unavailable.

AI must remain optional. Basic DerList functionality should not depend on an external AI
service.

## 7. Price tracking and price intelligence

**Status:** Incomplete foundation

We have price-related product fields and historical tracking foundations, but real automated
monitoring still needs work.

- Store product prices.
- Set target prices.
- Price-related storage/statistics foundation.
- Record historical price changes reliably.
- Automatic price refresh.
- Background price-monitoring worker.
- Price history charts.
- Price timeline.
- Lowest recorded price.
- Highest recorded price.
- Average historical price.
- Price change percentages.
- Price drop detection.
- Price increase detection.
- Target-price monitoring.
- Price comparison across retailers.
- Historical retailer comparisons.
- Currency normalization.
- Price update timestamps.
- Price-source attribution.
- Price verification.
- Manual price-history entries.
- Price tracking controls per product.
- Pause and resume tracking.
- Tracking frequency settings.
- Failed refresh handling.

## 8. Availability and retailer research

**Status:** Planned

- Store availability information.
- Store product source URLs.
- Automated availability checks.
- Track in-stock status.
- Track out-of-stock status.
- Track discontinued products.
- Track preorder availability.
- Track retailer availability.
- Track seller changes.
- Last checked timestamps.
- Availability history.
- Refresh product metadata.
- Refresh product images.
- Refresh product descriptions.
- Detect changed product pages.
- Detect broken product links.
- Preserve original source URLs.
- Research source history.
- Distinguish verified facts from AI-generated information.

## 9. Notifications and reminders

**Status:** Planned

- Price-drop notifications.
- Target-price notifications.
- Price-increase notifications.
- Back-in-stock notifications.
- Out-of-stock notifications.
- Availability changes.
- Product information updates.
- Import completion notifications.
- Import failure notifications.
- Wishlist reminders.
- Product reminders.
- Scheduled reminders.
- Notification center.
- Read/unread notifications.
- Notification history.
- Per-product notification settings.
- Per-collection notification settings.
- Global notification preferences.
- Email notifications.
- Browser notifications.
- Push notifications, if supported by a future PWA.
- Quiet hours.
- Notification frequency controls.

## 10. Product research workspace

**Status:** Exploratory

A place to collect more than just product names and prices.

- Research notes.
- Research documents.
- Product research timeline.
- Save useful product sources.
- Save reviews and reference links.
- Store product pros and cons.
- Record personal requirements.
- Record questions to investigate.
- Research checklists.
- Product research status.
- AI research summaries.
- Source citations for research findings.
- Compare research findings.
- Attach files to products.
- Attach images to research notes.
- Organize research by collection.

## 11. Account management and authentication

**Status:** Existing foundation

- User accounts.
- Account profiles.
- Password-based authentication.
- Argon2id password hashing.
- Session cookies.
- GitHub OAuth infrastructure.
- Google OAuth infrastructure.
- Session management.
- Account data export.
- Account deletion flow.
- Public username/email registration.
- Sign in with username or email.
- First-time OAuth registration with a provider-verified email.
- Email verification (SMTP).
- Password recovery (SMTP).
- Change email.
- Change password.
- Session/device descriptions.
- Revoke individual sessions.
- Revoke all sessions.
- Login history.
- Account security activity.
- Account preferences.
- More detailed account data management.

## 12. Privacy and data security

**Status:** Strong foundation implemented

This is a core architectural requirement, not an optional feature.

- Private-by-default user data.
- Owner-scoped wishlist access.
- Owner-scoped product mutations.
- IDOR protections.
- Upload ownership validation.
- Secure upload path validation.
- Account-scoped top-picks access.
- Account-scoped wishlist operations.
- Rate limiting on upload/import endpoints.
- Account data export.
- Password-confirmed account deletion.
- Account upload cleanup infrastructure.
- Encrypted AI provider credentials infrastructure.
- Private cache headers for protected uploads.
- Fully exercise account deletion and cleanup.
- More extensive authorization tests.
- Security event history.
- Granular privacy settings.
- Data retention controls.
- Personal data deletion tools.
- Data export customization.
- More comprehensive backup and recovery procedures.

## 13. Appearance and personalization

**Status:** Implemented foundation

- System theme.
- Light theme.
- Dark theme.
- Six accent colors.
- Liquid Glass off.
- Liquid Glass subtle.
- Liquid Glass full.
- Reduce motion.
- Reduce transparency.
- Always-show focus indicators.
- Blur product images.
- Blur product prices.
- Device-local preferences.
- More accent colors.
- Custom accent color picker.
- Custom density settings.
- Compact and comfortable layouts.
- Product-card layout preferences.
- Grid/list display options.
- Custom dashboard layouts.
- Customizable navigation.
- Per-device preferences.
- More accessibility preferences.

## 14. Dashboard and navigation

**Status:** Existing foundation — expansion ideas

- Main dashboard.
- Sidebar navigation.
- Header navigation.
- Collection navigation.
- Product cards.
- Wishlist statistics.
- Recently added products.
- Recently viewed products.
- Recently updated products.
- Recently purchased products.
- Priority overview.
- Target-price overview.
- Price-drop overview.
- Availability overview.
- Collection overview widgets.
- Custom dashboard widgets.
- Dashboard customization.
- Quick-add product action.
- Global search from dashboard.
- Keyboard navigation throughout the application.

## 15. Data export, import, and backups

**Status:** Partial implementation

- JSON account export.
- CSV export.
- Export individual collections.
- Export individual wishlists.
- Export selected products.
- Export product images.
- Export product history.
- Import DerList JSON backups.
- Import CSV files.
- Import from other wishlist platforms.
- Restore deleted collections from backups.
- Restore product information.
- Backup validation.
- Duplicate detection during restoration.
- Export progress and error reporting.
- Portable personal data archive.

## 16. Administration and project management

**Status:** Existing infrastructure

- Admin functionality.
- Administrative access controls.
- Audit infrastructure.
- AI provider management infrastructure.
- More detailed admin diagnostics.
- Import failure monitoring.
- Background worker monitoring.
- Provider health checks.
- System health dashboard.
- Application performance monitoring.
- Database health monitoring.
- Administrative security event review.
- Better operational logs.
- Automated maintenance tasks.

Admin functionality should remain separate from personal product discovery. It is not a public
marketplace management system.

## 17. Mobile and platform experience

**Status:** Future

- Improved mobile layouts.
- Dedicated mobile navigation.
- Mobile-friendly product importing.
- Native share-sheet importing where supported.
- Better touch interactions.
- Mobile product comparison.
- Responsive product galleries.
- Installable PWA.
- Offline viewing of cached personal data.
- Offline editing with synchronization.
- Background synchronization.
- Mobile push notifications where supported.
- Native iOS application.
- Native Android application.

These are longer-term possibilities, not prerequisites for the web application.

## 18. Browser integrations and automation

**Status:** Exploratory

- Browser extension.
- One-click product importing.
- Import current browser tab.
- Browser context-menu importing.
- Share-sheet integration.
- Bookmarklet.
- Personal API.
- API tokens.
- Webhooks.
- Automation integrations.
- Scheduled product refreshes.
- Import automation.
- Export automation.

## 19. Developer experience and open-source ecosystem

**Status:** Repository published

Since DerList is open-source, the project itself needs a good developer experience.

- Public GitHub repository.
- MIT license.
- README.
- Changelog.
- Existing test suite.
- TypeScript.
- ESLint.
- Automated build checks.
- Security regression tests.
- Contributor guide.
- Architecture documentation.
- API documentation.
- Database schema documentation.
- Self-hosting guide.
- Deployment guide.
- Environment variable reference.
- Troubleshooting documentation.
- Issue templates.
- Pull request templates.
- Contribution standards.
- Release automation.
- Versioned documentation.
- Reproducible deployment instructions.
- More integration tests.
- End-to-end testing.
- Multi-account browser testing.
- Accessibility testing.
- Performance testing.
- Dependency update automation.

## 20. Older ideas and explicitly excluded directions

**Status:** Historical — excluded or not in current scope

Some broader ideas appeared in earlier DerList planning. They are preserved here so the history
is not lost, but they are **not part of the current product commitment**.

| Older idea                           | Current decision     |
| ------------------------------------ | -------------------- |
| Public wishlist sharing              | Excluded             |
| Public/unlisted wishlist pages       | Removed              |
| Public product catalogue             | Excluded             |
| Cross-account product discovery      | Excluded             |
| Marketplace                          | Excluded             |
| Public product popularity statistics | Excluded             |
| Public beta/waitlist funnel          | Removed              |
| PC Builder                           | Not in current scope |
| Social features and following users  | Shelved              |
| Community product uploads            | Not in current scope |

The private product organizer direction takes priority over these older ideas.

## 21. Technical improvements that support everything

**Status:** Supporting infrastructure

These are not necessarily visible features, but they matter to the quality of the product.

- Next.js App Router architecture.
- React 19.
- TypeScript.
- Tailwind CSS.
- Prisma and PostgreSQL.
- Server-side actions.
- Route handlers.
- Session authentication.
- Background worker foundation.
- Docker Compose infrastructure.
- Caddy infrastructure.
- Automated tests.
- More robust background job processing.
- Persistent job status and recovery.
- Job retry and cancellation.
- Shared rate limiting for multiple instances.
- Better caching.
- Image optimization.
- Database performance optimization.
- Database backup automation.
- Database restore testing.
- Better error observability.
- Full end-to-end test coverage.
- Production deployment verification.
- Improved accessibility and performance budgets.

---

## Suggested implementation roadmap

This is how the full inventory can be grouped into meaningful releases. These are proposed
groupings, not promises or fixed release dates.

### v0.12.x — Security and reliability

**Published baseline.** Privacy fixes, authorization, upload security, repository cleanup, and
regression tests.

### v0.13.0 — Wishlist and organization

**Published 2026-11-19.** Bulk actions, archive/restore, wishlist duplication, manual collection
ordering, dashboard exclusions and the v0.13.0 release-hardening pass (metadata privacy,
archive-state deletion, category/move integrity, complete Copy options, lossless export) shipped
in this release. Nested collections, tags, activity history and further dashboard customization
remain planned.

### v0.14.0 — Open Beta and public registration

**Published 2026-11-19.** Public username/email registration, first-time GitHub/Google
registration, username-or-email sign-in, optional SMTP-backed email verification and password
recovery, rate-limited authentication endpoints, case-insensitive identity constraints, and
first-run onboarding without sample data.

### v0.14.1 — Container images and automated quality gate

**Published 2026-11-19.** Multi-platform GHCR images with immutable release tags, digest-first
verification, SBOM/provenance, a reusable CI gate covering E2E and security checks, CodeQL,
dependency review, Dependabot, and a published-image Compose example with backup/restore docs.

### v0.15.0 — Importing improvements

**In development.** Better extraction, import progress, retries, history, duplicate detection, and
re-identification.

### v0.16.0 — Search and comparison

Advanced private search, saved searches, product comparisons, and comparison reports.

### v0.17.0 — AI intelligence

Product identification, AI organization, and a useful personal product assistant.

### v0.18.0 — Price intelligence

Automatic refresh, price history, charts, retailer comparisons, and target-price monitoring.

### v0.19.0 — Research and notifications

Product research workspace, availability monitoring, reminders, and a notification center.

### v0.20.0 — Portability and personalization

More exports, restoration, advanced customization, and dashboard layouts.

### v1.0.0 — Complete personal product organizer

Mature experience, polished mobile layouts, documentation, accessibility, performance, and
reliable self-hosting.

---

## Master feature checklist

A broad inventory of the systems and capabilities above, including subfeatures and future
ideas. Item counts reflect the checklist bullets in each section of this document.

| #   | Feature area                        | Status                         | Items |
| --- | ----------------------------------- | ------------------------------ | ----: |
| 1   | Wishlist management                 | Existing foundation            |    35 |
| 2   | Product importing                   | Existing foundation, improving |    47 |
| 3   | Product management                  | Existing foundation            |    56 |
| 4   | Private search and organization     | Existing foundation, expanding |    29 |
| 5   | Product comparison                  | Planned                        |    16 |
| 6   | AI intelligence                     | Foundation, needs integration  |    47 |
| 7   | Price intelligence                  | Incomplete foundation          |    26 |
| 8   | Availability and research           | Planned                        |    19 |
| 9   | Notifications                       | Planned                        |    23 |
| 10  | Research workspace                  | Exploratory                    |    16 |
| 11  | Accounts and authentication         | Existing foundation            |    24 |
| 12  | Privacy and security                | Strong foundation              |    22 |
| 13  | Appearance and personalization      | Implemented foundation         |    23 |
| 14  | Dashboard and navigation            | Existing foundation, expanding |    20 |
| 15  | Data portability                    | Partial implementation         |    16 |
| 16  | Administration                      | Existing infrastructure        |    14 |
| 17  | Mobile and platforms                | Future                         |    14 |
| 18  | Browser integrations and automation | Exploratory                    |    13 |
| 19  | Developer experience                | Repository published           |    29 |
| 20  | Technical infrastructure            | Supporting infrastructure      |    25 |

**Total inventoried checklist items: 512.**

---

_This inventory is maintained as a planning reference. Status labels were last recorded on
2026-11-19 and should be re-checked against the codebase before being treated as definitive.
For the security and reliability baseline, see [AUDIT-REPORT.md](./AUDIT-REPORT.md)._
