````md
---
inclusion: auto
---

# DerList Architecture & Product Specification

> This document is the source of truth for DerList's product architecture, engineering principles, workflows, provider system, import pipeline, AI behavior, UI architecture, database direction, and long-term platform design.

---

# 1. Product Vision

DerList is an open-source, self-hosted universal wishlist and shopping platform.

It combines:

- Universal wishlists
- Product management
- Product research
- AI-assisted product identification
- Price tracking
- Seller comparison
- Shopping research
- PC building
- Product importing
- Sharing
- Notifications
- Automation
- Mobile and browser experiences

DerList should feel like a polished consumer application rather than a developer project.

The long-term goal is to create a self-hosted alternative to modern shopping and wishlist platforms without:

- Subscription requirements
- Advertising
- Vendor lock-in
- Forced AI usage
- Closed product databases
- Unnecessary data collection

AI is an enhancement to DerList, not a requirement.

---

# 2. Core Product Principles

## 2.1 AI Is Optional

Every important feature must work without AI.

AI should:

- Improve product identification
- Improve product research
- Fill missing information
- Organize products
- Help users research purchases
- Provide recommendations
- Assist with PC building

AI must never be required to:

- Create a product
- Edit a product
- Save a wishlist item
- Import basic product information
- Manage prices
- Manage sellers
- Use existing wishlists

If no AI provider is configured, DerList must gracefully fall back to deterministic systems or manual input.

---

## 2.2 The User Should Not Need to Understand the Pipeline

Users should never have to choose between:

- AI
- Search
- Import
- Scraping
- Manual entry
- Product lookup

DerList decides automatically.

The user experience should be:

```text
Paste anything
      ↓
DerList understands it
      ↓
DerList researches it
      ↓
DerList validates it
      ↓
ProductEditor opens
      ↓
User reviews
      ↓
Save
````

---

## 2.3 Never Invent Product Data

This is one of DerList's most important rules.

DerList must never invent:

* Product names
* Brands
* Models
* Prices
* Images
* ASINs
* UPCs
* MPNs
* SKUs
* Specifications
* Retailers
* Sellers

Unknown information should be:

```text
null
```

or omitted.

A partially completed product is better than incorrect product information.

---

## 2.4 Product Identity Is More Important Than Completeness

DerList must identify the correct product before trying to fill every field.

For example:

```text
User URL
    ↓
Amazon product
    ↓
ASIN extracted
    ↓
Search result found
    ↓
Search result has same ASIN
```

This does NOT automatically prove the product is correct.

DerList should verify:

* Product name
* Brand
* Model
* Manufacturer
* MPN
* UPC
* ASIN
* Product URL
* Retailer
* Specifications
* Images

Exact identifiers have higher priority than generic names.

---

# 3. User Experience

## 3.1 Add Product

The primary product creation experience uses one universal input.

```text
User opens wishlist
        ↓
Clicks Add
        ↓
"Paste anything..."
        ↓
System detects input
        ↓
Automatic pipeline
        ↓
ProductEditor
        ↓
User reviews
        ↓
Save
```

Examples:

```text
RTX 5070
```

```text
https://www.amazon.com/dp/XXXXXXXXXX
```

```text
https://pcpartpicker.com/list/XXXXXX
```

```text
Need a GPU under $600
```

```text
7800X3D
5070 Ti
32GB DDR5
```

An image may also be provided in supported clients.

---

# 3.2 Edit Product

Creating and editing products must use the same component.

```text
Existing product
      ↓
ProductEditor
      ↓
Edit
      ↓
Save
```

There must not be separate product-editing systems.

---

# 3.3 ProductEditor

`ProductEditor` is the canonical product creation and editing interface.

```text
ProductEditor

props:
  draft?: ProductDraft
  wishlistId: string
  mode: "create" | "edit"
  onSave: () => void
```

It must support:

* Product information
* Pricing
* Sellers
* Images
* Wishlist settings
* AI metadata
* Specifications
* Import history

---

# 4. Product Data Model

A DerList product should support the following information.

## Product Information

```text
Product Name
Brand
Manufacturer
Model
Category
Sub Category
SKU
UPC
ASIN
MPN
Product URL
Store URL
Description
Notes
Tags
```

## Pricing

```text
Current Price
Original Price / MSRP
Discount %
Deal Amount
Shipping
Tax
Coupon
Promo Code
Manual Pricing Lock
```

Manual pricing lock prevents automatic price refreshes from overwriting a user's manually entered price.

## Sellers

Each product may have multiple sellers.

Each seller can contain:

```text
Store
Price
Shipping
Tax
Coupon
Promo Code
Availability
Purchase URL
Preferred Seller
Verification Status
```

## Images

Products may contain multiple images.

Images must be:

* Validated
* HTTPS where possible
* SSRF protected
* Verified before being treated as trusted
* Associated with a source

## Wishlist

```text
Priority
Quantity
Desired Price
Purchase Status
Need By Date
Folder
Sub Folder
Category
Custom Labels
Wishlist Notes
```

## AI Metadata

```text
AI Confidence
Generated Tags
Suggested Category
Suggested Name
Research Sources
Field Sources
Research Timestamp
```

## Specifications

Specifications use:

```text
Name
Value
Unit
```

Example:

```json
{
  "name": "Memory",
  "value": "16",
  "unit": "GB"
}
```

---

# 5. Universal Import System

DerList uses a unified import pipeline.

```text
Input
 ↓
Detection
 ↓
Native Importer
 ↓
Normalization
 ↓
Validation
 ↓
AI Research if needed
 ↓
Search Evidence
 ↓
Merge
 ↓
Identity Verification
 ↓
Image Resolution
 ↓
Price Resolution
 ↓
Completeness
 ↓
ProductDraft
 ↓
ProductEditor
```

---

# 6. Importer Architecture

Importers are plugins.

```typescript
interface Importer {
  id: string;
  name: string;

  detect(
    input: string
  ): {
    match: boolean;
    confidence: number;
  };

  extract(
    input: string
  ): Promise<ProductDraft[]>;
}
```

Adding a new importer should require:

```text
1 file
+
registerImporter()
```

---

# 7. Supported Importers

The architecture should support:

```text
Amazon
Best Buy
Newegg
Walmart
PCPartPicker
Generic URL
Plain Text
CSV
JSON
Future retailer importers
```

---

# 8. Import Strategy

The pipeline should not blindly trust the first provider.

Preferred flow:

```text
1. Detect input
2. Native importer
3. Validate native result
4. If reliable → continue
5. If incomplete → AI research
6. Search for supporting evidence
7. Merge matching evidence
8. Verify identity
9. Resolve images
10. Resolve pricing
11. Calculate confidence
12. Calculate completeness
13. Return ProductDraft
```

Native extraction may be considered complete when the product identity is strongly verified.

---

# 9. AI Product Research

AI research is a major part of DerList.

When a URL cannot be reliably identified, DerList should provide the original URL to the configured AI provider.

The AI should be instructed to research the exact product represented by the URL.

---

# 10. AI Provider Architecture

AI providers must use a common interface.

```typescript
interface AIProvider {
  id: string;
  name: string;

  chat(
    messages: Message[],
    options?: AIOptions
  ): Promise<AIResponse>;

  isAvailable(): boolean;
}
```

Potential providers include:

```text
OpenRouter
OpenAI
Google Vertex AI
Future providers
```

DerList must not hard-code a single AI provider.

---

# 11. AI Provider Selection

ProviderManager controls provider selection.

```typescript
class ProviderManager {
  async getAIProvider(
    userId: string
  ): Promise<AIProvider | null>;

  async getSearchProvider(
    userId: string
  ): Promise<SearchProvider | null>;

  async getPriceProvider(
    userId: string
  ): Promise<PriceProvider | null>;
}
```

Providers are selected based on the user's configuration.

Fallback providers may be attempted automatically.

---

# 12. AI Research Prompt

When researching a product URL, the AI should be instructed to:

* Identify the exact product
* Research the supplied URL
* Prefer official manufacturer information
* Prefer official retailer information
* Verify product identifiers
* Compare multiple sources
* Avoid similarly named products
* Avoid unrelated search results
* Never invent missing values
* Return `null` when information cannot be verified
* Return structured JSON
* Include confidence
* Include sources
* Identify conflicts between sources

The original URL must always be included in the research request.

---

# 13. AI Research JSON

AI should return structured data similar to:

```json
{
  "product": {
    "name": null,
    "brand": null,
    "manufacturer": null,
    "model": null,
    "category": null,
    "subCategory": null,
    "sku": null,
    "upc": null,
    "asin": null,
    "mpn": null,
    "productUrl": null,
    "storeUrl": null,
    "description": null,
    "notes": null,
    "tags": [],
    "currentPrice": null,
    "originalPrice": null,
    "discountPercent": null,
    "dealAmount": null,
    "shipping": null,
    "tax": null,
    "coupon": null,
    "promoCode": null,
    "sellers": [],
    "images": [],
    "specifications": []
  },

  "metadata": {
    "confidence": 0,
    "suggestedName": null,
    "suggestedCategory": null,
    "generatedTags": [],
    "sources": [],
    "identityVerified": false
  }
}
```

---

# 14. AI Identity Verification

AI must verify that all returned information refers to the same product.

Example:

```text
Amazon URL
     ↓
AI researches URL
     ↓
Apple AirPods Max
     ↓
Search finds another product
     ↓
Identifiers conflict
     ↓
Do not merge
```

A matching ASIN alone should not automatically cause unrelated information to be accepted.

Identity verification should prioritize:

```text
UPC
MPN
ASIN
SKU
Model
Manufacturer
Brand
Product URL
Specifications
Product name
```

---

# 15. AI Confidence

AI confidence is from 0–100.

```text
90–100 = Highly confident
75–89  = Confident
50–74  = Needs review
25–49  = Low confidence
0–24   = Identification failed
```

Confidence does not override contradictory evidence.

Example:

```text
Confidence: 95
ASIN: conflict
Model: conflict

Result:
Needs review
```

---

# 16. No AI Provider

If no AI provider is configured:

```text
Native Import
     ↓
Search
     ↓
Reliable result?
 ├── YES → ProductEditor
 └── NO  → Manual ProductEditor
```

The user should receive a clear message:

> We couldn't automatically identify this product. Please enter the product details manually.

DerList must never pretend AI was used.

---

# 17. AI Provider Failure

If an AI provider fails:

```text
AI Provider A
      ↓
failure
      ↓
AI Provider B
      ↓
failure
      ↓
Search/native data
      ↓
Manual fallback
```

AI failure must never prevent product creation.

---

# 18. Search Provider Architecture

```typescript
interface SearchProvider {
  id: string;
  name: string;

  search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  isAvailable(): boolean;
}
```

Possible providers:

```text
SerpAPI
Brave Search
Future providers
```

Search results are evidence, not automatically trusted product records.

---

# 19. Search Strategy

For an Amazon ASIN:

```text
B0XXXXXXXX
B0XXXXXXXX Amazon
site:amazon.com B0XXXXXXXX
```

Search results should be ranked based on:

* Exact identifier
* Product name similarity
* Brand
* Model
* Retailer
* URL
* Specifications
* Source quality

---

# 20. Search Result Safety

Search providers must never be allowed to silently replace the user's product with a different product.

If search returns:

```text
User product:
Apple AirPods Max

Search:
Beats Solo 4
```

The result must be rejected.

Search evidence can support an identification but cannot override conflicting identity evidence.

---

# 21. Price Provider Architecture

```typescript
interface PriceProvider {
  id: string;
  name: string;

  getCurrentPrice(
    productId: string,
    idType: string
  ): Promise<PriceResult>;

  getPriceHistory(
    productId: string,
    idType: string,
    days: number
  ): Promise<PricePoint[]>;

  isAvailable(): boolean;
}
```

Potential providers:

```text
Keepa
Future price providers
```

---

# 22. Image Resolution

Image resolution is separate from product identification.

Preferred strategy:

```text
1. Trusted native image
2. Manufacturer image
3. Trusted retailer image
4. Keepa image
5. Search image
6. AI-provided candidate
7. No image
```

Images must never be invented.

---

# 23. Image Security

All external image URLs must pass:

* URL validation
* HTTPS validation where appropriate
* SSRF protection
* Private IP protection
* Localhost protection
* Metadata endpoint protection
* Port restrictions
* Redirect validation
* HTTP verification
* Content-Type validation

Blocked examples include:

```text
localhost
127.0.0.1
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.169.254
::1
.local
.internal
private network addresses
database ports
Redis ports
```

A broken image URL must never be presented as a verified image.

---

# 24. Keepa Image Provider

Keepa may provide Amazon image identifiers.

Example:

```text
Keepa
 ↓
imagesCSV
 ↓
Amazon image ID
 ↓
Amazon CDN URL
 ↓
HTTP verification
 ↓
Verified image
```

The Amazon ASIN must never be assumed to be the image ID.

---

# 25. Product Completeness

Completeness measures how much usable product information DerList has.

Example:

```text
Product Name       ✓
Brand              ✓
Model              ✓
Price              ✓
Category           ✓
Image              ✓
URL                ✓
Specifications     ✓

Completeness: 100%
```

Missing information should lower completeness.

Completeness and confidence are separate concepts.

```text
Confidence = "How sure are we this is the correct product?"

Completeness = "How much information do we have?"
```

Example:

```text
Confidence: 95%
Completeness: 60%
```

This is valid.

---

# 26. Field Source Tracking

Every important field should have a source.

Example:

```json
{
  "fieldSources": {
    "name": "ai-provider",
    "brand": "manufacturer",
    "model": "manufacturer",
    "currentPrice": "retailer",
    "image": "keepa",
    "asin": "user-input",
    "category": "ai-provider"
  }
}
```

Possible source values:

```text
user-input
native-importer
manufacturer
retailer
search-provider
ai-provider
price-provider
image-provider
```

User-entered values should take priority over automatic values.

---

# 27. Import Status

Products should expose import status.

Possible statuses:

```text
pending
researching
ready
needs-review
manual
failed
```

Example:

```text
Import Status: ready
Confidence: 92%
Completeness: 96%
```

or:

```text
Import Status: needs-review
Confidence: 63%
Completeness: 72%
```

---

# 28. Manual Fallback

Manual entry is always available.

If automatic identification fails:

```text
ProductEditor
 ↓
Known fields prefilled
 ↓
Unknown fields empty
 ↓
User enters remaining information
 ↓
Save
```

The user must never be blocked from adding a product because an external service failed.

---

# 29. PC Builder

PC Builder is a major DerList feature.

It should support:

* CPU
* GPU
* Motherboard
* RAM
* Storage
* PSU
* Case
* CPU cooler
* Case fans
* Operating system
* Peripherals
* Accessories

It should provide:

* Compatibility checking
* Socket compatibility
* RAM compatibility
* Motherboard compatibility
* GPU clearance
* Case compatibility
* PSU estimation
* Storage compatibility
* Cooler compatibility
* BIOS considerations
* Estimated total price
* Estimated wattage

---

# 30. PCPartPicker Import

Input:

```text
https://pcpartpicker.com/list/XXXX
```

Pipeline:

```text
PCPartPicker URL
 ↓
PCPartPicker importer
 ↓
Extract build
 ↓
Create WishlistCategory
 ↓
Create WishlistItems
 ↓
Attach build metadata
```

Category metadata may contain:

```text
Total Cost
Estimated Wattage
Compatibility
Source URL
Build Notes
```

---

# 31. Shopping Assistant

The Shopping Assistant is an AI-powered interface over DerList's product services.

Example:

```text
User:
Find me a 5070 Ti under $500
```

Assistant:

```text
AssistantService
 ↓
ProductService.search()
 ↓
Search providers
 ↓
Price providers
 ↓
Results
 ↓
User chooses product
 ↓
ProductEditor
 ↓
Save
```

The assistant must not directly write products to the database without user confirmation.

---

# 32. Wishlists

Wishlists support:

* Unlimited lists
* Categories
* Folders
* Priority
* Quantity
* Desired price
* Purchase status
* Need-by date
* Custom labels
* Notes
* Public/private/unlisted sharing

Purchase status:

```text
Wanted
Considering
Decided
Ordered
Purchased
```

Priority:

```text
Low
Medium
High
Critical / Must Have
```

---

# 33. Wishlist Sharing

Future sharing features include:

* Public wishlists
* Private wishlists
* Unlisted links
* Shared collections
* Gift registries
* User profiles
* Collaboration

Permissions must be explicit.

---

# 34. Price Tracking

Price tracking should support:

* Current price
* Historical price
* MSRP
* Lowest recorded price
* Highest recorded price
* Discount
* Seller comparison
* Shipping
* Tax
* Coupon
* Price alerts

Future:

```text
Price history charts
Price drop alerts
Lowest-price detection
Price predictions
Deal detection
```

---

# 35. Notifications

Future notifications may include:

```text
Price drop
Back in stock
Deal detected
Wishlist reminder
Need-by date
Product update
Shared wishlist activity
```

Notification providers should be modular.

---

# 36. Automation

Future automation features may include:

```text
When price drops below $X
    → notify user

When product becomes available
    → notify user

When wishlist item reaches target price
    → mark as deal

When new product matches saved search
    → add to research queue
```

Automation must be explicit and user-controlled.

---

# 37. Browser Extension

The browser extension should provide:

```text
Browse product
 ↓
Click DerList
 ↓
Detect page
 ↓
Import product
 ↓
Select wishlist
 ↓
Save
```

The extension should reuse the same backend import pipeline.

It must not implement its own separate product identification logic.

---

# 38. Mobile Applications

Native mobile applications should consume the same API.

They should not duplicate:

* Product logic
* Import logic
* Provider logic
* Pricing logic
* AI logic

The backend remains the source of truth.

---

# 39. PWA / Offline

Future PWA support should allow:

* Cached wishlists
* Offline browsing
* Offline editing
* Queued changes
* Synchronization when online

Conflict resolution must preserve user changes.

---

# 40. Database Architecture

Repositories are the only layer allowed to access Prisma.

```text
UI
 ↓
Server Action / API
 ↓
Service
 ↓
Repository
 ↓
Prisma
 ↓
PostgreSQL
```

Services must never import Prisma directly.

---

# 41. Repository Layer

Repositories include:

```text
ProductRepository
WishlistRepository
ProviderRepository
UserRepository
PriceRepository
```

Example:

```typescript
class ProductRepository {
  async findById(id: string) {}
  async create(data: ProductCreateData) {}
  async update(id: string, data: ProductUpdateData) {}
  async delete(id: string) {}
}
```

---

# 42. Service Layer

Services contain business logic.

Core services:

```text
ProductService
WishlistService
UniversalImportService
AssistantService
ProviderSettingsService
PriceTrackingService
NotificationService
```

Services receive dependencies.

Services must not construct repositories or providers internally.

---

# 43. Provider Manager

ProviderManager handles:

* Provider discovery
* Provider configuration
* Availability
* Fallback
* Provider selection
* Error handling
* Usage tracking

Example:

```typescript
class ProviderManager {
  constructor(
    private repository: ProviderRepository
  ) {}

  async getAIProvider(userId: string) {}
  async getSearchProvider(userId: string) {}
  async getPriceProvider(userId: string) {}
}
```

---

# 44. Dependency Injection

Services receive dependencies.

Example:

```typescript
class ProductService {
  constructor(
    private products: ProductRepository,
    private providers: ProviderManager
  ) {}
}
```

No service should instantiate another service.

---

# 45. Dependency Graph

```text
AssistantService
 ├── ProductService
 └── UniversalImportService

UniversalImportService
 ├── ProviderManager
 ├── ProductRepository
 └── ImporterRegistry

ProductService
 ├── ProductRepository
 └── ProviderManager

WishlistService
 ├── WishlistRepository
 └── ProductRepository

ProviderManager
 └── ProviderRepository
```

No circular dependencies.

---

# 46. Directory Structure

Preferred architecture:

```text
src/
├── app/
│   ├── api/
│   ├── dashboard/
│   ├── wishlist/
│   ├── settings/
│   └── ...
│
├── components/
│   ├── products/
│   ├── wishlist/
│   ├── providers/
│   ├── ai/
│   └── ui/
│
└── lib/
    ├── repositories/
    │   ├── product.ts
    │   ├── wishlist.ts
    │   ├── provider.ts
    │   └── index.ts
    │
    ├── providers/
    │   ├── types.ts
    │   ├── manager.ts
    │   ├── openrouter.ts
    │   ├── openai.ts
    │   ├── vertex.ts
    │   ├── serpapi.ts
    │   ├── brave.ts
    │   ├── keepa.ts
    │   └── index.ts
    │
    ├── services/
    │   ├── product.ts
    │   ├── wishlist.ts
    │   ├── import.ts
    │   ├── assistant.ts
    │   ├── provider.ts
    │   ├── price.ts
    │   └── notification.ts
    │
    ├── importers/
    │   ├── types.ts
    │   ├── registry.ts
    │   ├── amazon.ts
    │   ├── bestbuy.ts
    │   ├── newegg.ts
    │   ├── walmart.ts
    │   ├── pcpartpicker.ts
    │   ├── generic-url.ts
    │   ├── text.ts
    │   ├── csv.ts
    │   └── index.ts
    │
    ├── identification/
    │   ├── pipeline.ts
    │   ├── types.ts
    │   ├── validation.ts
    │   ├── completeness.ts
    │   ├── logging.ts
    │   └── image-resolution.ts
    │
    └── import-pipeline.ts
```

---

# 47. UI Architecture

UI components should contain presentation logic.

They should not contain:

* Prisma queries
* Provider API calls
* Product identification logic
* Price calculations
* Database mutation logic

UI calls:

```text
Server Action
 ↓
Service
 ↓
Repository / Provider
```

---

# 48. UniversalInput

`UniversalInput` is the primary entry point for product creation.

It should:

* Accept text
* Accept URLs
* Accept shopping lists
* Detect input type
* Show progress
* Display useful errors
* Open ProductEditor
* Never force the user to select a provider

---

# 49. AI Research UI

When AI is researching:

```text
Researching product...

✓ Detecting product
✓ Reading product URL
✓ Searching supporting sources
● Verifying product identity
○ Resolving image
○ Resolving price
```

The UI should show meaningful progress.

It should not expose internal provider complexity unless useful.

---

# 50. Live Updates

Long-running operations should support live progress updates.

Examples:

```text
research.started
research.stage
research.provider
research.completed
research.failed
wishlist.item.added
product.updated
price.updated
```

Server-Sent Events or another suitable realtime mechanism may be used.

---

# 51. Security

DerList must prioritize security.

Requirements include:

* Argon2id password hashing
* Secure session tokens
* HttpOnly cookies
* SameSite protection
* CSRF protection where applicable
* Server-side authorization
* Input validation
* Zod schemas
* SSRF protection
* Provider secret encryption
* Rate limiting
* Audit logging
* Safe external URL fetching

Provider API keys must never be exposed to clients.

---

# 52. SSRF Protection

Any server-side request to a user-controlled URL must validate:

```text
Protocol
Hostname
Resolved IP
Port
Redirect destination
```

Block:

```text
localhost
127.0.0.1
0.0.0.0
::1
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
IPv6 private ranges
.local
.internal
cloud metadata endpoints
database ports
Redis ports
```

SSRF protection applies to:

* Product URLs
* Images
* Web pages
* AI research sources
* Importers
* External APIs where applicable

---

# 53. Observability

Important operations should produce structured logs.

Example:

```text
IMPORT_STARTED
IMPORTER_SELECTED
NATIVE_EXTRACTION
AI_RESEARCH_STARTED
AI_RESEARCH_COMPLETED
SEARCH_STARTED
SEARCH_RESULT
IDENTITY_VERIFICATION
IMAGE_RESOLUTION
PRICE_RESOLUTION
IMPORT_COMPLETED
IMPORT_FAILED
```

Logs must never contain:

* API keys
* Passwords
* Session tokens
* OAuth secrets
* Sensitive user data

---

# 54. Testing

Every major subsystem requires tests.

Minimum expectations:

```text
Unit tests
Integration tests
Provider tests
Importer tests
Security tests
End-to-end tests
```

Critical workflows must have E2E coverage.

---

# 55. Product Import Test Requirements

A real product URL test should verify:

```text
URL accepted
Retailer detected
Product identity extracted
Product identity verified
Search fallback works
AI fallback works
No incorrect product merged
Price verified
Brand verified
Category verified
Image verified
Confidence calculated
Completeness calculated
Field sources recorded
ProductEditor receives correct draft
Wishlist save works
Live event fires
```

---

# 56. Failure Behavior

DerList should fail gracefully.

Bad:

```text
Amazon blocked
→ Error
→ Product cannot be added
```

Good:

```text
Amazon blocked
→ Native extraction failed
→ AI research
→ Search evidence
→ Validation
→ ProductEditor
→ Manual correction if necessary
```

If everything fails:

```text
ProductEditor
→ URL preserved
→ Known fields preserved
→ Unknown fields blank
→ User can continue manually
```

---

# 57. Performance

DerList should prioritize responsiveness.

Important principles:

* Avoid unnecessary provider calls
* Cache safe results
* Run independent requests concurrently
* Use timeouts
* Use provider fallback
* Avoid repeated database queries
* Avoid unnecessary AI calls
* Prefer deterministic extraction before AI

AI-heavy operations may run asynchronously when appropriate.

---

# 58. Data Preservation

Existing user data must be preserved during architecture changes whenever possible.

Database migrations should:

* Avoid destructive changes
* Preserve existing products
* Preserve wishlists
* Preserve users
* Preserve price history
* Provide migration paths for deprecated fields

Never delete user data simply to simplify a rewrite.

---

# 59. Deprecated Architecture

The following systems should not be recreated:

```text
src/lib/ai/
src/lib/import/
src/lib/products/product-getter.ts
src/lib/products/shopping-search.ts
src/lib/products/price-tracking.ts
duplicate provider registries
duplicate provider settings systems
god-object service managers
```

The new architecture should use:

```text
Providers
Repositories
Services
Importers
Import Pipeline
```

---

# 60. Database Direction

Keep core models such as:

```text
Product
WishlistItem
Wishlist
WishlistCategory
WishlistMember
PriceHistory
ProductFetchJob
ProductChange
ProviderConfiguration
ProviderUsage
ShoppingConversation
ShoppingMessage
User
Session
OAuthAccount
Invitation
Waitlist
AuditLog
Media
```

Deprecated provider-specific user tables should be removed once migration paths exist.

The unified provider configuration system should be the source of truth.

---

# 61. WishlistCategory

`WishlistCategory` can represent both folders and PC builds.

Example:

```prisma
model WishlistCategory {
  name              String
  description       String?
  externalLink      String?
  externalLinkLabel String?
  notes             String?
  icon              String?
}
```

Future build metadata may move into:

```text
metadata Json?
```

---

# 62. API Architecture

API routes should be thin.

Preferred:

```text
API Route
 ↓
Validate request
 ↓
Authenticate user
 ↓
Call service
 ↓
Return response
```

Avoid:

```text
API Route
 ↓
Prisma
 ↓
Provider
 ↓
Business logic
 ↓
AI
 ↓
More Prisma
```

Business logic belongs in services.

---

# 63. Server Actions

Server Actions may be used for UI mutations.

They should:

* Authenticate
* Validate
* Call services
* Return typed results

They should not contain large business workflows.

---

# 64. Product Lifecycle

A product moves through:

```text
Input
 ↓
Draft
 ↓
Researching
 ↓
Identified
 ↓
Needs Review
 ↓
Saved
 ↓
Tracked
 ↓
Purchased
```

Products may move backward when information changes.

---

# 65. Long-Term Platform

DerList is intended to grow into a full shopping platform.

Major areas include:

```text
Wishlists
Product Research
AI
Price Tracking
Universal Import
Shopping Assistant
PC Builder
Sharing
Gift Registries
Browser Extension
Notifications
Offline
Mobile
Automation
Social Features
```

All of these should use the same underlying product and provider architecture.

---

# 66. Roadmap Philosophy

DerList follows incremental releases.

```text
0.10
Core public alpha

0.11
Core expansion + AI research foundation

0.11.x
Fixes and stabilization

0.12
AI intelligence improvements

0.13
Product intelligence

0.14
Pricing intelligence

0.15
Wishlist intelligence

0.16
Advanced price tracking

0.17
Universal importing

0.18
AI shopping assistant

0.19
Sharing

0.20
Gift registries

0.21
Browser extension

0.22
Notifications

0.23
Offline / PWA

0.30
Free PC Builder

0.40
Advanced PC Builder

0.50
Mobile applications

0.60
Advanced AI

0.70
Social & collaboration

0.80
Automation

0.90
Production readiness

1.0
Stable release

1.01–1.10
Continuous improvements

1.11–1.19
Platform expansion

1.20
Major roadmap milestone

1.21+
Future development
```

---

# 67. Version Philosophy

Minor versions represent meaningful product milestones.

Patch versions represent:

* Bug fixes
* Reliability improvements
* Small UX improvements
* Importer fixes
* Provider fixes
* Security fixes

Example:

```text
0.11.0
AI Research Update

0.11.1
AI research fixes

0.11.2
Amazon importer fixes

0.11.5
Product Importer Fix

0.12.0
AI Intelligence Improvements
```

---

# 68. Engineering Rules

Before implementing a feature, ask:

1. Does this belong in a service?
2. Does this belong in a provider?
3. Does this belong in an importer?
4. Does this belong in a repository?
5. Does this create a circular dependency?
6. Does this duplicate existing functionality?
7. Does this preserve existing user data?
8. Does this work without AI?
9. What happens if the provider fails?
10. What happens if the external website blocks us?
11. Can the system fall back to another method?
12. Can the user still complete the task manually?

---

# 69. Absolute Rules

These rules override convenience.

### Never invent data.

### Never silently substitute a different product.

### Never trust a search result simply because an identifier matches.

### Never require AI for basic functionality.

### Never expose provider secrets.

### Never bypass SSRF protection.

### Never put Prisma queries directly in UI components.

### Never put business logic directly in API routes.

### Never create duplicate product editors.

### Never create provider-specific business logic inside products.

### Never make external providers a hard dependency for basic product creation.

### Never destroy existing user data to simplify architecture.

### Always provide a manual fallback.

### Always validate external data before storing it.

### Always preserve field sources when possible.

### Always distinguish confidence from completeness.

---

# 70. Definition of a Good DerList Feature

A feature is considered complete when:

```text
✓ Works for normal users
✓ Works without AI where practical
✓ Handles provider failure
✓ Handles invalid input
✓ Has a manual fallback
✓ Validates external data
✓ Preserves user data
✓ Has appropriate security protections
✓ Has tests
✓ Has useful error messages
✓ Fits the existing architecture
✓ Does not duplicate existing systems
✓ Works on desktop and mobile layouts
✓ Does not require users to understand internal architecture
```

---

# 71. Final Architecture

The overall DerList architecture should remain:

```text
                         ┌──────────────────┐
                         │      UI          │
                         │ Next.js / React  │
                         └────────┬─────────┘
                                  │
                                  ▼
                       ┌────────────────────┐
                       │ Server Actions/API │
                       └─────────┬──────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │     Services       │
                       │                    │
                       │ ProductService     │
                       │ WishlistService    │
                       │ ImportService      │
                       │ AssistantService   │
                       └───────┬─────┬──────┘
                               │     │
                 ┌─────────────┘     └─────────────┐
                 ▼                                 ▼
       ┌──────────────────┐              ┌──────────────────┐
       │   Repositories   │              │ ProviderManager  │
       │                  │              │                  │
       │ Product          │              │ AI               │
       │ Wishlist         │              │ Search           │
       │ Provider         │              │ Price            │
       │ etc.             │              │ Image            │
       └────────┬─────────┘              └────────┬─────────┘
                │                                 │
                ▼                                 ▼
        ┌──────────────┐             ┌────────────────────────┐
        │  PostgreSQL  │             │ External Providers     │
        │   + Prisma   │             │                        │
        └──────────────┘             │ OpenRouter             │
                                     │ OpenAI                  │
                                     │ Vertex AI               │
                                     │ SerpAPI                 │
                                     │ Brave                   │
                                     │ Keepa                   │
                                     │ Retailers               │
                                     │ Manufacturers           │
                                     └────────────────────────┘
```

The universal product workflow is:

```text
                     USER INPUT
                         │
                         ▼
                 ┌───────────────┐
                 │ UniversalInput│
                 └───────┬───────┘
                         │
                         ▼
                  Detect Input
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       URL           Product Name    Shopping List
          │              │              │
          ▼              ▼              ▼
     Importer        Search/AI       Text Importer
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                  Product Research
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           Native       AI        Search
              │          │          │
              └──────────┼──────────┘
                         ▼
                  Identity Check
                         │
                  ┌──────┴──────┐
                  │             │
                Valid        Uncertain
                  │             │
                  │             ▼
                  │       Manual Review
                  │
                  ▼
              Enrichment
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      Image     Price    Metadata
        │         │         │
        └─────────┼─────────┘
                  ▼
          Confidence +
          Completeness
                  │
                  ▼
             ProductDraft
                  │
                  ▼
            ProductEditor
                  │
                  ▼
              User Review
                  │
                  ▼
             Save Wishlist
                  │
                  ▼
          Price Tracking /
          Notifications /
          Assistant /
          PC Builder /
          Sharing
```

**This architecture should guide all future DerList development.**

When adding new functionality, extend the existing systems rather than creating parallel systems. DerList should continue moving toward one unified product model, one product editor, one import pipeline, one provider architecture, and one consistent user experience.