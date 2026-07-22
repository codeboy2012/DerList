import Link from 'next/link';
import React from 'react';
import clsx from '@/utils/clsx';

export const Header: React.FC = () => {
  return (
    <header className="bg-background border-b border-gray-200">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-foreground text-2xl font-bold">
          Derlist
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/about"
            className={clsx(
              'rounded px-4 py-2 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'bg-gray-200 text-gray-800 hover:bg-gray-300'
            )}
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
};
