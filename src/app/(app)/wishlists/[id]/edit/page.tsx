import type { Metadata } from 'next';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { ArrowLeft } from 'lucide-react';

import { EditWishlistForm } from './EditWishlistForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: wishlist ? `Edit ${wishlist.title} — ${siteConfig.name}` : `Edit Wishlist — ${siteConfig.name}`,
  };
}

export default async function EditWishlistPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      icon: true,
      color: true,
      archived: true,
      ownerId: true,
    },
  });

  if (!wishlist || wishlist.ownerId !== user.id) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href={`/wishlists/${id}`} aria-label="Back to wishlist">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Edit Wishlist</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{wishlist.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditWishlistForm wishlist={wishlist} />
        </CardContent>
      </Card>
    </div>
  );
}
