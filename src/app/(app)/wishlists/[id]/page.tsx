import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Info,
  LayoutGrid,
  List,
  Package,
  Pencil,
  Plus,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { toggleArchiveAction } from '../actions';
import { AddItemPanel } from './AddItemPanel';
import { AIOrganizer } from './AIOrganizer';
import { CategoryView } from './CategoryView';
import { CopyToClipboard } from './CopyToClipboard';
import { CopyWishlistButton } from './CopyWishlistButton';
import { DeleteWishlistButton } from './DeleteWishlistButton';
import { ItemRow } from './ItemRow';
import { RatingExplainer } from './RatingExplainer';
import { TopMostWanted } from './TopMostWanted';
import { TopPicksManager } from './TopPicksManager';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string; sort?: string; filter?: string; view?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: wishlist ? `${wishlist.title} — ${siteConfig.name}` : `Wishlist — ${siteConfig.name}`,
  };
}

export default async function WishlistDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const showAddForm = sp.add === 'true';
  const sort = sp.sort ?? 'position';
  const filter = sp.filter ?? 'all';
  const view = sp.view ?? 'list'; // 'list' or 'category'

  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ purchased: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }] },
      categories: { orderBy: { sortOrder: 'asc' } },
      owner: { select: { username: true } },
    },
  });

  if (!wishlist || wishlist.ownerId !== user.id) {
    notFound();
  }

  // ── Serialize items for Client Components ──
  // Prisma Decimal and Date objects cannot cross the Server → Client boundary.
  // Convert Decimals to string|null and Dates to ISO strings at this boundary.
  const serializedItems = wishlist.items.map((item) => ({
    ...item,
    currentPrice: item.currentPrice != null ? item.currentPrice.toString() : null,
    originalPrice: item.originalPrice != null ? item.originalPrice.toString() : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    purchasedAt: item.purchasedAt?.toISOString() ?? null,
  }));

  // Sort items
  const sortedItems = [...serializedItems];
  switch (sort) {
    case 'price-asc':
      sortedItems.sort((a, b) => (Number(a.currentPrice) || 0) - (Number(b.currentPrice) || 0));
      break;
    case 'price-desc':
      sortedItems.sort((a, b) => (Number(b.currentPrice) || 0) - (Number(a.currentPrice) || 0));
      break;
    case 'name':
      sortedItems.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'newest':
      sortedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'priority':
      sortedItems.sort((a, b) => (b.starPriority ?? 1) - (a.starPriority ?? 1));
      break;
    default: // 'position' — keep DB order
      break;
  }

  // Filter items
  const filteredItems =
    filter === 'all'
      ? sortedItems
      : filter === 'purchased'
        ? sortedItems.filter((i) => i.purchased)
        : filter === 'unpurchased'
          ? sortedItems.filter((i) => !i.purchased)
          : sortedItems;

  const unpurchased = filteredItems.filter((i) => !i.purchased);
  const purchased = filteredItems.filter((i) => i.purchased);
  const shareUrl =
    wishlist.visibility !== 'PRIVATE'
      ? `${siteConfig.url}/u/${wishlist.owner.username}/wishlist/${wishlist.slug}`
      : null;

  // Determine if any items have categories (for showing category view toggle)
  const hasCategories = serializedItems.some((i) => i.category);

  // Parse curated Top Picks
  let topPicks: { position: number; itemId: string }[] = [];
  try {
    if (wishlist.topPicks) topPicks = JSON.parse(wishlist.topPicks);
  } catch {
    /* fallback to auto */
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/wishlists" aria-label="Back to wishlists">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3 overflow-hidden">
            <span
              className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
              style={
                wishlist.color
                  ? { backgroundColor: `${wishlist.color}20`, color: wishlist.color }
                  : undefined
              }
            >
              {wishlist.icon || '📋'}
            </span>
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-foreground truncate text-xl font-semibold">{wishlist.title}</h1>
              {wishlist.description && (
                <p className="text-muted-foreground truncate text-sm">{wishlist.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Meta bar */}
        <div className="flex flex-wrap items-center gap-2">
          <VisibilityBadge visibility={wishlist.visibility} />
          {wishlist.archived && <Badge variant="warning">Archived</Badge>}
          <span className="text-muted-foreground text-xs">
            {serializedItems.length} items · Updated {formatDate(wishlist.updatedAt)}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <AIOrganizer wishlistId={id} itemCount={serializedItems.length} />
            <TopPicksManager
              wishlistId={id}
              items={serializedItems
                .filter((i) => !i.purchased)
                .map((i) => ({
                  id: i.id,
                  title: i.title,
                  image: i.image,
                  currentPrice: i.currentPrice,
                  retailer: i.retailer,
                  brand: i.brand,
                }))}
              initialPicks={topPicks}
            />
            <Button asChild size="sm" variant="secondary">
              <Link href={`/wishlists/${id}/edit`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Link>
            </Button>
            <form action={toggleArchiveAction}>
              <input type="hidden" name="wishlistId" value={id} />
              <Button type="submit" size="sm" variant="ghost">
                <Archive className="h-3.5 w-3.5" aria-hidden />
                {wishlist.archived ? 'Unarchive' : 'Archive'}
              </Button>
            </form>
            <CopyWishlistButton
              wishlistId={id}
              wishlistTitle={wishlist.title}
              itemCount={serializedItems.length}
            />
            <CopyToClipboard
              wishlistTitle={wishlist.title}
              items={serializedItems.map((i) => ({
                title: i.title,
                currentPrice: i.currentPrice,
                category: i.category,
                starPriority: i.starPriority,
                purchased: i.purchased,
              }))}
            />
          </div>
        </div>

        {/* Share URL */}
        {shareUrl && (
          <div className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3 py-2">
            <ExternalLink className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-muted-foreground truncate text-xs">{shareUrl}</span>
          </div>
        )}

        {/* Notice / disclaimer */}
        {wishlist.notice && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
            <p className="text-xs leading-relaxed text-blue-300/90">{wishlist.notice}</p>
          </div>
        )}
      </div>

      {/* ─── Rating System Explainer ─── */}
      <RatingExplainer />

      {/* ─── Top 3 Most Wanted ─── */}
      {unpurchased.length >= 3 && <TopMostWanted items={unpurchased} topPicks={topPicks} />}

      {/* ─── Stats summary ─── */}
      {serializedItems.length > 0 && <WishlistStats items={serializedItems} />}

      {/* ─── Sort/Filter/View controls ─── */}
      {serializedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[11px] font-medium">Sort:</span>
            <div className="border-border bg-surface flex gap-0.5 rounded-lg border p-0.5">
              <SortLink
                id={id}
                current={sort}
                value="position"
                label="Default"
                filter={filter}
                view={view}
              />
              <SortLink
                id={id}
                current={sort}
                value="price-desc"
                label="Price ↓"
                filter={filter}
                view={view}
              />
              <SortLink
                id={id}
                current={sort}
                value="price-asc"
                label="Price ↑"
                filter={filter}
                view={view}
              />
              <SortLink
                id={id}
                current={sort}
                value="name"
                label="Name"
                filter={filter}
                view={view}
              />
              <SortLink
                id={id}
                current={sort}
                value="priority"
                label="Priority ⭐"
                filter={filter}
                view={view}
              />
              <SortLink
                id={id}
                current={sort}
                value="newest"
                label="Newest"
                filter={filter}
                view={view}
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[11px] font-medium">Show:</span>
            <div className="border-border bg-surface flex gap-0.5 rounded-lg border p-0.5">
              <FilterLink
                id={id}
                current={filter}
                value="all"
                label="All"
                sort={sort}
                view={view}
              />
              <FilterLink
                id={id}
                current={filter}
                value="unpurchased"
                label="Wanted"
                sort={sort}
                view={view}
              />
              <FilterLink
                id={id}
                current={filter}
                value="purchased"
                label="Purchased"
                sort={sort}
                view={view}
              />
            </div>
          </div>

          {/* View mode toggle (only if items have categories) */}
          {hasCategories && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px] font-medium">View:</span>
              <div className="border-border bg-surface flex gap-0.5 rounded-lg border p-0.5">
                <ViewLink id={id} current={view} value="list" sort={sort} filter={filter}>
                  <List className="h-3.5 w-3.5" />
                </ViewLink>
                <ViewLink id={id} current={view} value="category" sort={sort} filter={filter}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </ViewLink>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Add item ─── */}
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <Link href={`/wishlists/${id}?add=true`}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add Item
          </Link>
        </Button>
      </div>

      {showAddForm && <AddItemPanel wishlistId={id} />}

      {/* ─── Items ─── */}
      {serializedItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Package className="text-muted-foreground/40 h-10 w-10" />
            <div className="flex flex-col gap-1">
              <p className="text-foreground text-sm font-medium">No items yet</p>
              <p className="text-muted-foreground text-xs">
                Add items to this wishlist to start tracking things you want.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href={`/wishlists/${id}?add=true`}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add First Item
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : view === 'category' && hasCategories ? (
        /* Category-grouped view */
        <div className="flex flex-col gap-6">
          <CategoryView
            items={unpurchased}
            wishlistId={id}
            categoryMeta={wishlist.categories.map((c) => ({
              name: c.name,
              description: c.description,
              externalLink: c.externalLink,
              externalLinkLabel: c.externalLinkLabel,
              icon: c.icon,
              notes: c.notes,
            }))}
          />

          {/* Purchased (always flat list) */}
          {purchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="text-success h-4 w-4" aria-hidden />
                Purchased ({purchased.length})
              </h2>
              <div className="flex flex-col gap-2 opacity-70">
                {purchased.map((item) => (
                  <ItemRow key={item.id} item={item} wishlistId={id} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Standard list view */
        <div className="flex flex-col gap-4">
          {/* Unpurchased */}
          {unpurchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground text-sm font-medium">Items ({unpurchased.length})</h2>
              <div className="flex flex-col gap-2">
                {unpurchased.map((item) => (
                  <ItemRow key={item.id} item={item} wishlistId={id} />
                ))}
              </div>
            </div>
          )}

          {/* Purchased */}
          {purchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="text-success h-4 w-4" aria-hidden />
                Purchased ({purchased.length})
              </h2>
              <div className="flex flex-col gap-2 opacity-70">
                {purchased.map((item) => (
                  <ItemRow key={item.id} item={item} wishlistId={id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Delete zone ─── */}
      <div className="border-border border-t pt-6">
        <DeleteWishlistButton wishlistId={id} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: string }) {
  const map: Record<string, { variant: 'default' | 'success' | 'warning'; label: string }> = {
    PUBLIC: { variant: 'success', label: 'Public' },
    UNLISTED: { variant: 'warning', label: 'Unlisted' },
    PRIVATE: { variant: 'default', label: 'Private' },
  };
  const { variant, label } = map[visibility] ?? map.PRIVATE;
  return (
    <Badge variant={variant} className="text-[10px]">
      {label}
    </Badge>
  );
}

function WishlistStats({
  items,
}: {
  items: Array<{
    currentPrice: string | null;
    currency: string;
    purchased: boolean;
    retailer: string | null;
  }>;
}) {
  const totalItems = items.length;
  const purchasedCount = items.filter((i) => i.purchased).length;
  const remaining = totalItems - purchasedCount;

  const totalValue = items.reduce((sum, item) => {
    if (item.currentPrice != null) return sum + Number(item.currentPrice);
    return sum;
  }, 0);

  const retailers = [...new Set(items.map((i) => i.retailer).filter(Boolean))] as string[];

  return (
    <div className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCell label="Items" value={String(totalItems)} />
      <StatCell label="Value" value={totalValue > 0 ? `$${totalValue.toFixed(2)}` : '—'} />
      <StatCell label="Purchased" value={String(purchasedCount)} accent="text-success" />
      <StatCell label="Remaining" value={String(remaining)} accent="text-accent" />
      <div className="flex flex-col gap-0.5 sm:col-span-2 lg:col-span-1">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Retailers
        </span>
        {retailers.length > 0 ? (
          <span className="text-foreground truncate text-xs">
            {retailers.slice(0, 3).join(' · ')}
            {retailers.length > 3 ? ` +${retailers.length - 3}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function SortLink({
  id,
  current,
  value,
  label,
  filter,
  view,
}: {
  id: string;
  current: string;
  value: string;
  label: string;
  filter: string;
  view: string;
}) {
  const params = new URLSearchParams();
  if (value !== 'position') params.set('sort', value);
  if (filter !== 'all') params.set('filter', filter);
  if (view !== 'list') params.set('view', view);
  const href = `/wishlists/${id}${params.toString() ? `?${params.toString()}` : ''}`;
  const active = current === value;
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </Link>
  );
}

function FilterLink({
  id,
  current,
  value,
  label,
  sort,
  view,
}: {
  id: string;
  current: string;
  value: string;
  label: string;
  sort: string;
  view: string;
}) {
  const params = new URLSearchParams();
  if (sort !== 'position') params.set('sort', sort);
  if (value !== 'all') params.set('filter', value);
  if (view !== 'list') params.set('view', view);
  const href = `/wishlists/${id}${params.toString() ? `?${params.toString()}` : ''}`;
  const active = current === value;
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </Link>
  );
}

function ViewLink({
  id,
  current,
  value,
  sort,
  filter,
  children,
}: {
  id: string;
  current: string;
  value: string;
  sort: string;
  filter: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (sort !== 'position') params.set('sort', sort);
  if (filter !== 'all') params.set('filter', filter);
  if (value !== 'list') params.set('view', value);
  const href = `/wishlists/${id}${params.toString() ? `?${params.toString()}` : ''}`;
  const active = current === value;
  return (
    <Link
      href={href}
      className={`flex items-center justify-center rounded-md px-2 py-1 transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
      aria-label={`${value} view`}
    >
      {children}
    </Link>
  );
}
