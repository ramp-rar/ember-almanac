'use client';

import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';
const KEY = 'ft-theme';

/**
 * Runs before first paint (inlined in <head>): resolves the stored preference or the OS setting
 * into data-theme on <html>, so there is no flash of the wrong theme. Follows OS changes in "system".
 */
export const THEME_SCRIPT = `(function(){try{var k='${KEY}',d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var t=p==='light'||p==='dark'?p:(m.matches?'dark':'light');d.setAttribute('data-theme',t);d.setAttribute('data-theme-pref',p==='light'||p==='dark'?p:'system')}a();m.addEventListener('change',a);window.__ftTheme=a}catch(e){}})();`;

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-theme-pref'],
  });
  return () => obs.disconnect();
}

/** The theme actually on screen (for canvas/SVG libraries that cannot read CSS variables). */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
    () => 'light',
  );
}

function usePref(): ThemePref {
  return useSyncExternalStore(
    subscribe,
    () =>
      (document.documentElement.getAttribute('data-theme-pref') as ThemePref | null) ?? 'system',
    () => 'system',
  );
}

function setPref(p: ThemePref) {
  try {
    if (p === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  const w = window as unknown as { __ftTheme?: () => void };
  if (w.__ftTheme) w.__ftTheme();
  else {
    const dark =
      p === 'dark' || (p === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-pref', p);
  }
}

const OPTIONS: { key: ThemePref; label: string; icon: React.ReactNode }[] = [
  {
    key: 'light',
    label: 'Light',
    icon: (
      <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
    ),
  },
  {
    key: 'dark',
    label: 'Dark',
    icon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  },
  {
    key: 'system',
    label: 'Auto',
    icon: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
  },
];

/** Light / Dark / Auto (follows the device). */
export function ThemeToggle() {
  const pref = usePref();
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="border-line bg-panel flex rounded-full border p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={pref === o.key}
          title={o.key === 'system' ? 'Follow the device setting' : `${o.label} theme`}
          onClick={() => setPref(o.key)}
          className={`flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors ${
            pref === o.key ? 'bg-text text-ink' : 'text-muted hover:text-text'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {o.icon}
          </svg>
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
