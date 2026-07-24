import { Spinner } from '@/components/ui/Spinner';

/**
 * Next.js automatically wraps the page in <Suspense> and renders this
 * while the route segment streams in. Per the App Router contract this
 * file MUST NOT render its own <html> or <body>.
 */
export default function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8"
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
