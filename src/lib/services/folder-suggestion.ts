/**
 * Folder Suggestion Service
 *
 * Analyzes imported products as a group to determine if they belong together.
 * Suggests folder names, descriptions, icons, colors, and subfolders.
 * Checks existing user folders before suggesting new ones.
 *
 * Rules:
 * - Never creates folders automatically — always asks user first
 * - Checks existing folders for similarity before suggesting new ones
 * - Generates subfolders when appropriate
 * - Remembers user naming preferences for future suggestions
 */

import { prisma } from '@/lib/prisma';
import type { ProviderManager } from '@/lib/providers';
import type { Message } from '@/lib/providers/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportedItem {
  id: string;
  title: string;
  brand?: string;
  category?: string;
  retailer?: string;
}

export interface FolderSuggestion {
  /** Whether items appear to belong together */
  shouldGroup: boolean;
  /** Suggested folder name */
  folderName: string;
  /** Short description of the folder */
  description: string;
  /** Suggested emoji icon */
  icon: string;
  /** Suggested color */
  color: string;
  /** Overall category for the group */
  category: string;
  /** Suggested subfolders with item assignments */
  subfolders: SubfolderSuggestion[];
  /** Existing folder that matches (if any) */
  existingFolder?: ExistingFolderMatch;
  /** AI confidence (0-100) */
  confidence: number;
  /** Why this grouping was suggested */
  reasoning: string;
}

export interface SubfolderSuggestion {
  name: string;
  itemIds: string[];
}

export interface ExistingFolderMatch {
  id: string;
  name: string;
  similarity: number;
}

export interface ApplyFolderInput {
  wishlistId: string;
  itemIds: string[];
  folderName: string;
  subfolders?: { name: string; itemIds: string[] }[];
  useExistingFolderId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class FolderSuggestionService {
  constructor(private readonly providers: ProviderManager) {}

  /**
   * Analyze a batch of imported items and suggest folder grouping.
   * Returns null if items don't appear to belong together.
   */
  async analyzeBatch(
    items: ImportedItem[],
    userId: string,
    wishlistId: string
  ): Promise<FolderSuggestion | null> {
    // Only suggest folders for 2+ items
    if (items.length < 2) return null;

    // Get user's existing categories/folders for matching
    const existingCategories = await this.getExistingCategories(wishlistId);

    // Ask AI to analyze the group
    const aiSuggestion = await this.getAISuggestion(items, existingCategories, userId);
    if (!aiSuggestion || !aiSuggestion.shouldGroup) return null;

    // Check if an existing folder matches
    const existingMatch = this.findExistingMatch(aiSuggestion.folderName, existingCategories);
    if (existingMatch) {
      aiSuggestion.existingFolder = existingMatch;
    }

    return aiSuggestion;
  }

  /**
   * Apply a folder suggestion: assign all items to the chosen category.
   * Creates the category in the wishlist if it doesn't exist.
   */
  async applyFolder(input: ApplyFolderInput, userId: string): Promise<void> {
    // Verify ownership
    const wishlist = await prisma.wishlist.findFirst({
      where: { id: input.wishlistId, ownerId: userId },
    });
    if (!wishlist) throw new Error('Wishlist not found');

    if (input.useExistingFolderId) {
      // Use existing category — just update items
      const existing = await prisma.wishlistCategory.findFirst({
        where: { id: input.useExistingFolderId, wishlistId: input.wishlistId },
      });
      if (existing) {
        await prisma.wishlistItem.updateMany({
          where: { id: { in: input.itemIds }, wishlistId: input.wishlistId },
          data: { category: existing.name, wishlistCategoryId: existing.id },
        });
        return;
      }
    }

    // Create new category
    const category = await prisma.wishlistCategory.create({
      data: {
        wishlistId: input.wishlistId,
        name: input.folderName,
      },
    });

    // Assign all items to the folder
    await prisma.wishlistItem.updateMany({
      where: { id: { in: input.itemIds }, wishlistId: input.wishlistId },
      data: { category: input.folderName, wishlistCategoryId: category.id },
    });

    // Handle subfolders: assign items to subcategories
    if (input.subfolders && input.subfolders.length > 0) {
      for (const sub of input.subfolders) {
        if (sub.itemIds.length === 0) continue;
        // Update the category field on items to reflect subfolder
        await prisma.wishlistItem.updateMany({
          where: { id: { in: sub.itemIds }, wishlistId: input.wishlistId },
          data: { category: `${input.folderName} > ${sub.name}` },
        });
      }
    }
  }

  // ─── Private ───

  private async getExistingCategories(wishlistId: string): Promise<string[]> {
    const categories = await prisma.wishlistCategory.findMany({
      where: { wishlistId },
      select: { name: true },
    });
    const itemCategories = await prisma.wishlistItem.findMany({
      where: { wishlistId, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    const all = new Set([
      ...categories.map((c) => c.name),
      ...itemCategories.map((c) => c.category!),
    ]);
    return [...all];
  }

  private findExistingMatch(
    suggested: string,
    existing: string[]
  ): ExistingFolderMatch | undefined {
    const lower = suggested.toLowerCase();
    for (const name of existing) {
      const nameLower = name.toLowerCase();
      // Check for substring or high similarity
      if (
        nameLower.includes(lower) ||
        lower.includes(nameLower) ||
        this.similarity(lower, nameLower) > 0.7
      ) {
        return { id: '', name, similarity: this.similarity(lower, nameLower) };
      }
    }
    return undefined;
  }

  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    const editDistance = this.levenshtein(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  private async getAISuggestion(
    items: ImportedItem[],
    existingCategories: string[],
    userId: string
  ): Promise<FolderSuggestion | null> {
    const aiProvider = await this.providers.getAIProvider(userId);
    if (!aiProvider) return this.heuristicSuggestion(items);

    const itemList = items
      .map((i) => {
        const parts = [i.title];
        if (i.brand) parts.push(`(${i.brand})`);
        if (i.category) parts.push(`[${i.category}]`);
        return parts.join(' ');
      })
      .join('\n');

    const messages: Message[] = [
      {
        role: 'system',
        content: `You analyze groups of products to determine if they belong together in a folder/category.

Return ONLY a JSON object:
{
  "shouldGroup": true/false,
  "folderName": "Short folder name (2-4 words max)",
  "description": "One sentence description",
  "icon": "Single emoji that represents the group",
  "color": "One of: blue, purple, green, orange, red, pink, yellow, cyan, gray",
  "category": "General category",
  "subfolders": [
    {"name": "Subfolder name", "itemIndices": [0, 1, 2]}
  ],
  "confidence": 0-100,
  "reasoning": "Brief explanation"
}

Rules:
- shouldGroup=false if items are random/unrelated
- Subfolder itemIndices are 0-based positions in the input list
- Only suggest subfolders if there are clear subcategories (3+ items needed per subfolder)
- Use concise, user-friendly folder names
- ${existingCategories.length > 0 ? `User has existing folders: ${existingCategories.join(', ')}. Prefer matching existing names if similar.` : 'No existing folders.'}`,
      },
      {
        role: 'user',
        content: `Analyze these ${items.length} imported products:\n\n${itemList}`,
      },
    ];

    try {
      const response = await aiProvider.chat(messages, {
        maxTokens: 800,
        temperature: 0.2,
        json: true,
      });

      return this.parseAIResponse(response.content, items);
    } catch {
      // Fall back to heuristic
      return this.heuristicSuggestion(items);
    }
  }

  private parseAIResponse(content: string, items: ImportedItem[]): FolderSuggestion | null {
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsed = JSON.parse(jsonStr);

      if (!parsed.shouldGroup) return null;

      const subfolders: SubfolderSuggestion[] = [];
      if (Array.isArray(parsed.subfolders)) {
        for (const sf of parsed.subfolders) {
          if (sf.name && Array.isArray(sf.itemIndices)) {
            subfolders.push({
              name: String(sf.name),
              itemIds: sf.itemIndices
                .filter((i: number) => i >= 0 && i < items.length)
                .map((i: number) => items[i].id),
            });
          }
        }
      }

      return {
        shouldGroup: true,
        folderName: String(parsed.folderName || 'New Folder'),
        description: String(parsed.description || ''),
        icon: String(parsed.icon || '📦'),
        color: String(parsed.color || 'blue'),
        category: String(parsed.category || ''),
        subfolders,
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.min(100, Math.max(0, parsed.confidence))
            : 50,
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      return null;
    }
  }

  /** Simple heuristic when AI is not available */
  private heuristicSuggestion(items: ImportedItem[]): FolderSuggestion | null {
    // Check if all items share a brand
    const brands = items.map((i) => i.brand?.toLowerCase()).filter(Boolean);
    const brandCounts = new Map<string, number>();
    for (const b of brands) {
      brandCounts.set(b!, (brandCounts.get(b!) || 0) + 1);
    }
    const topBrand = [...brandCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    if (topBrand && topBrand[1] >= items.length * 0.6) {
      const brandName =
        items.find((i) => i.brand?.toLowerCase() === topBrand[0])?.brand || topBrand[0];
      return {
        shouldGroup: true,
        folderName: `${brandName} Products`,
        description: `${brandName} items from this import.`,
        icon: '🏷️',
        color: 'blue',
        category: brandName,
        subfolders: [],
        confidence: 60,
        reasoning: `Most items (${topBrand[1]}/${items.length}) are from ${brandName}.`,
      };
    }

    // Check if all items share a category
    const categories = items.map((i) => i.category?.toLowerCase()).filter(Boolean);
    const catCounts = new Map<string, number>();
    for (const c of categories) {
      catCounts.set(c!, (catCounts.get(c!) || 0) + 1);
    }
    const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    if (topCat && topCat[1] >= items.length * 0.5) {
      const catName =
        items.find((i) => i.category?.toLowerCase() === topCat[0])?.category || topCat[0];
      return {
        shouldGroup: true,
        folderName: catName,
        description: `${catName} items from this import.`,
        icon: '📂',
        color: 'purple',
        category: catName,
        subfolders: [],
        confidence: 50,
        reasoning: `Most items (${topCat[1]}/${items.length}) are in the ${catName} category.`,
      };
    }

    return null;
  }
}
