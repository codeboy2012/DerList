import type { ReactNode } from 'react';

import Link from 'next/link';

import { siteConfig } from '@/lib/site-config';
import { ArrowLeft } from 'lucide-react';

import { SettingsNav } from './SettingsNav';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <SettingsNav />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
