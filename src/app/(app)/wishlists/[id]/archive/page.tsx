import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Archive, ArrowLeft, Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ArchiveItemsPanel } from './ArchiveItemsPanel';

export const metadata: Metadata = {
  title: `Archived products — ${siteConfig.name}`,
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function ArchivedProductsPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const category = (sp.category ?? '').trim();

  const wishlist = await prisma.wishlist.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, title: true, icon: true, color: true },
  });

  if (!wishlist) notFound();

  const items = await prisma.wishlistItem.findMany({
    where: {
      wishlistId: id,
      archived: true,
      ...(category ? { category } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' as const } },
              { brand: { contains: query, mode: 'insensitive' as const } },
              { model: { contains: query, mode: 'insensitive' as const } },
              { category: { contains: query, mode: 'insensitive' as const } },
              { notes: { contains: query, mode: 'insensitive' as const } },
              { retailer: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ archivedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const categoryRows = await prisma.wishlistItem.findMany({
    where: { wishlistId: id, archived: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  const filterCategories = categoryRows
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));

  const serialized = items.map((item) => ({
    id: item.id,
    title: item.title,
    image: item.image,
    brand: item.brand,
    retailer: item.retailer,
    category: item.category,
    currentPrice: item.currentPrice != null ? item.currentPrice.toString() : null,
    currency: item.currency,
    archivedAt: item.archivedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href={`/wishlists/${id}`} aria-label={`Back to ${wishlist.title}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span
          className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
          style={
            wishlist.color
              ? { backgroundColor: `${wishlist.color}20`, color: wishlist.color }
              : undefined
          }
        >
          {wishlist.icon || '📋'}
        </span>
        <div className="min-w-0">
          <h1 className="text-foreground flex items-center gap-2 truncate text-xl font-semibold">
            <Archive className="h-4 w-4" aria-hidden />
            Archived products
          </h1>
          <p className="text-muted-foreground truncate text-xs">{wishlist.title}</p>
        </div>
        <span className="text-muted-foreground ml-auto text-xs">{items.length} shown</span>
      </div>

      <form
        action={`/wishlists/${id}/archive`}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search archived products"
            aria-label="Search archived products"
            className="border-border bg-surface text-foreground placeholder:text-muted focus-visible:ring-ring h-9 w-full rounded-lg border pr-3 pl-8 text-xs focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-[11px] font-medium">
          Category
          <select
            name="category"
            defaultValue={category}
            className="border-border bg-surface text-foreground h-9 rounded-lg border px-2 text-xs"
          >
            <option value="">All categories</option>
            {filterCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="secondary">
            Filter
          </Button>
          {(query || category) && (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/wishlists/${id}/archive`}>Reset</Link>
            </Button>
          )}
        </div>
      </form>

      {serialized.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Archive className="text-muted-foreground/40 h-10 w-10" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-foreground text-sm font-medium">
                {query || category ? 'No archived products match' : 'No archived products'}
              </p>
              <p className="text-muted-foreground text-xs">
                {query || category
                  ? 'Try a different search or category.'
                  : 'Archiving a product hides it from this collection without deleting it. You can restore it here later.'}
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/wishlists/${id}`}>Back to collection</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ArchiveItemsPanel
          wishlistId={id}
          items={serialized}
          categories={filterCategories}
          query={query}
          category={category}
        />
      )}
    </div>
  );
}
