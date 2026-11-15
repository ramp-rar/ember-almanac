'use client';

import { LOCALES, LOCALE_NAME, LOCALE_SHORT } from '@/lib/i18n/messages';
import Link from 'next/link';
import { useMe } from '@/components/account/use-account';
import { setLocale, useI18n } from '@/lib/i18n/use-locale';
import { ThemeToggle } from './theme';

/** Localized pieces of the page frame (the layout itself is a server component). */

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main"
      className="bg-text text-ink sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      {t.nav.skip}
    </a>
  );
}

export function Tagline() {
  const { t } = useI18n();
  return <p className="text-muted hidden min-w-0 truncate text-sm lg:block">{t.nav.tagline}</p>;
}

export function HeaderControls() {
  const { t, locale } = useI18n();
  return (
    <>
      <nav aria-label={t.nav.sections} className="ml-auto flex items-center gap-1 text-sm">
        <a
          href="#how"
          className="text-muted hover:text-text hidden rounded-full px-3 py-1.5 md:block"
        >
          {t.nav.how}
        </a>
        <a
          href="#glossary"
          className="text-muted hover:text-text hidden rounded-full px-3 py-1.5 md:block"
        >
          {t.nav.glossary}
        </a>
      </nav>
      <div
        role="radiogroup"
        aria-label={t.nav.language}
        className="border-line bg-panel flex rounded-full border p-0.5"
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            lang={l}
            aria-checked={locale === l}
            aria-label={LOCALE_NAME[l]}
            title={LOCALE_NAME[l]}
            onClick={() => setLocale(l)}
            className={`min-h-9 min-w-9 rounded-full px-2 font-mono text-xs font-semibold transition-colors ${
              locale === l ? 'bg-text text-ink' : 'text-muted hover:text-text'
            }`}
          >
            {LOCALE_SHORT[l]}
          </button>
        ))}
      </div>
      <AccountLink />
      <ThemeToggle />
    </>
  );
}

function AccountLink() {
  const { t } = useI18n();
  const me = useMe();
  if (!me.data?.accounts) return null;
  const signedIn = Boolean(me.data.user);
  return (
    <Link
      href="/account"
      className="border-line hover:border-ember flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium"
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
      <span className="hidden sm:inline">{signedIn ? t.account.myPlaces : t.account.signIn}</span>
      <span className="sr-only sm:hidden">{signedIn ? t.account.myPlaces : t.account.signIn}</span>
    </Link>
  );
}

export function BannerText({
  mock,
  version,
  sp,
  nrt,
}: {
  mock: boolean;
  version: string;
  sp: string;
  nrt: string;
}) {
  const { t } = useI18n();
  return (
    <>
      {mock && (
        <>
          <strong className="bg-ember text-on-ember rounded px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide">
            MOCK DATA
          </strong>
          <span>{t.banner.mockText}</span>
        </>
      )}
      <span className="text-muted font-mono text-xs sm:ml-auto">
        {t.banner.line(version, sp, nrt)}
      </span>
    </>
  );
}
