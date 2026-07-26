import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  List,
  Package,
  Share2,
  Trophy,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';
import { WishlistPriorityDisplay } from '@/components/ui/WishlistPriority';

// ─────────────────────────────────────────────────────────────────────────────
// Data Loading
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ sort?: string; filter?: string; view?: string }>;
}

async function getWishlist(username: string, slug: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, displayName: true, username: true, avatarUrl: true },
  });
  if (!user) return null;

  const wishlist = await prisma.wishlist.findUnique({
    where: { ownerId_slug: { ownerId: user.id, slug } },
    include: {
      items: { orderBy: [{ purchased: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }] },
      categories: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!wishlist) return null;
  if (wishlist.visibility === 'PRIVATE') return null;

  return { wishlist, owner: user };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getWishlist(username, slug);
  if (!data) return { title: `Wishlist Not Found — ${siteConfig.name}` };

  const totalValue = data.wishlist.items.reduce((s, i) => s + (Number(i.currentPrice) || 0), 0);
  return {
    title: `${data.wishlist.title} by ${data.owner.displayName} — ${siteConfig.name}`,
    description:
      data.wishlist.description ||
      `${data.wishlist.items.length} items${totalValue > 0 ? ` · $${totalValue.toFixed(2)} total` : ''}.`,
    openGraph: {
      title: `${data.wishlist.title} — ${siteConfig.name}`,
      description: data.wishlist.description || `A wishlist shared by ${data.owner.displayName}.`,
      type: 'website',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default async function PublicWishlistPage({ params, searchParams }: PageProps) {
  const { username, slug } = await params;
  const sp = await searchParams;
  const data = await getWishlist(username, slug);
  if (!data) notFound();

  const { wishlist, owner } = data;
  const sort = sp.sort ?? 'position';
  const filter = sp.filter ?? 'all';
  const view = sp.view ?? 'grouped';

  // Serialize items
  const items = wishlist.items.map((item) => ({
    ...item,
    currentPrice: item.currentPrice?.toString() ?? null,
    originalPrice: item.originalPrice?.toString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  // Parse curated Top Picks
  let topPicks: { position: number; itemId: string }[] = [];
  try {
    if (wishlist.topPicks) topPicks = JSON.parse(wishlist.topPicks);
  } catch {
    /* fallback to auto */
  }

  // Sort
  const sorted = [...items];
  switch (sort) {
    case 'price-asc':
      sorted.sort((a, b) => (Number(a.currentPrice) || 0) - (Number(b.currentPrice) || 0));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (Number(b.currentPrice) || 0) - (Number(a.currentPrice) || 0));
      break;
    case 'name':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'priority':
      sorted.sort((a, b) => (b.starPriority ?? 1) - (a.starPriority ?? 1));
      break;
    default:
      break;
  }

  // Filter
  const filtered =
    filter === 'purchased'
      ? sorted.filter((i) => i.purchased)
      : filter === 'unpurchased'
        ? sorted.filter((i) => !i.purchased)
        : sorted;
  const unpurchased = filtered.filter((i) => !i.purchased);
  const purchased = filtered.filter((i) => i.purchased);
  const hasCategories = items.some((i) => i.category);

  // Stats
  const totalValue = items.reduce((s, i) => s + (Number(i.currentPrice) || 0), 0);
  const purchasedCount = items.filter((i) => i.purchased).length;
  const retailers = [...new Set(items.map((i) => i.retailer).filter(Boolean))] as string[];
  const shareUrl = `${siteConfig.url}/u/${owner.username}/wishlist/${wishlist.slug}`;

  return (
    <div className="bg-background min-h-svh">
      {/* ─── Nav ─── */}
      <header className="border-border bg-background/80 border-b backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <span className="text-muted-foreground text-xs">Public Wishlist</span>
        </Container>
      </header>

      <Container className="py-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {/* ─── Header ─── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <span
                className="bg-surface flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={
                  wishlist.color
                    ? { backgroundColor: `${wishlist.color}20`, color: wishlist.color }
                    : undefined
                }
              >
                {wishlist.icon || '📋'}
              </span>
              <div className="flex flex-1 flex-col gap-1.5">
                <h1 className="text-foreground text-2xl font-semibold">{wishlist.title}</h1>
                {wishlist.description && (
                  <p className="text-muted-foreground text-sm">{wishlist.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary">
                    {wishlist.visibility === 'PUBLIC' ? 'Public' : 'Shared'}
                  </Badge>
                  <span className="text-muted-foreground text-xs">by {owner.displayName}</span>
                  <span className="text-muted-foreground text-xs">· {items.length} items</span>
                  <span className="text-muted-foreground text-xs">
                    · Updated {formatDate(wishlist.updatedAt)}
                  </span>
                </div>
              </div>
              {/* Share / Copy Link */}
              <div className="ml-auto flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(wishlist.title)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* ─── Stats ─── */}
          <div className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCell label="Items" value={String(items.length)} />
            <StatCell label="Value" value={totalValue > 0 ? `$${totalValue.toFixed(2)}` : '—'} />
            <StatCell label="Purchased" value={String(purchasedCount)} accent="text-success" />
            <StatCell
              label="Remaining"
              value={String(items.length - purchasedCount)}
              accent="text-accent"
            />
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

          {/* ─── Top 3 Most Wanted ─── */}
          {unpurchased.length >= 3 && <TopMostWanted items={unpurchased} topPicks={topPicks} />}

          {/* ─── Controls: Sort, Filter, View ─── */}
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px] font-medium">Sort:</span>
                <div className="border-border bg-surface flex gap-0.5 rounded-lg border p-0.5">
                  <PublicSortLink
                    slug={slug}
                    username={username}
                    current={sort}
                    value="position"
                    label="Default"
                    filter={filter}
                    view={view}
                  />
                  <PublicSortLink
                    slug={slug}
                    username={username}
                    current={sort}
                    value="price-desc"
                    label="Price ↓"
                    filter={filter}
                    view={view}
                  />
                  <PublicSortLink
                    slug={slug}
                    username={username}
                    current={sort}
                    value="price-asc"
                    label="Price ↑"
                    filter={filter}
                    view={view}
                  />
                  <PublicSortLink
                    slug={slug}
                    username={username}
                    current={sort}
                    value="priority"
                    label="Priority"
                    filter={filter}
                    view={view}
                  />
                  <PublicSortLink
                    slug={slug}
                    username={username}
                    current={sort}
                    value="name"
                    label="Name"
                    filter={filter}
                    view={view}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px] font-medium">Show:</span>
                <div className="border-border bg-surface flex gap-0.5 rounded-lg border p-0.5">
                  <PublicFilterLink
                    slug={slug}
                    username={username}
                    current={filter}
                    value="all"
                    label="All"
                    sort={sort}
                    view={view}
                  />
                  <PublicFilterLink
                    slug={slug}
                    username={username}
                    current={filter}
                    value="unpurchased"
                    label="Wanted"
                    sort={sort}
                    view={view}
                  />
                  <PublicFilterLink
                    slug={slug}
                    username={username}
                    current={filter}
                    value="purchased"
                    label="Purchased"
                    sort={sort}
                    view={view}
                  />
                </div>
              </div>
              {hasCategories && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px] font-medium">View:</span>
                  <div className="border-border bg-surface flex gap-0.5 rounded-lg border p-0.5">
                    <PublicViewLink
                      slug={slug}
                      username={username}
                      current={view}
                      value="grouped"
                      sort={sort}
                      filter={filter}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </PublicViewLink>
                    <PublicViewLink
                      slug={slug}
                      username={username}
                      current={view}
                      value="list"
                      sort={sort}
                      filter={filter}
                    >
                      <List className="h-3.5 w-3.5" />
                    </PublicViewLink>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Items ─── */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Package className="text-muted-foreground/30 h-12 w-12" />
              <p className="text-muted-foreground text-sm">This wishlist is empty.</p>
            </div>
          ) : view === 'grouped' && hasCategories ? (
            /* Grouped by category */
            <PublicCategoryView items={unpurchased} categoryMeta={wishlist.categories} />
          ) : (
            /* Flat list */
            <div className="flex flex-col gap-2">
              {unpurchased.map((item) => (
                <PublicItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Purchased section */}
          {purchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="text-success h-4 w-4" />
                Purchased ({purchased.length})
              </h2>
              <div className="flex flex-col gap-2 opacity-60">
                {purchased.map((item) => (
                  <PublicItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ─── Footer ─── */}
          <div className="border-border flex flex-col items-center gap-3 border-t pt-8 text-center">
            <p className="text-muted-foreground text-xs">
              Created with{' '}
              <Link href="/" className="text-accent hover:underline">
                {siteConfig.name}
              </Link>{' '}
              — the open-source wishlist manager.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/">Create Your Own Wishlist</Link>
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Card (read-only, mirrors ItemRow layout)
// ─────────────────────────────────────────────────────────────────────────────

const retailerStyles: Record<string, string> = {
  amazon: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'best buy': 'bg-blue-600/10 text-blue-400 border-blue-600/20',
  walmart: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  newegg: 'bg-orange-600/10 text-orange-500 border-orange-600/20',
  target: 'bg-red-500/10 text-red-400 border-red-500/20',
  ebay: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  apple: 'bg-gray-400/10 text-gray-300 border-gray-400/20',
  'micro center': 'bg-red-600/10 text-red-400 border-red-600/20',
};

function getRetailerStyle(retailer: string | null): string {
  if (!retailer) return 'bg-surface text-muted-foreground border-border';
  const key = retailer
    .toLowerCase()
    .replace(/\s*(us|uk|de|ca)$/i, '')
    .trim();
  return retailerStyles[key] ?? 'bg-surface text-muted-foreground border-border';
}

type PublicItem = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  image: string | null;
  brand: string | null;
  retailer: string | null;
  currentPrice: string | null;
  originalPrice: string | null;
  dealInfo: string | null;
  currency: string;
  starPriority: number;
  quantity: number;
  purchased: boolean;
  notes: string | null;
  category: string | null;
};

function PublicItemCard({ item }: { item: PublicItem }) {
  const price = item.currentPrice != null ? Number(item.currentPrice) : null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
        item.purchased
          ? 'border-border/40 bg-card/50 opacity-75'
          : 'border-border bg-card hover:border-border hover:shadow-md'
      }`}
    >
      <div className="flex gap-0">
        {/* Image */}
        <div className="relative w-28 shrink-0 sm:w-36">
          {item.image ? (
            <div className="flex h-full min-h-[120px] items-center justify-center bg-white/[0.03] p-3">
              <img
                src={item.image}
                alt=""
                className="h-full max-h-28 w-full object-contain sm:max-h-32"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="bg-surface flex h-full min-h-[120px] items-center justify-center">
              <Package className="text-muted-foreground/20 h-10 w-10" />
            </div>
          )}
          {item.purchased && (
            <div className="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
              <CheckCircle2 className="text-success h-8 w-8" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 overflow-hidden">
              <h3
                className={`line-clamp-2 text-sm leading-snug font-semibold sm:text-base ${item.purchased ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {item.title}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {item.retailer && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none font-medium ${getRetailerStyle(item.retailer)}`}
                  >
                    {item.retailer}
                  </span>
                )}
                {item.brand && (
                  <span className="text-muted-foreground text-[11px]">{item.brand}</span>
                )}
                {item.starPriority > 1 && <WishlistPriorityDisplay value={item.starPriority} />}
                {item.quantity > 1 && (
                  <span className="bg-surface text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                    ×{item.quantity}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            {price != null && (
              <div className="shrink-0 text-right">
                <span
                  className={`text-lg leading-tight font-bold tabular-nums ${item.purchased ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  ${price.toFixed(2)}
                </span>
                {item.originalPrice != null && Number(item.originalPrice) > price && (
                  <span className="text-muted-foreground block text-[10px] line-through">
                    ${Number(item.originalPrice).toFixed(2)}
                  </span>
                )}
                {item.dealInfo && (
                  <span className="mt-0.5 inline-block rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
                    {item.dealInfo}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions: only View Product link */}
          {item.url && (
            <div className="flex items-center">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:bg-accent/10 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Visit Store
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Grouped View (read-only)
// ─────────────────────────────────────────────────────────────────────────────

function PublicCategoryView({
  items,
  categoryMeta,
}: {
  items: PublicItem[];
  categoryMeta: {
    name: string;
    description: string | null;
    externalLink: string | null;
    externalLinkLabel: string | null;
    icon: string | null;
  }[];
}) {
  const groups = new Map<string, PublicItem[]>();
  const uncategorized: PublicItem[] = [];

  for (const item of items) {
    const cat = item.category?.trim();
    if (cat) {
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    } else {
      uncategorized.push(item);
    }
  }

  const metaOrder = categoryMeta.map((m) => m.name);
  const allNames = [...groups.keys()];
  const orderedNames = [
    ...metaOrder.filter((name) => groups.has(name)),
    ...allNames.filter((name) => !metaOrder.includes(name)).sort(),
  ];
  const metaLookup = new Map(categoryMeta.map((m) => [m.name, m]));

  return (
    <div className="flex flex-col gap-6">
      {orderedNames.map((name) => {
        const categoryItems = groups.get(name)!;
        const meta = metaLookup.get(name);
        const sorted = [...categoryItems].sort(
          (a, b) => (b.starPriority ?? 1) - (a.starPriority ?? 1)
        );
        const total = sorted.reduce((s, i) => s + (Number(i.currentPrice) || 0), 0);

        return (
          <section key={name} className="flex flex-col gap-2.5">
            <div className="border-border flex items-center gap-2.5 border-b pb-2">
              <span className="bg-surface flex h-7 w-7 items-center justify-center rounded-lg text-sm">
                {meta?.icon || <FolderOpen className="text-muted-foreground h-3.5 w-3.5" />}
              </span>
              <div className="flex flex-1 items-baseline gap-3">
                <h3 className="text-foreground text-sm font-semibold">{name}</h3>
                {total > 0 && (
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    ${total.toFixed(2)} total
                  </span>
                )}
                <span className="text-muted-foreground text-[10px]">
                  {sorted.length} item{sorted.length !== 1 ? 's' : ''}
                </span>
              </div>
              {meta?.externalLink && (
                <a
                  href={meta.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border bg-surface text-accent hover:bg-card inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium"
                >
                  <ExternalLink className="h-3 w-3" /> {meta.externalLinkLabel || 'View'}
                </a>
              )}
            </div>
            {meta?.description && (
              <p className="text-muted-foreground text-xs">{meta.description}</p>
            )}
            <div className="flex flex-col gap-2">
              {sorted.map((item) => (
                <PublicItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}

      {uncategorized.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="border-border flex items-center gap-2.5 border-b pb-2">
            <span className="bg-surface flex h-7 w-7 items-center justify-center rounded-lg text-sm">
              <FolderOpen className="text-muted-foreground h-3.5 w-3.5" />
            </span>
            <h3 className="text-foreground text-sm font-semibold">Other</h3>
          </div>
          <div className="flex flex-col gap-2">
            {uncategorized.map((item) => (
              <PublicItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top 3 Most Wanted (read-only version)
// ─────────────────────────────────────────────────────────────────────────────

function TopMostWanted({
  items,
  topPicks,
}: {
  items: PublicItem[];
  topPicks?: { position: number; itemId: string }[];
}) {
  let top3: PublicItem[];

  if (topPicks && topPicks.length > 0) {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    top3 = topPicks
      .sort((a, b) => a.position - b.position)
      .map((p) => itemMap.get(p.itemId))
      .filter((item): item is PublicItem => item !== undefined);
  } else {
    top3 = [...items]
      .sort((a, b) => {
        if ((b.starPriority ?? 1) !== (a.starPriority ?? 1))
          return (b.starPriority ?? 1) - (a.starPriority ?? 1);
        return (Number(b.currentPrice) || 0) - (Number(a.currentPrice) || 0);
      })
      .slice(0, 3);
  }

  if (top3.length < 3) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-semibold">Most Wanted</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {top3.map((item, i) => (
          <div key={item.id} className="bg-surface/50 flex items-center gap-3 rounded-lg p-3">
            <span className="text-lg">{medals[i]}</span>
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Package className="text-muted-foreground/40 h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-xs font-medium">{item.title}</p>
              {item.currentPrice && (
                <p className="text-muted-foreground text-xs tabular-nums">
                  ${Number(item.currentPrice).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort / Filter / View Links
// ─────────────────────────────────────────────────────────────────────────────

function buildPublicUrl(username: string, slug: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== 'position' && v !== 'all' && v !== 'grouped') sp.set(k, v);
  }
  const qs = sp.toString();
  return `/u/${username}/wishlist/${slug}${qs ? `?${qs}` : ''}`;
}

function PublicSortLink({
  slug,
  username,
  current,
  value,
  label,
  filter,
  view,
}: {
  slug: string;
  username: string;
  current: string;
  value: string;
  label: string;
  filter: string;
  view: string;
}) {
  const active = current === value;
  return (
    <Link
      href={buildPublicUrl(username, slug, { sort: value, filter, view })}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </Link>
  );
}

function PublicFilterLink({
  slug,
  username,
  current,
  value,
  label,
  sort,
  view,
}: {
  slug: string;
  username: string;
  current: string;
  value: string;
  label: string;
  sort: string;
  view: string;
}) {
  const active = current === value;
  return (
    <Link
      href={buildPublicUrl(username, slug, { sort, filter: value, view })}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </Link>
  );
}

function PublicViewLink({
  slug,
  username,
  current,
  value,
  sort,
  filter,
  children,
}: {
  slug: string;
  username: string;
  current: string;
  value: string;
  sort: string;
  filter: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={buildPublicUrl(username, slug, { sort, filter, view: value })}
      className={`flex items-center rounded-md px-2 py-1 transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </Link>
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
