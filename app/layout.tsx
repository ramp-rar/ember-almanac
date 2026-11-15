import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { DatasetBanner } from '@/components/dataset-banner';
import { Providers } from '@/components/providers';
import { APP_NAME, APP_TAGLINE, splitName } from '@/lib/brand';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: `${APP_NAME} — Burning Calendar`,
  description: `${APP_TAGLINE} A sensor-harmonized burning-activity calendar for any area on Earth.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>
          <div className="border-line flex items-center justify-between border-b px-4 py-2.5 sm:px-6">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight">
              {splitName()[0]} <span className="text-ember">{splitName()[1]}</span>
            </Link>
            <p className="text-muted hidden text-xs sm:block">{APP_TAGLINE}</p>
          </div>
          <Suspense
            fallback={<p className="border-line border-b px-4 py-2 font-mono text-xs">…</p>}
          >
            <DatasetBanner />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
