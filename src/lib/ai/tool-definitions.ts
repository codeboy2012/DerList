/**
 * Tool definitions for Puter.js function calling.
 * These describe the available tools to the AI model using OpenAI-compatible JSON Schema.
 */

export const SHOPPING_AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description:
        'Search DerList product database by query. Use this to find products matching user requests. Searches title, brand, retailer, SKU, GTIN, and description.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (product name, brand, category, or identifier)' },
          maxResults: { type: 'number', description: 'Max results to return (1-20, default 10)' },
          maxPrice: { type: 'number', description: 'Maximum price filter' },
          minPrice: { type: 'number', description: 'Minimum price filter' },
          brand: { type: 'string', description: 'Filter by brand name' },
          retailer: { type: 'string', description: 'Filter by retailer name' },
          inStockOnly: { type: 'boolean', description: 'Only return in-stock products' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_product',
      description: 'Get full product details by ID. Use after search to get complete information about a specific product.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'The product ID from DerList' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_products',
      description: 'Compare 2-5 products side by side. Use when user wants to decide between multiple options.',
      parameters: {
        type: 'object',
        properties: {
          productIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of 2-5 product IDs to compare',
          },
        },
        required: ['productIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_similar_products',
      description: 'Find products similar to a given product (same brand or price range). Use when user wants alternatives.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID to find alternatives for' },
          maxResults: { type: 'number', description: 'Max similar products to return (1-10, default 5)' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_compatibility',
      description:
        'Check compatibility between products (e.g., CPU+motherboard, RAM+motherboard). Returns specs so you can reason about compatibility.',
      parameters: {
        type: 'object',
        properties: {
          productIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of product IDs to check compatibility between',
          },
        },
        required: ['productIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_price_history',
      description: 'Get price history for a product. Shows price trends, lowest/highest prices, and when prices changed.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID to get price history for' },
          limit: { type: 'number', description: 'Number of records to return (default 30, max 100)' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_to_wishlist',
      description:
        'Add a product to the user\'s wishlist. Always confirm with the user before calling this. Requires a wishlistId — use get_user_wishlists first if needed.',
      parameters: {
        type: 'object',
        properties: {
          wishlistId: { type: 'string', description: 'Wishlist ID to add the product to' },
          productId: { type: 'string', description: 'Product ID to add' },
          starPriority: {
            type: 'number',
            description: 'Priority 1-4 (1=Want, 2=Really Want, 3=Need This, 4=Must Have!)',
          },
          notes: { type: 'string', description: 'Optional notes about the item' },
          category: { type: 'string', description: 'Optional category (e.g., "PC Upgrades", "Smart Home")' },
        },
        required: ['wishlistId', 'productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_wishlist_item',
      description: 'Update priority, notes, or category of an existing wishlist item.',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: 'Wishlist item ID to update' },
          starPriority: { type: 'number', description: 'New priority 1-4' },
          notes: { type: 'string', description: 'New notes (empty string to clear)' },
          category: { type: 'string', description: 'New category (empty string to clear)' },
        },
        required: ['itemId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_user_wishlists',
      description: "Get the user's available wishlists. Use this when you need to know which wishlist to add items to.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
] as const;
