import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { DatasetBanner } from '@/components/dataset-banner';
import { Providers } from '@/components/providers';
import { THEME_SCRIPT, ThemeToggle } from '@/components/theme';
import { APP_NAME, APP_TAGLINE, splitName } from '@/lib/brand';
import './globals.css';

const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', weight: ['600'] });
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex',
  weight: ['400', '500', '600'],
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="bg-text text-ink sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <Providers>
          <header className="border-line bg-ink/90 sticky top-0 z-40 border-b backdrop-blur">
            <div className="mx-auto flex max-w-[88rem] items-center gap-4 px-4 py-2.5 sm:px-6">
              <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
                <Logo />
                <span className="font-mono text-[15px] font-semibold tracking-tight">
                  {first} <span className="text-ember-text">{rest}</span>
                </span>
              </Link>
              <p className="text-muted hidden min-w-0 truncate text-sm lg:block">{APP_TAGLINE}</p>
              <nav aria-label="Page" className="ml-auto flex items-center gap-1 text-sm">
                <a
                  href="#how"
                  className="text-muted hover:text-text hidden rounded-full px-3 py-1.5 sm:block"
                >
                  How it works
                </a>
                <a
                  href="#glossary"
                  className="text-muted hover:text-text hidden rounded-full px-3 py-1.5 sm:block"
                >
                  Glossary
                </a>
              </nav>
              <ThemeToggle />
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
