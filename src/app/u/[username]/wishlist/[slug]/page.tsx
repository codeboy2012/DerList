import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { Container } from '@/components/ui/Container';
import { WishlistPriorityDisplay } from '@/components/ui/WishlistPriority';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { ExternalLink, Heart, Package } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
}

async function getWishlist(username: string, slug: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, displayName: true, username: true },
  });
  if (!user) return null;

  const wishlist = await prisma.wishlist.findUnique({
    where: { ownerId_slug: { ownerId: user.id, slug } },
    include: {
      items: {
        orderBy: [{ purchased: 'asc' }, { position: 'asc' }],
      },
    },
  });

  if (!wishlist) return null;

  // Only PUBLIC and UNLISTED wishlists are accessible
  if (wishlist.visibility === 'PRIVATE') return null;

  return { wishlist, owner: user };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getWishlist(username, slug);

  if (!data) {
    return { title: `Wishlist Not Found — ${siteConfig.name}` };
  }

  return {
    title: `${data.wishlist.title} by ${data.owner.displayName} — ${siteConfig.name}`,
    description: data.wishlist.description || `A wishlist shared by ${data.owner.displayName} on ${siteConfig.name}.`,
    openGraph: {
      title: `${data.wishlist.title} — ${siteConfig.name}`,
      description: data.wishlist.description || `${data.wishlist.items.length} items on this wishlist.`,
      type: 'website',
    },
  };
}

export default async function PublicWishlistPage({ params }: PageProps) {
  const { username, slug } = await params;
  const data = await getWishlist(username, slug);

  if (!data) {
    notFound();
  }

  const { wishlist, owner } = data;
  const unpurchased = wishlist.items.filter((i) => !i.purchased);
  const purchased = wishlist.items.filter((i) => i.purchased);

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <span className="text-xs text-muted-foreground">
            Shared Wishlist
          </span>
        </Container>
      </header>

      <Container className="py-8">
        <div className="mx-auto max-w-3xl">
          {/* Wishlist header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl"
                style={wishlist.color ? { backgroundColor: `${wishlist.color}20`, color: wishlist.color } : undefined}
              >
                {wishlist.icon || '📋'}
              </span>
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold text-foreground">{wishlist.title}</h1>
                {wishlist.description && (
                  <p className="text-sm text-muted-foreground">{wishlist.description}</p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">
                    by {owner.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {wishlist.items.length} items
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · Updated {formatDate(wishlist.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          {wishlist.items.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-4 text-center">
              <Package className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">This wishlist is empty.</p>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-6">
              {/* Unpurchased items */}
              {unpurchased.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Heart className="h-4 w-4 text-accent" aria-hidden />
                    Wanted ({unpurchased.length})
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {unpurchased.map((item) => (
                      <PublicItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Purchased items */}
              {purchased.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Already Purchased ({purchased.length})
                  </h2>
                  <div className="grid gap-3 opacity-60 sm:grid-cols-2">
                    {purchased.map((item) => (
                      <PublicItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PublicItemCard({ item }: { item: { id: string; title: string; description: string | null; url: string | null; image: string | null; brand: string | null; retailer: string | null; currentPrice: unknown; currency: string; priority: string; starPriority: number; quantity: number; purchased: boolean; notes: string | null } }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
      {/* Image */}
      {item.image ? (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
          <Package className="h-6 w-6" />
        </span>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${item.purchased ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {item.title}
          </span>
          {item.quantity > 1 && (
            <span className="text-[10px] text-muted-foreground">×{item.quantity}</span>
          )}
        </div>
        {item.brand && (
          <span className="text-xs text-muted-foreground">{item.brand}</span>
        )}
        <div className="flex items-center gap-2 pt-0.5">
          {item.currentPrice != null && (
            <span className="text-xs font-medium text-foreground">
              {item.currency} {Number(item.currentPrice).toFixed(2)}
            </span>
          )}
          {item.starPriority > 1 && (
            <WishlistPriorityDisplay value={item.starPriority} />
          )}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            View Product
          </a>
        )}
      </div>
    </div>
  );
}
