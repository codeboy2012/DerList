import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import Link from 'next/link';

/**
 * 404. The root layout provides <html>/<body>; this file MUST NOT.
 */
export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-7xl font-bold tracking-tight text-foreground">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. It may arrive
        in a future phase of the project.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Go back home</Link>
      </Button>
    </Container>
  );
}
