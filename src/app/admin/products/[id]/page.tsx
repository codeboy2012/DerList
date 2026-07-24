import type { Metadata } from 'next';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { calculateProductHealth } from '@/lib/products/health';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { ArrowLeft, BarChart3, Database, Package, RefreshCw, Shield } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { title: true } });
  return { title: `Inspect: ${product?.title ?? 'Product'} — ${siteConfig.name} Admin` };
}

export default async function AdminProductInspectorPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 10 },
      changes: { orderBy: { createdAt: 'desc' }, take: 10 },
      fetchJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { wishlistItems: true, priceHistory: true } },
    },
  });

  if (!product) notFound();

  const health = calculateProductHealth(product);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/admin/products" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 overflow-hidden">
          <h1 className="truncate text-lg font-semibold text-foreground">{product.title}</h1>
          <p className="text-xs text-muted-foreground">{product.canonicalUrl ?? 'Manual product'}</p>
        </div>
        <Badge variant={health.label === 'Excellent' ? 'success' : health.label === 'Good' ? 'default' : 'warning'}>
          {health.score}% Health
        </Badge>
      </div>

      {/* Product overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Refresh Count" value={String(product.refreshCount)} icon={<RefreshCw className="h-4 w-4" />} />
        <StatCard label="Avg Confidence" value={product.avgConfidence != null ? `${product.avgConfidence}%` : '—'} icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Price Records" value={String(product._count.priceHistory)} icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard label="Wishlists" value={String(product._count.wishlistItems)} icon={<Package className="h-4 w-4" />} />
      </div>

      {/* Identity & Metadata */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Database className="h-4 w-4 text-accent" /> Product Identity</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <Field label="ID" value={product.id} />
            <Field label="Source" value={product.source} />
            <Field label="Domain" value={product.domain} />
            <Field label="Retailer" value={product.retailer} />
            <Field label="Brand" value={product.brand} />
            <Field label="SKU" value={product.sku} />
            <Field label="MPN" value={product.mpn} />
            <Field label="GTIN" value={product.gtin} />
            <Field label="ASIN" value={product.asin} />
            <Field label="UPC" value={product.upc} />
            <Field label="Retailer ID" value={product.retailerProductId} />
            <Field label="Current Price" value={product.currentPrice ? `${product.currency} ${Number(product.currentPrice).toFixed(2)}` : null} />
            <Field label="In Stock" value={product.inStock != null ? (product.inStock ? 'Yes' : 'No') : null} />
            <Field label="Last Fetched" value={product.lastFetchedAt ? formatDate(product.lastFetchedAt) : null} />
            <Field label="Last Method" value={product.lastExtractionMethod} />
            <Field label="Created" value={formatDate(product.createdAt)} />
            <Field label="Canonical URL" value={product.canonicalUrl} mono />
          </dl>
        </CardContent>
      </Card>

      {/* Health Breakdown */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Health Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {health.breakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.category}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-surface">
                    <div className={`h-full rounded-full ${item.points === item.maxPoints ? 'bg-success' : item.points > 0 ? 'bg-warning' : 'bg-danger/30'}`} style={{ width: `${(item.points / item.maxPoints) * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-medium text-foreground tabular-nums">{item.points}/{item.maxPoints}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Price History */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Price History</CardTitle></CardHeader>
        <CardContent>
          {product.priceHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No price history yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border"><th className="px-2 py-1.5 text-left text-muted-foreground">Date</th><th className="px-2 py-1.5 text-left text-muted-foreground">Price</th><th className="px-2 py-1.5 text-left text-muted-foreground">Method</th><th className="px-2 py-1.5 text-left text-muted-foreground">Confidence</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {product.priceHistory.map((ph) => (
                    <tr key={ph.id}>
                      <td className="px-2 py-1.5 text-muted-foreground">{formatDate(ph.recordedAt)}</td>
                      <td className="px-2 py-1.5 font-medium text-foreground">{ph.currency} {Number(ph.price).toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{ph.extractionMethod ?? '—'}</td>
                      <td className="px-2 py-1.5">{ph.extractionConfidence != null ? <Badge variant={ph.extractionConfidence >= 80 ? 'success' : ph.extractionConfidence >= 50 ? 'warning' : 'danger'} className="text-[9px]">{ph.extractionConfidence}%</Badge> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Fetch Jobs */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Fetch Jobs</CardTitle></CardHeader>
        <CardContent>
          {product.fetchJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No fetch jobs recorded.</p>
          ) : (
            <div className="space-y-2">
              {product.fetchJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={job.status === 'SUCCESS' ? 'success' : job.status === 'FAILED' ? 'danger' : 'warning'} className="text-[9px]">{job.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">Attempt {job.attempts}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.error && <span className="max-w-[200px] truncate text-[10px] text-danger">{job.error}</span>}
                    <span className="text-[10px] text-muted-foreground">{formatDate(job.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Changes */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Changes</CardTitle></CardHeader>
        <CardContent>
          {product.changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {product.changes.map((change) => (
                <div key={change.id} className="flex items-center justify-between rounded-md bg-surface px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{change.changeType}</Badge>
                    <span className="text-[10px] text-muted-foreground line-through">{change.oldValue ?? '—'}</span>
                    <span className="text-[10px] text-foreground">{change.newValue ?? '—'}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDate(change.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image */}
      {product.image && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Product Image</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-xl border border-border bg-white/5">
              <img src={product.image} alt="" className="h-full w-full object-contain p-2" />
            </div>
            <p className="mt-2 max-w-md truncate text-[10px] text-muted-foreground font-mono">{product.image}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">{icon}</span>
        <div><span className="block text-[10px] text-muted-foreground">{label}</span><span className="text-base font-semibold text-foreground">{value}</span></div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? 'font-mono text-xs' : ''} ${!value ? 'text-muted-foreground' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  );
}
