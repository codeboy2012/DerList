'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { enqueueProductRefresh, syncProduct } from '@/lib/jobs';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Queue a product for background refresh
// ─────────────────────────────────────────────────────────────────────────────

export async function queueRefreshAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const productId = formData.get('productId') as string;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, canonicalUrl: true },
  });
  if (!product || !product.canonicalUrl) return;

  await enqueueProductRefresh(productId);

  await logAudit({
    action: 'product.refresh_queued' as never,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'product',
    targetId: product.id,
    targetName: product.title,
  });

  revalidatePath('/admin/products');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync a product immediately (inline, not queued)
// ─────────────────────────────────────────────────────────────────────────────

export async function syncNowAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const productId = formData.get('productId') as string;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, canonicalUrl: true },
  });
  if (!product || !product.canonicalUrl) return;

  await syncProduct(productId);

  await logAudit({
    action: 'product.synced' as never,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'product',
    targetId: product.id,
    targetName: product.title,
  });

  revalidatePath('/admin/products');
  revalidatePath(`/products/${productId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a product
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteProductAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const productId = formData.get('productId') as string;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true },
  });
  if (!product) return;

  await prisma.product.delete({ where: { id: productId } });

  await logAudit({
    action: 'product.deleted' as never,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'product',
    targetId: product.id,
    targetName: product.title,
  });

  revalidatePath('/admin/products');
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry all failed jobs
// ─────────────────────────────────────────────────────────────────────────────

export async function retryFailedJobsAction(): Promise<void> {
  await requireAdmin();

  await prisma.productFetchJob.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', nextRunAt: new Date(), attempts: 0, error: null },
  });

  revalidatePath('/admin/products');
}
