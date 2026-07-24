import type { Metadata } from 'next';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { siteConfig } from '@/lib/site-config';
import { ArrowLeft } from 'lucide-react';

import { CreateWishlistForm } from './CreateWishlistForm';

export const metadata: Metadata = {
  title: `New Wishlist — ${siteConfig.name}`,
};

export default function NewWishlistPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/wishlists" aria-label="Back to wishlists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">New Wishlist</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Create a new wishlist</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateWishlistForm />
        </CardContent>
      </Card>
    </div>
  );
}
