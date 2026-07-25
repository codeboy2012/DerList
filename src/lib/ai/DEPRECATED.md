# Deprecated Puter.js Files

This directory contains deprecated files from the old Puter.js-based AI system that was replaced with a multi-provider AI architecture.

## Deprecated Files

- `puter.ts.deprecated` - Old Puter.js wrapper and singleton
- `shopping-ai.ts.deprecated` - Old shopping AI service using Puter.js
- `product-getter.ts.deprecated` - Old product getter service using Puter.js

## Migration

The functionality has been moved to:

- **Shopping AI**: `src/lib/ai/services/shopping-ai.ts` - Multi-provider shopping assistance
- **Product Getter**: `src/lib/ai/services/product-getter.ts` - Multi-provider product identification
- **Provider System**: `src/lib/ai/providers/` - Unified AI provider abstraction

## New Features

The new system supports multiple AI providers:
- SerpApi (recommended for new users - free tier)
- OpenAI (GPT-4, vision, function calling)
- Anthropic Claude (planned)
- Google Gemini (planned)  
- OpenRouter (planned)
- Ollama (local models, planned)
- Custom OpenAI-compatible APIs (planned)

Users can configure their preferred provider in Settings → AI Provider.

## Backward Compatibility

The main AI module (`src/lib/ai/index.ts`) maintains backward compatibility by exporting the new functions under the old names. Existing code should continue to work without changes.

## Removal Timeline

These deprecated files will be removed in a future release once the migration is fully complete and tested.