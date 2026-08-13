# Changelog

All notable changes to DerList will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

DerList is developed through frequent incremental releases. **v0.10.0 established most of the core platform, v0.11.0 expanded and improved that foundation, and future releases will continue refining existing systems while introducing new capabilities.**

The current roadmap targets **v1.20.0 as the point where all currently planned major features are expected to be available**, with additional features continuing beyond v1.20.0.

---

# [0.11.5] — Product Importer Fix

## 🚧 Current Development

### AI Product Research

* [x] URL-based product identification
* [x] ASIN extraction
* [x] Search-provider fallback
* [x] AI enrichment
* [x] Product validation
* [x] Confidence scoring
* [x] Completeness scoring
* [x] Per-field source tracking
* [x] Import status tracking
* [x] Image validation
* [x] SSRF protection
* [x] Keepa image-provider architecture
* [ ] AI research directly from product URLs
* [ ] AI product identity verification
* [ ] AI instructed to research the provided URL/product
* [ ] Better product research prompts
* [ ] Structured AI JSON product output
* [ ] Full product-field extraction
* [ ] Better AI JSON validation
* [ ] Better handling of incorrect search results
* [ ] Cross-check AI results against the original URL
* [ ] AI research source tracking
* [ ] AI confidence improvements
* [ ] AI-generated product specifications
* [ ] AI-generated tags
* [ ] AI-suggested categories
* [ ] AI-suggested product names
* [ ] AI-generated descriptions
* [ ] AI product image research
* [ ] AI pricing research
* [ ] AI seller research
* [ ] Manual fallback when no AI provider is configured
* [ ] Clear message when manual product entry is required
* [ ] Never use the URL as the product name
* [ ] Never invent missing product information

### Product Information

* [x] Product name
* [x] Brand
* [x] Category
* [x] Product URL
* [x] Retailer
* [x] ASIN detection
* [ ] Model
* [ ] Subcategory
* [ ] SKU
* [ ] UPC
* [ ] MPN
* [ ] Store URL
* [ ] Description
* [ ] Notes
* [ ] Tags
* [ ] Product specifications
* [ ] Better product identifier matching

### Pricing

* [x] Current price detection
* [x] Currency detection
* [x] Price validation
* [ ] Original price / MSRP
* [ ] Discount percentage
* [ ] Deal amount
* [ ] Shipping
* [ ] Tax
* [ ] Coupon
* [ ] Promo code
* [ ] Manual pricing lock
* [ ] Multi-seller pricing

### Images

* [x] Search image candidates
* [x] Image validation
* [x] HTTP verification
* [x] SSRF protection
* [x] Google thumbnail rejection
* [x] Keepa image-provider architecture
* [ ] Keepa image lookup
* [ ] AI image research
* [ ] Multiple verified image candidates
* [ ] Primary image selection
* [ ] Image source tracking
* [ ] Image fallback handling

### Wishlist Integration

* [x] Identified product → Product Editor
* [x] Product Editor → Wishlist
* [ ] AI metadata saved with product
* [ ] AI research history
* [ ] Research source history
* [ ] Product changes tracked
* [ ] Live panel updates during import
* [ ] Import progress stages
* [ ] Import failure recovery

---

## 🧪 Testing

* [x] Unit tests
* [x] Product validation tests
* [x] ASIN extraction tests
* [x] Search-provider tests
* [x] AI-provider tests
* [x] Image validation tests
* [x] SSRF protection tests
* [x] Completeness tests
* [x] Live Amazon identification test
* [ ] Full AI URL research test
* [ ] Full wishlist insertion test
* [ ] Live panel update test
* [ ] Multi-provider fallback test
* [ ] No-AI-provider manual fallback test
* [ ] Incorrect product identification test
* [ ] End-to-end product research test

---

## 🐞 Bug Fixes

* [x] Amazon URL incorrectly becoming product name
* [x] Generic `Amazon.com` product names
* [x] Invalid default pricing
* [x] Incorrect retailer detection
* [x] Google thumbnail images being accepted
* [x] Broken Amazon image URLs being accepted
* [x] Missing image verification
* [x] Missing field source tracking
* [x] Missing import status
* [ ] Incorrect product returned for valid ASIN
* [ ] AI identifying a different product than the supplied URL
* [ ] Search result overriding the correct product identity
* [ ] AI output containing incomplete JSON
* [ ] AI returning unverifiable product information

---

## 📌 Release Goal

**v0.11.5 should make product importing reliable enough that:**

> **URL → AI researches the exact product → structured product data → verification → Product Editor → Wishlist**

If no AI provider is available:

> **URL → importer attempts identification → user is clearly asked to enter the product details manually**

No fabricated product information, no incorrect product matches, and no URL-as-product-name fallback.

---

# [0.12.0] — AI Intelligence Update

### 🤖 AI Improvements

v0.12.0 focuses primarily on **making the existing AI systems significantly smarter and more reliable** rather than introducing a large number of unrelated features.

### Product Research

* [ ] AI researches the supplied product URL
* [ ] AI identifies the exact product
* [ ] AI verifies product identity before accepting information
* [ ] AI extracts structured product information
* [ ] AI extracts brand
* [ ] AI extracts model
* [ ] AI extracts SKU
* [ ] AI extracts UPC
* [ ] AI extracts ASIN
* [ ] AI extracts MPN
* [ ] AI extracts category
* [ ] AI extracts subcategory
* [ ] AI extracts specifications
* [ ] AI extracts description
* [ ] AI extracts pricing
* [ ] AI extracts sellers
* [ ] AI extracts images

### AI Reliability

* [ ] Better AI prompts
* [ ] Strict JSON schema validation
* [ ] Invalid-response recovery
* [ ] Hallucination detection
* [ ] Product identity verification
* [ ] Conflicting-source detection
* [ ] Confidence improvements
* [ ] Better AI error handling
* [ ] Automatic retry handling
* [ ] Provider fallback improvements

### AI Providers

* [ ] Better OpenAI integration
* [ ] Better OpenRouter integration
* [ ] Improved model selection
* [ ] Automatic model fallback
* [ ] Provider health detection
* [ ] Provider-specific prompts
* [ ] Model capability detection

### User Experience

* [ ] Better AI research progress
* [ ] Live research stages
* [ ] Research source display
* [ ] AI confidence display
* [ ] Clear manual-entry fallback
* [ ] Better research errors
* [ ] Research cancellation

---

# [0.13.0] — Product Intelligence Update

### Product Data

* [ ] Improved product editor
* [ ] Better specifications
* [ ] Product metadata improvements
* [ ] Better product identifiers
* [ ] Better categories
* [ ] Better tags
* [ ] Product relationships
* [ ] Product variants

### AI

* [ ] Automatic categorization
* [ ] Automatic tagging
* [ ] Better product names
* [ ] Better descriptions
* [ ] Specification normalization
* [ ] Duplicate product detection

---

# [0.14.0] — Pricing Intelligence Update

### Pricing

* [ ] Better price extraction
* [ ] MSRP detection
* [ ] Sale price detection
* [ ] Discount calculation
* [ ] Shipping detection
* [ ] Tax detection
* [ ] Coupon detection
* [ ] Promo code detection
* [ ] Manual price locking

### Sellers

* [ ] Multiple sellers
* [ ] Seller comparison
* [ ] Seller availability
* [ ] Seller verification
* [ ] Preferred seller

---

# [0.15.0] — Wishlist Intelligence Update

### Wishlist

* [ ] Smarter organization
* [ ] AI folder suggestions
* [ ] AI category suggestions
* [ ] AI duplicate detection
* [ ] Better priority system
* [ ] Better wishlist filtering
* [ ] Better search
* [ ] Better sorting
* [ ] Wishlist analytics

---

# [0.16.0] — Price Tracking Update

### 📈 Price Tracking

* [ ] Automatic price refresh
* [ ] Price history
* [ ] Price charts
* [ ] Lowest price tracking
* [ ] Highest price tracking
* [ ] Average price
* [ ] Price-drop detection
* [ ] Retailer comparison

### Alerts

* [ ] Price-drop alerts
* [ ] Desired-price alerts
* [ ] Back-in-stock alerts
* [ ] Deal alerts

---

# [0.17.0] — Universal Import Update

### Importing

* [ ] Amazon
* [ ] Best Buy
* [ ] Newegg
* [ ] Walmart
* [ ] PCPartPicker
* [ ] Generic retailer URLs
* [ ] CSV
* [ ] JSON
* [ ] Plain text
* [ ] Shopping lists
* [ ] Multiple URLs

### Import Improvements

* [ ] Batch importing
* [ ] Import progress
* [ ] Import history
* [ ] Failed-item recovery
* [ ] Duplicate detection
* [ ] Import preview
* [ ] AI-assisted importing

---

# [0.18.0] — AI Shopping Assistant

### 🤖 Shopping Assistant

* [ ] Product comparisons
* [ ] Product recommendations
* [ ] Alternative products
* [ ] Similar products
* [ ] Best-value detection
* [ ] Feature comparison
* [ ] Specification comparison
* [ ] AI buying advice
* [ ] Deal analysis

---

# [0.19.0] — Sharing Update

### Public & Shared Wishlists

* [ ] Public wishlists
* [ ] Private wishlists
* [ ] Shared wishlists
* [ ] Read-only sharing
* [ ] Public product pages
* [ ] Open Graph previews
* [ ] Share links

---

# [0.20.0] — Gift Registry Update

### 🎁 Gift Registries

* [ ] Gift registries
* [ ] Registry sharing
* [ ] Gift reservations
* [ ] Purchased-item tracking
* [ ] Registry privacy
* [ ] Gift suggestions

---

# [0.21.0] — Browser Extension

### 🌐 Browser Extension

* [ ] Chrome
* [ ] Edge
* [ ] Firefox
* [ ] Safari
* [ ] Detect products
* [ ] Add product
* [ ] AI identification
* [ ] Wishlist selection
* [ ] Price capture

---

# [0.22.0] — Notifications

### 🔔 Notifications

* [ ] In-app notifications
* [ ] Email notifications
* [ ] Price alerts
* [ ] Stock alerts
* [ ] Wishlist notifications
* [ ] AI research notifications
* [ ] Notification preferences

---

# [0.23.0] — Offline & PWA

### Offline

* [ ] Progressive Web App
* [ ] Offline wishlist access
* [ ] Offline product viewing
* [ ] Offline edits
* [ ] Sync queue
* [ ] Conflict resolution

---

# [0.30.0] — Free PC Builder

### 🖥️ PC Builder

* [ ] CPU
* [ ] GPU
* [ ] Motherboard
* [ ] RAM
* [ ] Storage
* [ ] PSU
* [ ] Case
* [ ] CPU cooler
* [ ] Case fans
* [ ] Accessories

### Compatibility

* [ ] CPU socket
* [ ] RAM compatibility
* [ ] Motherboard compatibility
* [ ] GPU clearance
* [ ] Case clearance
* [ ] PSU wattage
* [ ] PSU connectors
* [ ] Cooler compatibility
* [ ] Storage compatibility
* [ ] BIOS compatibility

### Build Analysis

* [ ] Compatibility checking
* [ ] Power estimation
* [ ] Build validation
* [ ] Bottleneck detection
* [ ] Build sharing
* [ ] Build saving

---

# [0.40.0] — Advanced PC Builder

* [ ] Build optimization
* [ ] Component alternatives
* [ ] Performance estimates
* [ ] Value scoring
* [ ] AI build recommendations
* [ ] Upgrade recommendations
* [ ] Build comparison
* [ ] Build history

---

# [0.50.0] — Mobile Apps

### 📱 Mobile

* [ ] iOS
* [ ] Android
* [ ] Mobile wishlist
* [ ] Barcode scanning
* [ ] Product scanning
* [ ] AI product identification
* [ ] Price tracking
* [ ] Push notifications
* [ ] Mobile PC Builder

---

# [0.60.0] — Advanced AI

### 🧠 AI Platform

* [ ] More AI providers
* [ ] Local AI support
* [ ] Automatic provider selection
* [ ] Automatic model selection
* [ ] Deep research
* [ ] Product comparison
* [ ] Deal analysis
* [ ] Compatibility analysis
* [ ] Purchase recommendations
* [ ] AI wishlist organization

---

# [0.70.0] — Social & Collaboration

* [ ] Shared collections
* [ ] Collaborative wishlists
* [ ] Family wishlists
* [ ] Team wishlists
* [ ] Permissions
* [ ] Comments
* [ ] Activity history
* [ ] Public profiles
* [ ] Community collections

---

# [0.80.0] — Automation

* [ ] Automatic product enrichment
* [ ] Automatic price refresh
* [ ] Automatic image refresh
* [ ] Automatic seller refresh
* [ ] Automatic categorization
* [ ] Automatic duplicate merging
* [ ] Scheduled AI research
* [ ] Scheduled price checks
* [ ] Automation rules

---

# [0.90.0] — Production Readiness

### Security

* [ ] Security audit
* [ ] Authentication hardening
* [ ] Session security
* [ ] API security
* [ ] Rate limiting
* [ ] Input validation
* [ ] Permission auditing

### Reliability

* [ ] Automated backups
* [ ] Database recovery
* [ ] Monitoring
* [ ] Error tracking
* [ ] Disaster recovery
* [ ] Health monitoring

### Performance

* [ ] Database optimization
* [ ] API optimization
* [ ] AI request optimization
* [ ] Caching
* [ ] Background workers
* [ ] Queue system

---

# [1.0.0] — DerList Stable

### 🎉 Stable Release

DerList officially leaves the alpha/pre-release phase.

### Core Platform

* [ ] Universal wishlists
* [ ] Product management
* [ ] AI product research
* [ ] Price tracking
* [ ] Multi-seller support
* [ ] Universal importing
* [ ] Public sharing
* [ ] PC Builder
* [ ] Notifications
* [ ] Mobile support

### Stability

* [ ] Stable API
* [ ] Stable database
* [ ] Production authentication
* [ ] Production security
* [ ] Complete documentation
* [ ] Migration system
* [ ] Backup system
* [ ] Monitoring
* [ ] Error recovery

---

# [1.01.0 – 1.10.0] — Continuous Improvement

These releases focus primarily on **updating and improving existing systems** rather than following a rigid feature-per-version structure.

### Planned Improvements

* [ ] AI accuracy improvements
* [ ] Faster AI research
* [ ] Better product matching
* [ ] Better image matching
* [ ] Better price accuracy
* [ ] More retailers
* [ ] Better PC compatibility
* [ ] Better mobile experience
* [ ] Performance improvements
* [ ] UI improvements
* [ ] Accessibility improvements
* [ ] Security improvements
* [ ] Bug fixes
* [ ] Quality-of-life improvements

New features may also be introduced throughout these releases.

---

# [1.11.0 – 1.19.0] — Platform Expansion

### Planned

* [ ] Additional AI providers
* [ ] Additional retailers
* [ ] International shopping
* [ ] International currencies
* [ ] Advanced price intelligence
* [ ] Advanced product research
* [ ] Advanced PC Builder
* [ ] More automation
* [ ] More integrations
* [ ] Developer API
* [ ] Webhooks
* [ ] Advanced analytics
* [ ] Advanced sharing
* [ ] Improved mobile applications
* [ ] Improved browser extension

---

# [1.20.0] — 🚀 DerList Major Platform Milestone

**Target: All currently planned major features should be available by v1.20.0.**

This does **not** mean development stops at v1.20.0. It represents the completion of the current major roadmap.

### By v1.20.0

#### 🛍️ Shopping

* [ ] Universal wishlist
* [ ] Product management
* [ ] Universal importing
* [ ] Multi-retailer support
* [ ] Multi-seller support
* [ ] Price tracking
* [ ] Price history
* [ ] Price alerts
* [ ] Deal detection
* [ ] Public wishlists
* [ ] Shared wishlists
* [ ] Gift registries

#### 🤖 AI

* [ ] AI product research
* [ ] Multiple AI providers
* [ ] Deep research
* [ ] Product verification
* [ ] Product comparison
* [ ] AI shopping assistant
* [ ] AI recommendations
* [ ] AI categorization
* [ ] AI organization
* [ ] AI deal analysis
* [ ] AI compatibility analysis

#### 🖥️ PC Builder

* [ ] Complete PC Builder
* [ ] Compatibility engine
* [ ] Power estimation
* [ ] Performance analysis
* [ ] Bottleneck detection
* [ ] Build optimization
* [ ] AI PC Builder
* [ ] Build sharing

#### 📱 Platforms

* [ ] Web
* [ ] iOS
* [ ] Android
* [ ] Browser extension
* [ ] PWA/offline support

#### 🔔 Automation

* [ ] Automatic enrichment
* [ ] Automatic price tracking
* [ ] Automatic product updates
* [ ] Scheduled AI research
* [ ] Notifications
* [ ] Automation rules

#### 🔐 Infrastructure

* [ ] Production security
* [ ] Backups
* [ ] Monitoring
* [ ] Disaster recovery
* [ ] Developer API
* [ ] Webhooks
* [ ] Complete documentation

---

# [1.21.0+] — Beyond the Roadmap

**Development continues.**

v1.20.0 is not the end of DerList.

Future releases may introduce completely new systems based on user feedback, new technology, and ideas that are not currently part of the roadmap.

Possible future directions include:

* [ ] Advanced shopping automation
* [ ] AI agents
* [ ] Autonomous deal hunting
* [ ] Smart purchasing workflows
* [ ] More marketplaces
* [ ] More international support
* [ ] Community-powered product data
* [ ] Advanced analytics
* [ ] New DerList platform integrations
* [ ] New AI capabilities
* [ ] New applications and clients
* [ ] Features not yet imagined

---

# Version History

| Version       | Focus                                    | Status     |
| ------------- | ---------------------------------------- | ---------- |
| **0.10.0**    | First Public Alpha / Core Platform       | Released   |
| **0.11.0**    | AI Research + Core Expansion             | Released   |
| **0.11.5**    | **Product Importer + AI Research Fixes** | 🚧 Current |
| **0.12.0**    | AI Intelligence Improvements             | Upcoming   |
| **0.13.0**    | Product Intelligence                     | Planned    |
| **0.14.0**    | Pricing Intelligence                     | Planned    |
| **0.15.0**    | Wishlist Intelligence                    | Planned    |
| **0.16.0**    | Price Tracking                           | Planned    |
| **0.17.0**    | Universal Importing                      | Planned    |
| **0.18.0**    | AI Shopping Assistant                    | Planned    |
| **0.19.0**    | Sharing                                  | Planned    |
| **0.20.0**    | Gift Registries                          | Planned    |
| **0.21.0**    | Browser Extension                        | Planned    |
| **0.22.0**    | Notifications                            | Planned    |
| **0.23.0**    | Offline / PWA                            | Planned    |
| **0.30.0**    | Free PC Builder                          | Planned    |
| **0.40.0**    | Advanced PC Builder                      | Planned    |
| **0.50.0**    | Mobile Apps                              | Planned    |
| **0.60.0**    | Advanced AI                              | Planned    |
| **0.70.0**    | Social & Collaboration                   | Planned    |
| **0.80.0**    | Automation                               | Planned    |
| **0.90.0**    | Production Readiness                     | Planned    |
| **1.0.0**     | Stable Release                           | Planned    |
| **1.01–1.10** | Continuous Improvements                  | Planned    |
| **1.11–1.19** | Platform Expansion                       | Planned    |
| **1.20.0**    | **Major Roadmap Milestone**              | 🎯 Target  |
| **1.21.0+**   | **Future / New Features**                | Future     |

### Release philosophy

**0.10 → 0.11:** Build the foundation and expand it.
**0.12 → 0.90:** Continuously improve the platform while introducing major features.
**1.0:** DerList becomes stable.
**1.01 → 1.20:** Keep building toward the complete planned platform.
**1.20:** Current roadmap complete.
**1.21+:** New ideas, new technology, and whatever comes next.

With roughly **109 version increments between the current development line and v1.20**, the roadmap is intentionally designed around **frequent small releases rather than waiting months for huge version jumps**. At roughly 1–2 weeks per meaningful update, that puts the current roadmap in the neighborhood of **1–2 years of development**, while still allowing releases to move faster or slower depending on the work.
