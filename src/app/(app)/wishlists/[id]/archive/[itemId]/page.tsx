import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  Info,
  Lock,
  Package,
  ShoppingBag,
  Tag,
  Target,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { readSpecEntries } from '@/lib/products/specs';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { WishlistPriorityDisplay } from '@/components/ui/WishlistPriority';
import { ArchivedItemActions } from './ArchivedItemActions';

interface PageProps {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}

function archiveHref(wishlistId: string, searchQuery: string, category: string) {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (category) params.set('category', category);
  const suffix = params.toString();
  return `/wishlists/${wishlistId}/archive${suffix ? `?${suffix}` : ''}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const user = await requireUser();
  const { id, itemId } = await params;

  // Keep this lookup owner-scoped: an unscoped title lookup would let another
  // account confirm that a guessed item id exists.
  const item = await prisma.wishlistItem.findFirst({
    where: {
      id: itemId,
      wishlistId: id,
      archived: true,
      wishlist: { ownerId: user.id },
    },
    select: { title: true },
  });

  return {
    title: item
      ? `${item.title} (Archived) — ${siteConfig.name}`
      : `Archived product — ${siteConfig.name}`,
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : typeof value === 'string'
      ? value.split(/[,;]/)
      : [];
  return values.map((entry) => entry.trim()).filter(Boolean);
}

/** Only external http(s) links are rendered as clickable links. */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** The CSP only allows https images; reject anything else instead of showing a broken frame. */
function safeImage(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export default async function ArchivedProductDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id, itemId } = await params;
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const categoryFilter = (sp.category ?? '').trim();

  const item = await prisma.wishlistItem.findFirst({
    where: {
      id: itemId,
      wishlistId: id,
      // Ownership is part of the same query as the item lookup. Foreign ids
      // therefore resolve to null exactly like ids that do not exist.
      wishlist: { ownerId: user.id },
    },
    include: {
      wishlist: { select: { id: true, title: true, icon: true, color: true } },
      product: {
        select: {
          id: true,
          title: true,
          description: true,
          image: true,
          gallery: true,
          canonicalUrl: true,
          domain: true,
          retailer: true,
          brand: true,
        },
      },
    },
  });

  if (!item) notFound();

  // Restored products no longer belong in the archive. Send the owner back to
  // the collection instead of rendering a stale read-only page.
  if (!item.archived) redirect(`/wishlists/${id}`);

  const backHref = archiveHref(id, query, categoryFilter);
  const metadata = parseMetadata(item.metadata);

  let productGallery: string[] = [];
  if (item.product?.gallery) {
    try {
      const parsed: unknown = JSON.parse(item.product.gallery);
      if (Array.isArray(parsed)) {
        productGallery = parsed.filter((entry): entry is string => typeof entry === 'string');
      }
    } catch {
      /* ignore malformed gallery JSON */
    }
  }

  const metadataImages = asStringList(metadata.images);
  const allImages = unique(
    [item.image, item.product?.image, ...productGallery, ...metadataImages]
      .map((value) => safeImage(value))
      .filter((value): value is string => Boolean(value))
  );
  const primaryImage = allImages[0] ?? null;
  const gallery = allImages.slice(1, 7);

  const tags = unique([
    ...asStringList(metadata.tags),
    ...asStringList(metadata.aiTags),
    ...asStringList(metadata.customLabels),
  ]).slice(0, 16);

  // `specs` is canonical; the legacy importer wrote `specifications`. Accept
  // both so existing saved products keep showing their specifications.
  const specSource = readSpecEntries(metadata);

  const specs: Array<{ key: string; value: string }> = [];
  if (specSource.length > 0) {
    for (const entry of specSource) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const key = asString(record.key);
      const value = asString(record.value);
      const unit = asString(record.unit);
      if (key && value) specs.push({ key, value: unit ? `${value} ${unit}` : value });
    }
  }

  const sourceLinks = unique(
    [
      safeUrl(item.url),
      safeUrl(asString(metadata.storeUrl)),
      safeUrl(item.product?.canonicalUrl),
    ].filter((value): value is string => Boolean(value))
  );

  const currentPrice = item.currentPrice != null ? Number(item.currentPrice) : null;
  const targetPrice = item.targetPrice != null ? Number(item.targetPrice) : null;
  const originalPrice = item.originalPrice != null ? Number(item.originalPrice) : null;
  const targetReached = currentPrice != null && targetPrice != null && currentPrice <= targetPrice;
  const priority = Math.min(4, Math.max(1, item.starPriority));
  const description = item.description ?? item.product?.description ?? null;
  const storeName = item.retailer ?? item.product?.retailer ?? null;
  const category = item.category;
  const importedFrom = asString(metadata.importedFrom);
  const metadataProvider = asString(metadata.provider);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header / navigation ─── */}
      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href={backHref} aria-label="Back to archived products">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span aria-hidden>{item.wishlist.icon || '📋'}</span>
            <span className="max-w-48 truncate">{item.wishlist.title}</span>
            <span aria-hidden>/</span>
            <Link href={backHref} className="hover:text-foreground hover:underline">
              Archived products
            </Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-foreground text-xl font-semibold break-words sm:text-2xl">
              {item.title}
            </h1>
            <Badge variant="warning" className="shrink-0 gap-1 text-[10px]">
              <Archive className="h-3 w-3" aria-hidden />
              Archived
            </Badge>
          </div>
        </div>

        <ArchivedItemActions
          wishlistId={id}
          itemId={item.id}
          itemTitle={item.title}
          archiveHref={backHref}
          className="w-full sm:ml-auto sm:w-auto"
        />
      </div>

      {/* ─── Read-only notice ─── */}
      <div className="border-warning/25 bg-warning/5 flex items-start gap-3 rounded-xl border px-4 py-3">
        <Lock className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p className="text-foreground text-sm font-medium">
            This product is archived and read-only
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Archived on {item.archivedAt ? formatDate(item.archivedAt) : 'an unknown date'}. Viewing
            it does not restore it. Restore the product first if you want to edit it or include it
            in active bulk actions.
          </p>
        </div>
      </div>

      {/* ─── Image + primary information ─── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="flex shrink-0 flex-col gap-3">
          {primaryImage ? (
            <div className="border-border bg-surface flex h-64 w-full items-center justify-center overflow-hidden rounded-xl border lg:h-72 lg:w-72">
              <img
                src={primaryImage}
                alt={item.title}
                className="h-full w-full object-contain p-4"
              />
            </div>
          ) : (
            <div className="border-border bg-surface flex h-64 w-full items-center justify-center rounded-xl border lg:h-72 lg:w-72">
              <Package className="text-muted-foreground/30 h-16 w-16" aria-hidden />
            </div>
          )}

          {gallery.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
              {gallery.map((image) => (
                <span
                  key={image}
                  className="border-border bg-surface flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
                >
                  <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {item.brand && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Tag className="h-3.5 w-3.5" aria-hidden />
                {item.brand}
              </span>
            )}
            {item.model && <span className="text-muted-foreground text-sm">{item.model}</span>}
            {item.condition && (
              <Badge variant="outline" className="text-[10px]">
                {item.condition}
              </Badge>
            )}
            {item.availability && (
              <Badge variant="secondary" className="text-[10px]">
                {item.availability}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            {currentPrice != null && (
              <span className="text-foreground text-2xl font-bold tabular-nums">
                {item.currency} {currentPrice.toFixed(2)}
              </span>
            )}
            {currentPrice != null && originalPrice != null && originalPrice > currentPrice && (
              <span className="text-muted-foreground text-sm tabular-nums line-through">
                {item.currency} {originalPrice.toFixed(2)}
              </span>
            )}
            {targetPrice != null && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                  targetReached ? 'bg-success/10 text-success' : 'bg-surface text-muted-foreground'
                }`}
                title={`Target price: ${targetPrice.toFixed(2)} ${item.currency}`}
              >
                <Target className="h-3.5 w-3.5" aria-hidden />
                Target {item.currency} {targetPrice.toFixed(2)}
                {targetReached ? ' — reached' : ''}
              </span>
            )}
            {currentPrice == null && targetPrice == null && (
              <span className="text-muted-foreground text-sm">
                No price saved for this product.
              </span>
            )}
          </div>

          {description && (
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          )}

          {sourceLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sourceLinks.map((href, index) => (
                <Button
                  key={href}
                  asChild
                  variant={index === 0 ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1.5"
                >
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {index === 0
                      ? `View on ${storeName ?? 'source'}`
                      : index === 1
                        ? 'Store listing'
                        : 'Product source'}
                  </a>
                </Button>
              ))}
            </div>
          )}

          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {storeName && (
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
                {storeName}
              </span>
            )}
            {item.product?.domain && (
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" aria-hidden />
                {item.product.domain}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Added {formatDate(item.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Saved details ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="text-accent h-4 w-4" aria-hidden />
              Personal notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {item.notes ? (
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {item.notes}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No personal notes saved.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="text-accent h-4 w-4" aria-hidden />
              Wishlist details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Priority
                </dt>
                <dd className="text-foreground flex flex-wrap items-center gap-2">
                  <WishlistPriorityDisplay value={priority} />
                  <span className="text-muted-foreground text-[10px]">{item.priority}</span>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Quantity
                </dt>
                <dd className="text-foreground">×{item.quantity}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Category
                </dt>
                <dd className="text-foreground">{category ?? 'Uncategorized'}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Archive date
                </dt>
                <dd className="text-foreground">
                  {item.archivedAt ? formatDate(item.archivedAt) : 'Unknown'}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Target price
                </dt>
                <dd className="text-foreground">
                  {targetPrice != null ? `${item.currency} ${targetPrice.toFixed(2)}` : 'Not set'}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Current price
                </dt>
                <dd className="text-foreground">
                  {currentPrice != null ? `${item.currency} ${currentPrice.toFixed(2)}` : 'Not set'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="text-accent h-4 w-4" aria-hidden />
              Store and source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Store
                </dt>
                <dd className="text-foreground">{storeName ?? 'Not recorded'}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Source
                </dt>
                <dd className="min-w-0">
                  {safeUrl(item.url) ? (
                    <a
                      href={safeUrl(item.url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent inline-flex max-w-full items-center gap-1.5 break-all hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{item.url}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No source URL saved</span>
                  )}
                </dd>
              </div>
              {importedFrom && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Imported from
                  </dt>
                  <dd className="text-foreground break-all">{importedFrom}</dd>
                </div>
              )}
              {metadataProvider && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Provider
                  </dt>
                  <dd className="text-foreground">{metadataProvider}</dd>
                </div>
              )}
              {item.product && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Saved product record
                  </dt>
                  <dd className="text-foreground break-words">{item.product.title}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Tag className="text-accent h-4 w-4" aria-hidden />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tags.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Product tags">
                {tags.map((tag) => (
                  <li
                    key={tag}
                    className="border-border bg-surface text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No tags saved.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {specs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Info className="text-accent h-4 w-4" aria-hidden />
              Specifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {specs.map((spec, index) => (
                <div key={`${spec.key}:${index}`} className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs font-medium">{spec.key}</dt>
                  <dd className="text-foreground text-sm">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
