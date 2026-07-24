import type { Metadata } from 'next';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { WishlistPriorityDisplay } from '@/components/ui/WishlistPriority';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  ExternalLink,
  Globe,
  List,
  Package,
  RefreshCw,
  ShoppingBag,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { refreshProductAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: product
      ? `${product.title} — ${siteConfig.name}`
      : `Product — ${siteConfig.name}`,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      wishlistItems: {
        where: { wishlist: { ownerId: user.id } },
        select: {
          id: true,
          starPriority: true,
          wishlist: { select: { id: true, title: true, icon: true } },
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  // Fetch price history
  const priceHistory = await prisma.priceHistory.findMany({
    where: { productId: id },
    orderBy: { recordedAt: 'desc' },
    take: 50,
    select: { price: true, currency: true, recordedAt: true, availability: true },
  });

  // Compute price stats
  const prices = priceHistory.map((p) => Number(p.price));
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : null;
  const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const currentPrice = product.currentPrice ? Number(product.currentPrice) : null;

  // Product analytics: how many wishlists/users track this product
  const [totalWishlistsTracking, totalUsersTracking] = await Promise.all([
    prisma.wishlistItem.count({ where: { productId: id } }),
    prisma.wishlistItem.findMany({
      where: { productId: id },
      select: { wishlist: { select: { ownerId: true } } },
      distinct: ['wishlistId'],
    }).then((items) => new Set(items.map((i) => i.wishlist.ownerId)).size),
  ]);

  // Fetch recent changes
  const recentChanges = await prisma.productChange.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, changeType: true, oldValue: true, newValue: true, createdAt: true },
  });

  // Fetch latest job status
  const latestJob = await prisma.productFetchJob.findFirst({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
    select: { status: true, finishedAt: true, error: true, attempts: true },
  });

  // Parse gallery
  let gallery: string[] = [];
  try {
    if (product.gallery) gallery = JSON.parse(product.gallery);
  } catch { /* ignore */ }

  // Parse specifications
  let specs: Record<string, string> = {};
  try {
    if (product.specifications) specs = JSON.parse(product.specifications);
  } catch { /* ignore */ }

  const canRefresh = !!product.canonicalUrl;

  // Calculate product health score
  const { calculateProductHealth } = await import('@/lib/products/health');
  const health = calculateProductHealth({
    image: product.image,
    title: product.title,
    currentPrice: product.currentPrice,
    brand: product.brand,
    retailer: product.retailer,
    sku: product.sku,
    gtin: product.gtin,
    mpn: product.mpn,
    inStock: product.inStock,
    lastFetchedAt: product.lastFetchedAt,
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/wishlists" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Badge variant="secondary" className="text-[10px]">
          {product.source === 'IMPORTED' ? 'Imported' : 'Manual'}
        </Badge>
        <Badge
          variant={health.label === 'Excellent' ? 'success' : health.label === 'Good' ? 'default' : health.label === 'Fair' ? 'warning' : 'danger'}
          className="text-[10px]"
        >
          {health.score}% Health
        </Badge>
        {canRefresh && (
          <form action={refreshProductAction} className="ml-auto">
            <input type="hidden" name="productId" value={id} />
            <Button type="submit" size="sm" variant="secondary" className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </Button>
          </form>
        )}
      </div>

      {/* Product header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Image */}
        <div className="flex shrink-0 flex-col gap-3">
          {product.image ? (
            <div className="flex h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface lg:h-72 lg:w-72">
              <img src={product.image} alt={product.title} className="h-full w-full object-contain p-4" />
            </div>
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-xl border border-border bg-surface lg:h-72 lg:w-72">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          {gallery.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {gallery.slice(0, 5).map((img, i) => (
                <span key={i} className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-2xl font-semibold text-foreground">{product.title}</h1>

          {/* Price + availability */}
          <div className="flex flex-wrap items-center gap-3">
            {currentPrice != null && (
              <span className="text-2xl font-bold text-foreground">
                {product.currency} {currentPrice.toFixed(2)}
              </span>
            )}
            {product.inStock != null && (
              <Badge variant={product.inStock ? 'success' : 'danger'}>
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </Badge>
            )}
          </div>

          {/* Price stats */}
          {lowestPrice != null && highestPrice != null && (
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <TrendingDown className="h-4 w-4 text-success" aria-hidden />
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">Lowest</span>
                  <span className="text-sm font-semibold text-success">{product.currency} {lowestPrice.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <TrendingUp className="h-4 w-4 text-danger" aria-hidden />
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">Highest</span>
                  <span className="text-sm font-semibold text-danger">{product.currency} {highestPrice.toFixed(2)}</span>
                </div>
              </div>
              {averagePrice != null && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                  <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">Average</span>
                    <span className="text-sm font-semibold text-foreground">{product.currency} {averagePrice.toFixed(2)}</span>
                  </div>
                </div>
              )}
              {currentPrice != null && lowestPrice < currentPrice && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">Savings possible</span>
                    <span className="text-sm font-medium text-foreground">{product.currency} {(currentPrice - lowestPrice).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tracking analytics */}
          {(totalWishlistsTracking > 0 || totalUsersTracking > 0) && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {totalWishlistsTracking > 0 && (
                <span>{totalWishlistsTracking} wishlist{totalWishlistsTracking !== 1 ? 's' : ''} tracking</span>
              )}
              {totalUsersTracking > 0 && (
                <span>{totalUsersTracking} user{totalUsersTracking !== 1 ? 's' : ''} interested</span>
              )}
              {prices.length > 0 && (
                <span>{prices.length} price record{prices.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          {/* Meta details */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {product.brand && <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" aria-hidden />{product.brand}</span>}
            {product.retailer && <span className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" aria-hidden />{product.retailer}</span>}
            {product.domain && <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" aria-hidden />{product.domain}</span>}
          </div>

          {product.canonicalUrl && (
            <a href={product.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
              <ExternalLink className="h-4 w-4" aria-hidden />
              View on {product.retailer ?? product.domain ?? 'retailer'}
            </a>
          )}

          {(product.sku || product.mpn || product.gtin) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {product.sku && <span>SKU: {product.sku}</span>}
              {product.mpn && <span>MPN: {product.mpn}</span>}
              {product.gtin && <span>GTIN: {product.gtin}</span>}
            </div>
          )}

          {product.description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {product.description.length > 500 ? `${product.description.slice(0, 500)}...` : product.description}
            </p>
          )}

          {/* Fetch status */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {product.lastFetchedAt && <span>Last updated: {formatDate(product.lastFetchedAt)}</span>}
            {latestJob && (
              <Badge variant={latestJob.status === 'SUCCESS' ? 'success' : latestJob.status === 'FAILED' ? 'danger' : 'warning'} className="text-[9px]">
                {latestJob.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Price History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
            Price History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {priceHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                No price history recorded yet. Prices are tracked each time the product is refreshed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Price</th>
                    <th className="hidden px-3 py-2 font-medium text-muted-foreground sm:table-cell">Change</th>
                    <th className="hidden px-3 py-2 font-medium text-muted-foreground md:table-cell">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {priceHistory.map((record, i) => {
                    const price = Number(record.price);
                    const prevPrice = i < priceHistory.length - 1 ? Number(priceHistory[i + 1].price) : null;
                    const diff = prevPrice != null ? price - prevPrice : null;

                    return (
                      <tr key={i} className="hover:bg-surface/50">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(record.recordedAt)}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{record.currency} {price.toFixed(2)}</td>
                        <td className="hidden px-3 py-2 sm:table-cell">
                          {diff != null && diff !== 0 ? (
                            <span className={`flex items-center gap-1 text-xs ${diff < 0 ? 'text-success' : 'text-danger'}`}>
                              {diff < 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                              {Math.abs(diff).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                          {record.availability ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* On your wishlists */}
      {product.wishlistItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <List className="h-4 w-4 text-accent" aria-hidden />
              On your wishlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {product.wishlistItems.map((wi) => (
                <Link key={wi.id} href={`/wishlists/${wi.wishlist.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface">
                  <span className="text-base">{wi.wishlist.icon || '📋'}</span>
                  <span className="text-sm font-medium text-foreground">{wi.wishlist.title}</span>
                  {wi.starPriority > 1 && (
                    <WishlistPriorityDisplay value={wi.starPriority} />
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Changes */}
      {recentChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentChanges.map((change) => (
                <div key={change.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{change.changeType}</Badge>
                    <span className="text-xs text-muted-foreground line-through">{change.oldValue ?? '—'}</span>
                    <span className="text-xs text-foreground">{change.newValue ?? '—'}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{formatDate(change.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Specifications */}
      {Object.keys(specs).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(specs).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">{key}</dt>
                  <dd className="text-sm text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
