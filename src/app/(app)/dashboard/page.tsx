import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowDown,
  Heart,
  Link2,
  List,
  Package,
  Plus,
  Search,
  ShoppingCart,
  TrendingDown,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: `Dashboard — ${siteConfig.name}`,
};

interface DashboardPageProps {
  searchParams: Promise<{ welcome?: string; verification?: string }>;
}

export default async function UserDashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const isWelcome = params.welcome === '1';

  const [
    totalWishlists,
    totalItems,
    purchasedItems,
    recentWishlists,
    recentItems,
    recentImports,
    priceDrops,
  ] = await Promise.all([
    // Archived collections are hidden from the active collection list, so they
    // are excluded from the counter too — the label says "Active Wishlists".
    prisma.wishlist.count({ where: { ownerId: user.id, archived: false } }),
    // Archived collections are excluded from the active dashboard as well as
    // archived products, so the totals agree with the collection list.
    prisma.wishlistItem.count({
      where: { wishlist: { ownerId: user.id, archived: false }, archived: false },
    }),
    prisma.wishlistItem.count({
      where: {
        wishlist: { ownerId: user.id, archived: false },
        purchased: true,
        archived: false,
      },
    }),
    prisma.wishlist.findMany({
      where: { ownerId: user.id, archived: false },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        icon: true,
        visibility: true,
        updatedAt: true,
        // Only active products are counted; archived ones are reported
        // separately on the collection card.
        _count: { select: { items: { where: { archived: false } } } },
      },
    }),
    prisma.wishlistItem.findMany({
      where: { wishlist: { ownerId: user.id, archived: false }, archived: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        image: true,
        currentPrice: true,
        currency: true,
        purchased: true,
        wishlist: { select: { id: true, title: true } },
      },
    }),
    // Recently imported products (by this user)
    prisma.wishlistItem.findMany({
      where: {
        wishlist: { ownerId: user.id, archived: false },
        productId: { not: null },
        archived: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        title: true,
        image: true,
        retailer: true,
        currentPrice: true,
        currency: true,
        createdAt: true,
        wishlist: { select: { id: true } },
      },
    }),
    // Price drops (products with recent PRICE changes where new < old)
    prisma.productChange.findMany({
      where: {
        changeType: 'PRICE',
        product: {
          wishlistItems: {
            some: { wishlist: { ownerId: user.id, archived: false }, archived: false },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        product: { select: { id: true, title: true, image: true, currency: true } },
      },
    }),
  ]);

  // Filter actual drops (new < old)
  const actualDrops = priceDrops.filter((d) => {
    const oldP = parseFloat(d.oldValue ?? '0');
    const newP = parseFloat(d.newValue ?? '0');
    return newP < oldP && newP > 0;
  });

  const isEmpty = totalWishlists === 0 && totalItems === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Welcome, {user.displayName.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as <span className="text-foreground font-medium">@{user.username}</span>
          </p>
        </div>

        {params.verification === 'sent' && (
          <div
            role="status"
            className="border-accent/25 bg-accent/5 text-muted-foreground rounded-xl border px-4 py-3 text-sm"
          >
            We sent a verification link to <span className="text-foreground">{user.email}</span>.
            You can keep using DerList while you confirm it.
          </div>
        )}

        <Card className="border-accent/20 bg-accent/[0.03]">
          <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              <Badge variant="accent" className="w-fit">
                Open Beta
              </Badge>
              <h2 className="text-foreground text-xl font-semibold">
                Your account is ready. Start with one collection.
              </h2>
              <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                DerList keeps private lists of the products you want. There is no sample data here —
                everything you see is created by you.
              </p>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Create a collection',
                  body: 'Give it a name, an icon and a colour. Collections are private to your account.',
                },
                {
                  step: '2',
                  title: 'Add a product',
                  body: 'Paste a product URL to import its details, or add an item manually.',
                },
                {
                  step: '3',
                  title: 'Make it yours',
                  body: 'Set a target price, priority and private notes so you know what matters.',
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4"
                >
                  <span className="bg-accent/10 text-accent flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                    {item.step}
                  </span>
                  <span className="text-foreground text-sm font-medium">{item.title}</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">{item.body}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="glow-sm gap-2">
                <Link href="/wishlists/new">
                  <Plus className="h-4 w-4" aria-hidden /> Create your first collection
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/settings/profile">Review your profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-xs">
          Need help? The README and GitHub issues cover importing, providers and self-hosting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Hey, {user.displayName.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          Signed in as <span className="text-foreground font-medium">@{user.username}</span>
          {isWelcome ? ' — welcome to the Open Beta.' : '.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Wishlists"
          value={totalWishlists}
          icon={<List className="h-4 w-4" />}
        />
        <StatCard label="Total Items" value={totalItems} icon={<Package className="h-4 w-4" />} />
        <StatCard
          label="Purchased"
          value={purchasedItems}
          icon={<ShoppingCart className="h-4 w-4" />}
          color="text-success"
        />
        <StatCard
          label="Remaining"
          value={totalItems - purchasedItems}
          icon={<Heart className="h-4 w-4" />}
          color="text-accent"
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="glow-sm gap-2">
          <Link href="/wishlists/new">
            <Plus className="h-3.5 w-3.5" /> New Wishlist
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary" className="gap-2">
          <Link href="/wishlists">
            <List className="h-3.5 w-3.5" /> All Wishlists
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link href="/settings/profile">
            <Search className="h-3.5 w-3.5" /> Settings
          </Link>
        </Button>
      </div>

      {/* Price drops */}
      {actualDrops.length > 0 && (
        <Card className="border-success/20 bg-success/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-success flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4" /> Price Drops
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {actualDrops.map((drop) => {
                const oldP = parseFloat(drop.oldValue ?? '0');
                const newP = parseFloat(drop.newValue ?? '0');
                const saved = oldP - newP;
                return (
                  <Link
                    key={drop.id}
                    href={`/products/${drop.product.id}`}
                    className="border-border bg-card hover:bg-card-hover flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                  >
                    {drop.product.image ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                        <img
                          src={drop.product.image}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </span>
                    ) : (
                      <span className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                        <Package className="text-muted/30 h-4 w-4" />
                      </span>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <span className="text-foreground block truncate text-xs font-medium">
                        {drop.product.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-success text-xs font-semibold">
                          ${newP.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground text-[10px] line-through">
                          ${oldP.toFixed(2)}
                        </span>
                        <Badge variant="success" className="gap-0.5 text-[9px]">
                          <ArrowDown className="h-2.5 w-2.5" />${saved.toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent wishlists */}
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Wishlists</CardTitle>
            <Button asChild size="sm" variant="ghost" className="text-xs">
              <Link href="/wishlists">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentWishlists.length === 0 ? (
              <EmptyMini
                icon={<List className="h-7 w-7" />}
                text="No wishlists yet."
                cta="Create one"
                href="/wishlists/new"
              />
            ) : (
              <div className="space-y-1">
                {recentWishlists.map((wl) => (
                  <Link
                    key={wl.id}
                    href={`/wishlists/${wl.id}`}
                    className="hover:bg-card-hover flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                  >
                    <span className="bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm">
                      {wl.icon || '📋'}
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <span className="text-foreground block truncate text-sm font-medium">
                        {wl.title}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {wl._count.items} items
                      </span>
                    </div>
                    <VisibilityDot visibility={wl.visibility} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent items */}
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Items</CardTitle>
          </CardHeader>
          <CardContent>
            {recentItems.length === 0 ? (
              <EmptyMini icon={<Package className="h-7 w-7" />} text="No items yet." />
            ) : (
              <div className="space-y-1">
                {recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/wishlists/${item.wishlist.id}`}
                    className="hover:bg-card-hover flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                  >
                    {item.image ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                        <img src={item.image} alt="" className="h-full w-full object-contain" />
                      </span>
                    ) : (
                      <span className="bg-surface text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <Package className="h-4 w-4" />
                      </span>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <span
                        className={`block truncate text-sm font-medium ${item.purchased ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                      >
                        {item.title}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {item.wishlist.title}
                      </span>
                    </div>
                    {item.currentPrice != null && (
                      <span className="text-foreground shrink-0 text-xs font-medium">
                        ${Number(item.currentPrice).toFixed(2)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently imported */}
        {recentImports.length > 0 && (
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="text-accent h-4 w-4" /> Recently Imported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recentImports.map((item) => (
                  <Link
                    key={item.id}
                    href={`/wishlists/${item.wishlist.id}`}
                    className="border-border bg-surface hover:border-border-hover flex flex-col gap-2 rounded-xl border p-3 transition-all hover:shadow-md hover:shadow-black/10"
                  >
                    {item.image ? (
                      <span className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                        <img src={item.image} alt="" className="h-full w-full object-contain" />
                      </span>
                    ) : (
                      <span className="bg-card flex h-20 items-center justify-center rounded-lg">
                        <Package className="text-muted/20 h-6 w-6" />
                      </span>
                    )}
                    <span className="text-foreground line-clamp-2 text-xs font-medium">
                      {item.title}
                    </span>
                    <div className="flex items-center justify-between">
                      {item.currentPrice != null && (
                        <span className="text-foreground text-xs font-semibold">
                          ${Number(item.currentPrice).toFixed(2)}
                        </span>
                      )}
                      {item.retailer && (
                        <span className="text-muted-foreground text-[10px]">{item.retailer}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="hover-lift">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="bg-surface text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {label}
          </span>
          <span className={`text-2xl font-bold tabular-nums ${color ?? 'text-foreground'}`}>
            {value}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function VisibilityDot({ visibility }: { visibility: string }) {
  const colors: Record<string, string> = {
    PUBLIC: 'bg-success',
    UNLISTED: 'bg-warning',
    PRIVATE: 'bg-muted',
  };
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${colors[visibility] ?? colors.PRIVATE}`}
      title={visibility}
    />
  );
}

function EmptyMini({
  icon,
  text,
  cta,
  href,
}: {
  icon: React.ReactNode;
  text: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="text-muted/20">{icon}</span>
      <p className="text-muted-foreground text-xs">{text}</p>
      {cta && href && (
        <Button asChild size="sm" variant="outline" className="text-xs">
          <Link href={href}>{cta}</Link>
        </Button>
      )}
    </div>
  );
}
