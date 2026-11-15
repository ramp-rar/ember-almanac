import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { DatasetBanner } from '@/components/dataset-banner';
import { Providers } from '@/components/providers';
import { HeaderControls, SkipLink, Tagline } from '@/components/site-chrome';
import { LOCALE_SCRIPT, THEME_SCRIPT } from '@/lib/head-scripts';
import { APP_NAME, APP_TAGLINE, splitName } from '@/lib/brand';
import './globals.css';

const serif = Source_Serif_4({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-serif',
  weight: ['600'],
});
const sans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-plex',
  weight: ['400', '500', '600'],
});
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Burning Calendar`,
  description: `${APP_TAGLINE} A sensor-harmonized burning-activity calendar for any area on Earth.`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f2ec' },
    { media: '(prefers-color-scheme: dark)', color: '#12110f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [first, rest] = splitName();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + LOCALE_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <SkipLink />
        <Providers>
          <header className="border-line bg-ink/90 sticky top-0 z-40 border-b backdrop-blur">
            <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:gap-x-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2" aria-label={APP_NAME}>
                <Logo />
                <span className="font-mono text-[15px] font-semibold tracking-tight">
                  {first} <span className="text-ember-text">{rest}</span>
                </span>
              </Link>
              <Tagline />
              <HeaderControls />
            </div>
          </header>
          <Suspense fallback={<div className="h-9" />}>
            <DatasetBanner />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}

/** A calendar grid with one burning cell: the product in one glyph. */
function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={1 + c * 7}
            y={1 + r * 7}
            width="6"
            height="6"
            rx="1.5"
            fill={r === 1 && c === 2 ? 'var(--t-ember)' : 'currentColor'}
            opacity={r === 1 && c === 2 ? 1 : 0.25 + 0.2 * ((r + c) % 3)}
          />
        )),
      )}
    </svg>
  );
}
