/**
 * Integration Catalog — Type Definitions
 *
 * Types for the unified Integration Catalog system.
 * This is the single source of truth for what integrations DerList supports.
 * Adding a new provider: add a definition here → everything else is generated.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationCategory =
  'ai' | 'search' | 'shopping' | 'price' | 'media' | 'automation' | 'custom';

/** Maps our UI categories to Prisma ProviderCategory enum values */
export const CATEGORY_TO_DB: Record<IntegrationCategory, string> = {
  ai: 'AI',
  search: 'SHOPPING_SEARCH',
  shopping: 'SHOPPING_SEARCH',
  price: 'PRICE',
  media: 'VISION',
  automation: 'VISION',
  custom: 'SHOPPING_SEARCH',
};

/** Maps DB categories back to UI categories */
export const DB_TO_CATEGORY: Record<string, IntegrationCategory> = {
  AI: 'ai',
  SHOPPING_SEARCH: 'search',
  PRICE: 'price',
  VISION: 'media',
};

export interface CategoryMeta {
  id: IntegrationCategory;
  label: string;
  description: string;
  icon: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'ai',
    label: 'AI Models',
    description: 'Language models for chat & reasoning',
    icon: 'Brain',
  },
  { id: 'search', label: 'Search', description: 'Web & product search engines', icon: 'Search' },
  {
    id: 'shopping',
    label: 'Shopping',
    description: 'Product catalogs & retailers',
    icon: 'ShoppingCart',
  },
  {
    id: 'price',
    label: 'Price Tracking',
    description: 'Price history & alerts',
    icon: 'TrendingDown',
  },
  { id: 'media', label: 'Media', description: 'Images, video & content', icon: 'Image' },
  { id: 'automation', label: 'Automation', description: 'Workflows & webhooks', icon: 'Workflow' },
  { id: 'custom', label: 'Custom APIs', description: 'Connect any REST API', icon: 'Code' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Provider Capabilities (unified — not just AI)
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderCapability =
  | 'chat'
  | 'streaming'
  | 'vision'
  | 'functionCalling'
  | 'jsonMode'
  | 'embeddings'
  | 'search'
  | 'images'
  | 'shopping'
  | 'priceTracking'
  | 'priceHistory'
  | 'news'
  | 'autocomplete'
  | 'automation'
  | 'webhook';

/** Legacy AI capabilities (backward compat) */
export interface AICapabilities {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  embeddings: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Fields
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number' | 'toggle' | 'url';
  placeholder?: string;
  options?: string[];
  description?: string;
  required?: boolean;
  /** Validation pattern (regex string) */
  pattern?: string;
  /** Validation error message */
  patternMessage?: string;
  /** Minimum value (for number) or min length (for text) */
  min?: number;
  /** Maximum value (for number) or max length (for text) */
  max?: number;
  /** Default value */
  defaultValue?: string | number | boolean;
  /** Group label for visual separation in forms */
  group?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration Catalog Entry — The Universal Provider Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface IntegrationCatalogEntry {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  website: string;
  docsUrl?: string;

  /** Provider capabilities — determines which features this provider can power */
  capabilities?: ProviderCapability[] | Partial<AICapabilities>;

  /** Tags for search/filtering */
  tags?: string[];

  /** Brand identity */
  brand?: {
    color: string; // hex color for accent
    gradient?: string; // tailwind gradient classes
    icon?: string; // lucide icon name override
  };

  /** Badge flags */
  free?: boolean;
  freeTier?: string;
  selfHosted?: boolean;
  recommended?: boolean;
  comingSoon?: boolean;

  /** Pricing tier label */
  pricing?: 'free' | 'freemium' | 'paid' | 'enterprise';

  /** Supports DerList-hosted mode (shared keys) */
  supportsHosted?: boolean;

  /** Config fields — the ONLY place fields are defined */
  requiredConfig: ConfigField[];
  optionalConfig?: ConfigField[];

  /** Advanced: supported endpoints (for multi-purpose integrations) */
  endpoints?: IntegrationEndpoint[];

  /** Test connection configuration */
  testConnection?: {
    /** Endpoint to ping for health check (relative to baseUrl or absolute) */
    endpoint?: string;
    /** HTTP method for test */
    method?: 'GET' | 'POST' | 'HEAD';
    /** Expected status codes that indicate success */
    successCodes?: number[];
    /** What a successful test returns (for display) */
    successMetrics?: string[];
  };
}

export interface IntegrationEndpoint {
  type: 'chat' | 'search' | 'images' | 'news' | 'autocomplete' | 'price' | 'webhook';
  path?: string;
  supported: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Instance (user-configured) — Serialized for client transport
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfiguredIntegration {
  id: string;
  userId: string;
  providerId: string;
  category: IntegrationCategory;
  name: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;

  /** 'hosted' = DerList shared keys, 'personal' = user's own API key */
  mode: 'hosted' | 'personal';

  /** Runtime state */
  lastStatus: 'healthy' | 'degraded' | 'error' | 'unknown';
  lastHealthCheck: string | null;
  lastError: string | null;

  /** Analytics snapshot */
  requestsToday: number;
  requestsMonth: number;
  avgLatencyMs: number;
  errorCount: number;
  remainingCredits: number | null;
  estimatedCost: number | null;

  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Routing
// ─────────────────────────────────────────────────────────────────────────────

export type RoutingStrategy =
  | 'auto'
  | 'priority'
  | 'weighted'
  | 'round-robin'
  | 'cost-optimized'
  | 'fastest'
  | 'highest-quality'
  | 'random';

export interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  category: IntegrationCategory;
  /** Which provider categories are compatible with this feature */
  compatibleCategories: IntegrationCategory[];
  /** Which capabilities a provider must have to power this feature */
  requiredCapabilities?: ProviderCapability[];
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    id: 'aiChat',
    label: 'AI Chat',
    description: 'Shopping assistant conversations',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'aiAutoFill',
    label: 'AI Auto Fill',
    description: 'Product enrichment & research',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'aiOrganizer',
    label: 'Wishlist Organizer',
    description: 'Wishlist cleanup & categorization',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'duplicateDetection',
    label: 'Duplicate Detection',
    description: 'Find duplicate products',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'shoppingSearch',
    label: 'Shopping Search',
    description: 'Product discovery & comparison',
    category: 'shopping',
    compatibleCategories: ['shopping', 'search'],
    requiredCapabilities: ['search', 'shopping'],
  },
  {
    id: 'shoppingAssistant',
    label: 'Shopping Assistant',
    description: 'AI-powered shopping advice',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'productResearch',
    label: 'Product Research',
    description: 'Web search for product data',
    category: 'search',
    compatibleCategories: ['search', 'shopping'],
    requiredCapabilities: ['search'],
  },
  {
    id: 'productImages',
    label: 'Product Images',
    description: 'Image collection & search',
    category: 'media',
    compatibleCategories: ['media', 'search'],
    requiredCapabilities: ['images'],
  },
  {
    id: 'priceTracking',
    label: 'Price Tracking',
    description: 'Price monitoring & alerts',
    category: 'price',
    compatibleCategories: ['price'],
    requiredCapabilities: ['priceTracking'],
  },
  {
    id: 'priceHistory',
    label: 'Price History',
    description: 'Historical pricing data',
    category: 'price',
    compatibleCategories: ['price'],
    requiredCapabilities: ['priceHistory'],
  },
  {
    id: 'compatibility',
    label: 'Compatibility',
    description: 'Product compatibility checks',
    category: 'ai',
    compatibleCategories: ['ai', 'search'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'seoGeneration',
    label: 'SEO Generation',
    description: 'Generate SEO-optimized content',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'summaries',
    label: 'Summaries',
    description: 'Product descriptions & summaries',
    category: 'ai',
    compatibleCategories: ['ai'],
    requiredCapabilities: ['chat'],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    description: 'Review aggregation & analysis',
    category: 'search',
    compatibleCategories: ['search', 'ai'],
    requiredCapabilities: ['search'],
  },
  {
    id: 'specLookup',
    label: 'Specification Lookup',
    description: 'Product specifications',
    category: 'search',
    compatibleCategories: ['search', 'shopping'],
    requiredCapabilities: ['search'],
  },
  {
    id: 'news',
    label: 'News',
    description: 'Product & deal news',
    category: 'search',
    compatibleCategories: ['search', 'media'],
    requiredCapabilities: ['news'],
  },
  {
    id: 'autocomplete',
    label: 'Autocomplete',
    description: 'Search suggestions',
    category: 'search',
    compatibleCategories: ['search', 'ai'],
    requiredCapabilities: ['autocomplete'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Feature Routing Config (enhanced)
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureRoutingConfig {
  featureId: string;
  /** 'auto' = system picks best, or specific provider config ID */
  providerId: string;
  /** Ordered failover list of provider config IDs */
  failover: string[];
  /** Routing strategy */
  strategy: RoutingStrategy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderAnalytics {
  providerId: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  latencyMs: number;
  lastHealthCheck: string | null;
  requestsToday: number;
  requestsMonth: number;
  remainingCredits: number | null;
  estimatedCost: number | null;
  errorCount: number;
  lastError: string | null;
  successRate: number;
  avgResponseTime: number;
  uptimePercent: number;
  lastSuccessfulRequest: string | null;
  /** Daily request counts for charting (last 30 days) */
  dailyRequests?: { date: string; count: number; errors: number }[];
  /** Latency history for charting */
  latencyHistory?: { date: string; avgMs: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Connection Result (detailed)
// ─────────────────────────────────────────────────────────────────────────────

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  /** Provider-specific metadata returned by test */
  details?: {
    modelCount?: number;
    quota?: string;
    plan?: string;
    rateLimitRemaining?: number;
    version?: string;
    region?: string;
    httpStatus?: number;
  };
  error?: {
    code?: string;
    httpStatus?: number;
    suggestion?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Status
// ─────────────────────────────────────────────────────────────────────────────

export type HealthState = 'healthy' | 'slow' | 'warning' | 'offline';

export interface HealthCheckRecord {
  providerId: string;
  state: HealthState;
  latencyMs: number;
  checkedAt: string;
  failureReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom API Builder (enhanced)
// ─────────────────────────────────────────────────────────────────────────────

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key-header' | 'oauth2' | 'custom';

export interface CustomApiConfig {
  name: string;
  category: IntegrationCategory;
  baseUrl: string;
  authType: AuthType;
  authConfig: Record<string, string>;
  headers: Record<string, string>;
  endpoints: {
    search?: string;
    images?: string;
    news?: string;
    autocomplete?: string;
    chat?: string;
    price?: string;
    webhook?: string;
  };
  timeout: number;
  rateLimit: number;
  retries: number;
  responseFormat: 'json' | 'xml' | 'text';
  /** JSONPath mapping: DerList field → response path */
  jsonPathMapping: Record<string, string>;
  /** Error response mapping */
  errorMapping?: {
    messagePath?: string;
    codePath?: string;
  };
  /** Pagination config */
  pagination?: {
    type: 'offset' | 'cursor' | 'page';
    paramName: string;
    limitParam?: string;
    defaultLimit?: number;
  };
  /** Capabilities this custom API supports */
  capabilities: ProviderCapability[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing Strategy Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTING_STRATEGIES: { id: RoutingStrategy; label: string; description: string }[] = [
  {
    id: 'auto',
    label: 'Auto (Recommended)',
    description: 'System picks the best available provider based on health and priority',
  },
  {
    id: 'priority',
    label: 'Priority',
    description: 'Always use the highest-priority provider, failover to next',
  },
  {
    id: 'weighted',
    label: 'Weighted',
    description: 'Distribute requests based on configured weights',
  },
  {
    id: 'round-robin',
    label: 'Round Robin',
    description: 'Rotate evenly across all enabled providers',
  },
  {
    id: 'cost-optimized',
    label: 'Cost Optimized',
    description: 'Prefer the cheapest provider that meets quality threshold',
  },
  {
    id: 'fastest',
    label: 'Fastest',
    description: 'Route to the provider with lowest average latency',
  },
  {
    id: 'highest-quality',
    label: 'Highest Quality',
    description: 'Prefer the most capable/accurate provider regardless of cost',
  },
  { id: 'random', label: 'Random', description: 'Randomly select from available providers' },
];
