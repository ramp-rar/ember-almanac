'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { LOCALES, MESSAGES, type Locale, type Messages } from './messages';

import { LOCALE_KEY as KEY } from '@/lib/head-scripts';

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  return () => obs.disconnect();
}

function read(): Locale {
  const v = document.documentElement.getAttribute('data-lang');
  return (LOCALES as readonly string[]).includes(v ?? '') ? (v as Locale) : 'en';
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, read, () => 'en');
}

export function setLocale(l: Locale): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  document.documentElement.setAttribute('data-lang', l);
  document.documentElement.setAttribute('lang', l);
}

export interface I18n {
  readonly locale: Locale;
  readonly t: Messages;
  /** Locale-aware number: 0 → "0", <10 → one decimal, else integer, grouped. null → "—". */
  readonly n: (v: number | null | undefined) => string;
  readonly signed: (v: number) => string;
  readonly month: (m: number) => string;
}

export function useI18n(): I18n {
  const locale = useLocale();
  return useMemo(() => {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    const n = (v: number | null | undefined) => {
      if (v === null || v === undefined) return '—';
      if (v === 0) return '0';
      return v.toLocaleString(tag, {
        minimumFractionDigits: 0,
        maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0,
      });
    };
    const t = MESSAGES[locale];
    return {
      locale,
      t,
      n,
      signed: (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(Math.abs(v))}`,
      month: (m: number) => t.monthsLong[m - 1] ?? String(m),
    };
  }, [locale]);
}
