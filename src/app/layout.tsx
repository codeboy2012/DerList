import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PREFERENCES_BOOT_SCRIPT } from '@/lib/preferences/local-settings';
import { siteConfig } from '@/lib/site-config';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { ToastProvider } from '@/components/ui/Toast';
import { PreferencesProvider } from '@/components/preferences/PreferencesProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    'wishlist',
    'personal organizer',
    'collection tracker',
    'product organizer',
    'open source',
    siteConfig.name,
  ],
  authors: [{ name: 'CodeBoy2012' }],
  creator: 'CodeBoy2012',
  publisher: siteConfig.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.ico', sizes: '16x16' },
      { url: '/icons/favicon-32.ico', sizes: '32x32' },
      { url: '/icons/favicon-48.ico', sizes: '48x48' },
      { url: '/icons/favicon-64.ico', sizes: '64x64' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply stored local preferences before first paint (no theme flash). */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground flex min-h-screen flex-col font-sans antialiased">
        <PreferencesProvider>
          <ToastProvider>
            <CommandPalette />
            <a
              href="#main-content"
              className="focus:bg-card focus:text-foreground sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
            >
              Skip to main content
            </a>
            <main id="main-content" className="flex min-h-screen flex-col">
              {children}
            </main>
          </ToastProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
