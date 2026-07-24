'use client';

import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Centralised place to report errors to telemetry later.
    // eslint-disable-next-line no-console
    console.error('DerList: unhandled error', error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger"
      >
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.digest
          ? `An unexpected error occurred. Reference: ${error.digest}`
          : error.message || 'An unexpected error occurred.'}
      </p>
      <Button onClick={() => reset()} className="mt-2">
        Try again
      </Button>
    </Container>
  );
}
