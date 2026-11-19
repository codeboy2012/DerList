import type { ReactNode } from 'react';

/** Authentication pages sit outside the marketing and app layouts. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="flex-1">{children}</main>;
}
