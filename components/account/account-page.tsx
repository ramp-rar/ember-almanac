'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import type { AoiRef, RegionItem } from '@/lib/api/types';
import { placeName } from '@/lib/i18n/places';
import { useI18n } from '@/lib/i18n/use-locale';
import { AccountError, api, useMe, useSavePlace } from './use-account';

/** Sign in / create account, and "My places" once signed in. */
export function AccountPage() {
  const { t, locale } = useI18n();
  const A = t.account;
  const me = useMe();
  const verified = useSearchParams().get('verified');

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
  const signOut = async () => {
    await api('/api/auth/logout', 'POST', {});
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
    </section>
  );
}
