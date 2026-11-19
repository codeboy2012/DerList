'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

/**
 * Shown when an archived product is missing, permanently deleted, or belongs
 * to another account. The response is the same 404 in all cases so foreign ids
 * cannot be distinguished from deleted ones.
 */
export default function ArchivedProductNotFound() {
  const params = useParams<{ id: string }>();
  const wishlistId = typeof params?.id === 'string' ? params.id : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link
            href={wishlistId ? `/wishlists/${wishlistId}/archive` : '/wishlists'}
            aria-label="Back to archived products"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
        <span className="text-muted-foreground text-xs">Archived products</span>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Archive className="text-muted-foreground/40 h-10 w-10" aria-hidden />
          <div className="flex flex-col gap-1">
            <h1 className="text-foreground text-lg font-semibold">Archived product not found</h1>
            <p className="text-muted-foreground max-w-md text-sm">
              This archived product may have been restored, permanently deleted, or it may belong to
              another account.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {wishlistId && (
              <Button asChild size="sm">
                <Link href={`/wishlists/${wishlistId}/archive`}>Back to archive</Link>
              </Button>
            )}
            <Button asChild size="sm" variant="secondary">
              <Link href="/wishlists">All collections</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
