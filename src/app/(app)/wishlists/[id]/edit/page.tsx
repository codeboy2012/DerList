import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { wishlistMetadataTitle } from '@/lib/wishlists/metadata';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EditWishlistForm } from './EditWishlistForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  // Owner-scoped: a foreign or missing collection gets generic metadata so its
  // title never appears in another account's document title.
  const user = await getCurrentUser();
  return {
    title: await wishlistMetadataTitle(id, user?.id ?? null, 'edit'),
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
        <h1 className="text-foreground text-xl font-semibold">Edit Wishlist</h1>
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
