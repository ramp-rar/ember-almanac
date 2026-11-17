'use client';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { APP_NAME } from '@/lib/brand';
import { aoiApiBase, type AoiRef, type CalendarResponse, type RegionItem } from '@/lib/api/types';
import { times } from '@/lib/i18n/copy';
import { placeName } from '@/lib/i18n/places';
import { useI18n } from '@/lib/i18n/use-locale';
import { AccountError, api, useMe, useSavePlace } from './use-account';

/** Sign in / create account, and "My places" once signed in. */
export function AccountPage() {
  const { t, locale } = useI18n();
  const A = t.account;
  const me = useMe();
  useEffect(() => {
    document.title = `${A.title} · ${APP_NAME}`;
  }, [A.title]);
  const params = useSearchParams();
  const verified = params.get('verified');
  const deleted = params.get('deleted') === '1';

  return (
    <main id="main" className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">{A.title}</h1>
      <p className="text-muted mt-2">{A.lead}</p>

      {verified === 'ok' && (
        <p role="status" className="card mt-5 border-l-4 border-l-[var(--t-ember)] p-4 text-sm">
          {A.verifiedOk}
        </p>
      )}
      {(verified === 'invalid' || verified === 'error') && (
        <p role="alert" className="card text-warn mt-5 p-4 text-sm">
          {A.verifiedBad}
        </p>
      )}

      {me.data && !me.data.accounts && (
        <p role="status" className="card mt-6 p-5">
          {A.unavailable}
        </p>
      )}
      {me.data?.accounts && !me.data.user && <AuthForms locale={locale} />}
      {me.data?.user && <SignedIn email={me.data.user.email} places={me.data.user.places} />}
      {deleted && (
        <p role="status" className="card mt-6 p-5">
          {A.deleted}
        </p>
      )}
    </main>
  );
}

function AuthForms({ locale }: { locale: string }) {
  const { t } = useI18n();
  const A = t.account;
  const qc = useQueryClient();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      if (tab === 'login') {
        await api('/api/auth/login', 'POST', { email, password, locale });
        await qc.invalidateQueries({ queryKey: ['me'] });
      } else {
        const r = await api<{ mailSent: boolean }>('/api/auth/register', 'POST', {
          email,
          password,
          locale,
        });
        setDone(r.mailSent ? A.registered : A.registeredNoMail);
        setTab('login');
        setPassword('');
      }
    } catch (err) {
      const code = err instanceof AccountError ? err.code : 'internal';
      setError(A.errors[code] ?? A.errors.internal!);
    } finally {
      setBusy(false);
    }
  };

  const input =
    'border-line bg-ink focus:border-ember mt-1 w-full rounded-lg border px-3 py-2.5 text-base outline-none';
  return (
    <section className="card mt-6 p-5 sm:p-6">
      <div role="tablist" className="border-line flex gap-1 border-b text-sm">
        {(['login', 'register'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setError(null);
            }}
            className={`-mb-px border-b-2 px-3 py-2 font-medium ${tab === k ? 'border-ember text-text' : 'text-muted border-transparent'}`}
          >
            {A.tabs[k]}
          </button>
        ))}
      </div>
      {done && (
        <p role="status" className="mt-4 text-sm">
          {done}
        </p>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <label className="block text-sm" htmlFor={`${id}-e`}>
          <span className="text-muted">{A.email}</span>
          <input
            id={`${id}-e`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </label>
        <label className="block text-sm" htmlFor={`${id}-p`}>
          <span className="text-muted">{A.password}</span>
          <input
            id={`${id}-p`}
            type="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
            aria-describedby={`${id}-h`}
          />
          <span id={`${id}-h`} className="text-muted mt-1 block text-xs">
            {A.passwordHint}
          </span>
        </label>
        {error && (
          <p role="alert" className="text-warn text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="bg-ember text-on-ember min-h-11 w-full rounded-full px-4 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? A.busy : tab === 'login' ? A.submitLogin : A.submitRegister}
        </button>
      </form>
    </section>
  );
}

function SignedIn({ email, places }: { email: string; places: string[] }) {
  const i = useI18n();
  const { t } = i;
  const regions = useQuery({
    queryKey: ['regions', ''],
    queryFn: () => api<RegionItem[]>('/api/regions?q=', 'GET'),
    staleTime: 3_600_000,
  });
  const nameOf = (p: string) => {
    const ref: AoiRef = p.startsWith('r:')
      ? { kind: 'region', iso3: p.slice(2) }
      : { kind: 'aoi', id: p.slice(2) };
    const r = ref.kind === 'region' ? regions.data?.find((x) => x.iso3 === ref.iso3) : undefined;
    return placeName(ref, r?.nameEn ?? p.slice(2).replaceAll('_', ' '), r?.names, i);
  };
  const A = t.account;
  const qc = useQueryClient();
  const save = useSavePlace();
  const [signOutError, setSignOutError] = useState(false);
  const signOut = async () => {
    try {
      await api('/api/auth/logout', 'POST', {});
    } catch {
      setSignOutError(true);
    }
    await qc.invalidateQueries({ queryKey: ['me'] });
  };
  return (
    <section className="card mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{A.signedInAs(email)}</p>
        <button
          type="button"
          onClick={signOut}
          className="border-line hover:border-ember min-h-9 rounded-full border px-4 text-sm"
        >
          {A.signOut}
        </button>
      </div>
      {signOutError && (
        <p role="alert" className="text-warn mt-2 text-sm">
          {A.errors.internal}
        </p>
      )}
      <h2 className="mt-6 text-lg font-semibold">{A.myPlaces}</h2>
      {places.length === 0 ? (
        <p className="text-muted mt-2 text-sm">{A.noPlaces}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {places.map((p) => {
            const href = p.startsWith('r:') ? `/r/${p.slice(2)}` : `/a/${p.slice(2)}`;
            return (
              <li
                key={p}
                className="border-line flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <Link href={href} className="font-medium hover:underline">
                  {nameOf(p)}
                </Link>
                <button
                  type="button"
                  onClick={() => save.mutate({ placeId: p, saved: false })}
                  className="text-muted hover:text-text text-sm"
                >
                  {A.remove}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {places.length > 0 && <Watch places={places} nameOf={nameOf} />}
      <DeleteAccount />
    </section>
  );
}

function refOf(p: string): AoiRef {
  return p.startsWith('r:')
    ? { kind: 'region', iso3: p.slice(2) }
    : { kind: 'aoi', id: p.slice(2) };
}

/** The latest complete month of every saved place, flagged when it is outside the usual range. */
function Watch({ places, nameOf }: { places: string[]; nameOf: (p: string) => string }) {
  const i = useI18n();
  const A = i.t.account;
  const results = useQueries({
    queries: places.map((p) => ({
      queryKey: ['calendar', refOf(p)],
      queryFn: () => api<CalendarResponse>(`${aoiApiBase(refOf(p))}/calendar`, 'GET'),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">{A.watchTitle}</h2>
      <ul className="mt-3 space-y-2">
        {places.map((p, k) => {
          const data = results[k]?.data;
          const sel = data?.calendar.selected;
          const cell = sel ? data.calendar.cells.find((c) => c.y === sel.y && c.m === sel.m) : null;
          const pct = cell?.r.k === 'ratio' ? cell.r.p : null;
          const tone = pct === null ? null : pct >= 90 ? 'high' : pct <= 10 ? 'low' : 'usual';
          return (
            <li key={p} className="border-line rounded-lg border px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{nameOf(p)}</span>
                {cell && (
                  <span className="text-muted text-xs">
                    {i.month(cell.m)} {cell.y} · {i.t.status.title[cell.s]}
                  </span>
                )}
              </div>
              {cell?.r.k === 'ratio' && cell.r.v !== null && (
                <p className="mt-1">
                  <span className="font-mono font-semibold">{times(cell.r.v, i)}</span>{' '}
                  <span
                    className={
                      tone === 'high'
                        ? 'text-ember-text font-semibold'
                        : tone === 'low'
                          ? 'text-cool font-semibold'
                          : 'text-muted'
                    }
                  >
                    {tone === 'high' ? A.watchHigh : tone === 'low' ? A.watchLow : A.watchUsual}
                  </span>{' '}
                  <span className="text-muted font-mono text-xs">(P{pct})</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-muted mt-2 text-xs">{A.watchNote}</p>
    </div>
  );
}

function DeleteAccount() {
  const { t } = useI18n();
  const A = t.account;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/delete', 'POST', { password });
      await qc.invalidateQueries({ queryKey: ['me'] });
      window.history.replaceState(null, '', '/account?deleted=1');
    } catch (err) {
      const code = err instanceof AccountError ? err.code : 'internal';
      setError(A.errors[code] ?? A.errors.internal!);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-line mt-8 border-t pt-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted hover:text-text text-sm underline underline-offset-2"
        >
          {A.deleteTitle}
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <h2 className="text-base font-semibold">{A.deleteTitle}</h2>
          <p className="text-muted text-sm">{A.deleteLead}</p>
          <label className="block text-sm" htmlFor={`${id}-p`}>
            <span className="text-muted">{A.password}</span>
            <input
              id={`${id}-p`}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-line bg-ink focus:border-ember mt-1 w-full rounded-lg border px-3 py-2.5 text-base outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="text-warn text-sm">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="min-h-10 rounded-full border border-[#b42318] px-4 text-sm font-semibold text-[#b42318] disabled:opacity-60 dark:border-[#f97066] dark:text-[#f97066]"
          >
            {busy ? A.busy : A.deleteConfirm}
          </button>
        </form>
      )}
    </div>
  );
}
