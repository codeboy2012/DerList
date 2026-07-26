---
inclusion: auto
---

# DerList Architecture

## Product Goals

- DerList should feel like a polished consumer app, not a developer demo.
- Every major workflow should take no more than 2–3 clicks after the initial input.
- AI is an enhancement, not a requirement. Every feature should work without AI, with AI improving results when available.
- Users should never need to decide between "AI", "Search", "Manual", or "Import". The system should determine the best workflow automatically.
- Product editing and creation must use a single shared Product Editor component.
- Importers should degrade gracefully: use native parsing first, then AI, then search, never simply fail.
- Preserve existing user data and database compatibility during the rewrite wherever possible.
- Prioritize reliability and maintainability over clever abstractions.
- The end result should feel comparable to modern apps like Notion, Arc, or Linear in polish and consistency—not a proof of concept.

## User Journeys

### Add Product (unified)

```
User opens wishlist → clicks "Add" → ONE input field: "Paste anything..."
  → System detects input type automatically
  → Runs appropriate pipeline
  → Opens ProductEditor (prefilled)
  → User reviews/edits
  → Saves to wishlist
```

Input examples (all in the same field):

- `RTX 5070` → Search
- `https://amazon.com/dp/...` → Amazon importer
- `https://pcpartpicker.com/list/...` → PCPartPicker importer
- `Need a GPU under $600` → AI + Search
- `7800X3D\n5070 Ti\n32GB DDR5` → Shopping list importer
- Image paste → Vision + Search

### Edit Product

```
User clicks existing item → opens SAME ProductEditor (populated)
  → User edits
  → Saves
```

### Import PCPartPicker Build

```
User pastes pcpartpicker.com/list/xyz
  → System detects PCPartPicker URL
  → Scrapes parts list
  → Creates a WishlistCategory with build metadata
  → Each component becomes a WishlistItem in that category
  → Category metadata: total cost, wattage, compatibility, source URL
```

### Shopping Assistant

```
User says "find me a 5070 Ti under $500"
  → Assistant calls ProductService.search()
  → Gets results
  → Presents options
  → User picks → opens ProductEditor
  → Saves
```

## Directory Structure

```
src/lib/
├── repositories/          # Data access layer (ONLY thing that touches Prisma)
│   ├── product.ts         # ProductRepository
│   ├── wishlist.ts        # WishlistRepository
│   ├── provider.ts        # ProviderRepository
│   └── index.ts
├── providers/             # External API integrations (implements interfaces)
│   ├── types.ts           # Provider interfaces
│   ├── manager.ts         # ProviderManager (resolves + failover)
│   ├── openrouter.ts      # AIProvider implementation
│   ├── serpapi.ts         # SearchProvider implementation
│   ├── keepa.ts           # PriceProvider implementation
│   └── index.ts
├── services/              # Business logic (300-600 lines each, max)
│   ├── product.ts         # ProductService
│   ├── wishlist.ts        # WishlistService
│   ├── import.ts          # UniversalImportService
│   ├── assistant.ts       # AssistantService
│   └── provider.ts        # ProviderSettingsService
├── importers/             # Import pipeline plugins
│   ├── types.ts           # Importer interface
│   ├── registry.ts        # registerImporter() + detect()
│   ├── amazon.ts          # Amazon URL importer
│   ├── bestbuy.ts         # Best Buy URL importer
│   ├── newegg.ts          # Newegg URL importer
│   ├── pcpartpicker.ts    # PCPartPicker build importer
│   ├── generic-url.ts     # Generic URL (JSON-LD, OG, HTML)
│   ├── text.ts            # Plain text / shopping list
│   ├── csv.ts             # CSV import
│   └── index.ts
└── import-pipeline.ts     # The unified pipeline (detect → extract → normalize → enrich)
```

## Layer Rules

1. **Repositories** are the ONLY code that imports Prisma. Services never query the DB directly.
2. **Providers** know nothing about wishlists or products. They answer requests (search, price, chat).
3. **Services** contain business logic. They receive repositories and providers via constructor.
4. **Importers** are plugins. Adding a new one = one file + `registerImporter()`.
5. **UI components** call server actions which call services. No business logic in components.

## Provider Architecture

```typescript
// Provider interfaces — clean contracts

interface AIProvider {
  id: string;
  name: string;
  chat(messages: Message[], options?: AIOptions): Promise<AIResponse>;
  isAvailable(): boolean;
}

interface SearchProvider {
  id: string;
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  isAvailable(): boolean;
}

interface PriceProvider {
  id: string;
  name: string;
  getCurrentPrice(productId: string, idType: string): Promise<PriceResult>;
  getPriceHistory(productId: string, idType: string, days: number): Promise<PricePoint[]>;
  isAvailable(): boolean;
}
```

```typescript
// Implementations

class OpenRouterProvider implements AIProvider { ... }
class SerpApiProvider implements SearchProvider { ... }
class KeepaProvider implements PriceProvider { ... }
```

```typescript
// ProviderManager — resolves instances with failover

class ProviderManager {
  constructor(private repository: ProviderRepository) {}

  async getAIProvider(userId: string): Promise<AIProvider | null> { ... }
  async getSearchProvider(userId: string): Promise<SearchProvider | null> { ... }
  async getPriceProvider(userId: string): Promise<PriceProvider | null> { ... }
}
```

## Import Pipeline

```typescript
// Every import source is a plugin

interface Importer {
  id: string;
  name: string;
  /** Can this importer handle the given input? */
  detect(input: string): { match: boolean; confidence: number };
  /** Extract product data from the input */
  extract(input: string): Promise<ProductDraft[]>;
}

// Pipeline order:
// 1. Try native importer (confidence > 95% → done)
// 2. If low confidence → AI extraction
// 3. Search to find matching products
// 4. Merge data sources
// 5. Return ProductDraft[] for ProductEditor
```

## Service Architecture (No Circular Dependencies)

```typescript
// Services receive dependencies, never construct them

class UniversalImportService {
  constructor(
    private providers: ProviderManager,
    private products: ProductRepository,
    private importers: ImporterRegistry,
  ) {}

  async import(input: string, userId: string): Promise<ProductDraft[]> { ... }
}

class ProductService {
  constructor(
    private products: ProductRepository,
    private providers: ProviderManager,
  ) {}

  async search(query: string, userId: string): Promise<ProductSearchResult[]> { ... }
  async identify(input: string, userId: string): Promise<ProductDraft> { ... }
  async save(draft: ProductDraft, wishlistId: string): Promise<WishlistItem> { ... }
}

class AssistantService {
  constructor(
    private products: ProductService,
    private imports: UniversalImportService,
  ) {}

  async handleMessage(message: string, userId: string): Promise<AssistantResponse> { ... }
}
```

## Dependency Graph (No Cycles)

```
AssistantService
  → ProductService
  → UniversalImportService

UniversalImportService
  → ProviderManager
  → ProductRepository
  → ImporterRegistry

ProductService
  → ProductRepository
  → ProviderManager

WishlistService
  → WishlistRepository
  → ProductRepository

ProviderManager
  → ProviderRepository
```

No service creates another service. Dependencies flow one direction.

## Database Model (Keep Existing, Remove Deprecated)

**Keep:**

- Product, WishlistItem, Wishlist, WishlistCategory, WishlistMember
- PriceHistory, ProductFetchJob, ProductChange
- ProviderConfiguration (unified table)
- ProviderUsage (analytics)
- ShoppingConversation, ShoppingMessage
- User, Session, OAuthAccount, Invitation, Waitlist, AuditLog, Media

**Remove (deprecated):**

- UserAIProvider
- UserShoppingProvider
- UserPriceProvider
- UserVisionProvider
- ProviderRegistry (DB model — static config lives in code)
- ProviderHealthMetrics (health is on ProviderConfiguration)
- ProviderPriceAlert (not implemented, premature)

## WishlistCategory as Build/Folder

WishlistCategory already has the right structure for PC builds:

```prisma
model WishlistCategory {
  name            String    // "Gaming PC"
  description     String?   // Build notes
  externalLink    String?   // PCPartPicker URL
  externalLinkLabel String? // "View on PCPartPicker"
  notes           String?   // Compatibility notes, wattage, etc.
  icon            String?   // 🖥️
}
```

Build metadata (wattage, compatibility, total cost) goes in `notes` as structured JSON or in a future `metadata Json?` field.

## UI Architecture

### ProductEditor (ONE component, used everywhere)

```
ProductEditor
  props:
    draft?: ProductDraft      // Prefilled data (from import, search, AI, or existing item)
    wishlistId: string        // Where to save
    mode: 'create' | 'edit'   // Controls save behavior
    onSave: () => void        // Callback

  features:
    - All fields from ManualTab (title, brand, price, url, image, etc.)
    - AI "Identify" button (fills empty fields)
    - Live search suggestions as user types title
    - Image preview
    - Price comparison (if PriceProvider available)
    - Category selector
```

### UniversalInput (the "Paste anything..." field)

```
UniversalInput
  - Single text input / paste area
  - Detects input type on submit
  - Calls UniversalImportService
  - Opens ProductEditor with results
  - If PCPartPicker: creates category + multiple items
```

### ProviderSettings (ONE page, tabs)

```
/settings/providers
  Tabs: AI | Shopping | Price
  Each tab: list of configured providers + "Add Provider" form
  One ProviderForm component for all types
```

## What Gets Deleted

- `src/lib/ai/` (indirection module, replaced by direct provider usage)
- `src/lib/services/admin.ts` (queries Prisma directly in admin pages)
- `src/lib/services/analytics.ts` (queries Prisma directly where needed)
- `src/lib/services/shopping-assistant.ts` (replaced by simpler AssistantService)
- `src/lib/services/manager.ts` (god object, replaced by DI)
- `src/lib/services/base.ts` (over-engineered abstract class)
- `src/lib/providers/registry.ts` (duplicates database service)
- `src/lib/providers/monitoring.ts` (not needed)
- `src/lib/providers/registry-data.ts` (static data moves to importers/providers)
- `src/lib/providers/types/` (5 files → 1 file)
- `src/lib/providers/implementations/` (rewritten as flat provider files)
- `src/lib/products/product-getter.ts` (replaced by import pipeline)
- `src/lib/products/shopping-search.ts` (replaced by SearchProvider)
- `src/lib/products/price-tracking.ts` (replaced by PriceProvider)
- `src/lib/products/product-service.ts` (replaced by new ProductService)
- `src/lib/import/` (replaced by new importers/)
- Multiple duplicate settings pages (replaced by one ProviderSettings page)
- All 4 deprecated provider tables in schema
