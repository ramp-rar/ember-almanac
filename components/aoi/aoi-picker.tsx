'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { useUi } from '@/components/ui-store';
import type { AoiCreated, ApiError, RegionItem } from '@/lib/api/types';
import { MAX_RADIUS_KM, MIN_RADIUS_KM, validateAoi, type AoiInput } from '@/lib/h3/aoi-id';
import { regionLabel } from '@/lib/i18n/places';
import { useI18n } from '@/lib/i18n/use-locale';

type Tab = 'region' | 'coords' | 'draw';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error((body as ApiError).message ?? `HTTP ${res.status}`);
  return body as T;
}

/** F01: three ways to choose an area. All end on a calendar URL (/r/<ISO3> or /a/<aoiId>). */
export function AoiPicker() {
  const { t } = useI18n();
  const P = t.picker;
  const [tab, setTab] = useState<Tab>('region');
  const draft = useUi((s) => s.draftPoint);
  // A point picked on the map opens the coordinates form (state adjusted during render, not in an effect).
  const [seenDraft, setSeenDraft] = useState(draft);
  if (draft !== seenDraft) {
    setSeenDraft(draft);
    setTab('coords');
  }
  const id = useId();
  const tabs: { key: Tab; label: string }[] = [
    { key: 'region', label: P.tabs.region },
    { key: 'coords', label: P.tabs.coords },
    { key: 'draw', label: P.tabs.draw },
  ];
  return (
    <section aria-labelledby={`${id}-h`} className="card p-4 sm:p-5">
      <h2 id={`${id}-h`} className="font-display text-sm font-medium">
        {P.title}
      </h2>
      <div role="tablist" className="border-line mt-3 flex gap-1 border-b text-xs">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-controls={`${id}-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 ${tab === t.key ? 'border-ember text-text' : 'text-muted border-transparent hover:text-[var(--color-text)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${id}-${tab}`} role="tabpanel" className="pt-3">
        {tab === 'region' && (
          <>
            <LocateMe />
            <RegionSearch />
          </>
        )}
        {tab === 'coords' && (
          <CoordinatesForm key={draft ? `${draft.lat},${draft.lon}` : 'none'} draft={draft} />
        )}
        {tab === 'draw' && (
          <div className="text-muted space-y-2 text-xs">
            <p>{P.draw1}</p>
            <p>{P.draw2}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** The first region whose bounding box contains the point (regions are few; bbox is enough). */
export function regionAt(
  regions: readonly RegionItem[],
  lat: number,
  lon: number,
): RegionItem | null {
  return (
    regions.find(
      (r) => lon >= r.bbox[0] && lon <= r.bbox[2] && lat >= r.bbox[1] && lat <= r.bbox[3],
    ) ?? null
  );
}

function LocateMe() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const P = t.picker;
  const [state, setState] = useState<'idle' | 'busy' | string>('idle');
  const [hit, setHit] = useState<RegionItem | null>(null);
  const all = useQuery({
    queryKey: ['regions', ''],
    queryFn: () => getJson<RegionItem[]>('/api/regions?q='),
    staleTime: 60 * 60 * 1000,
  });
  const locate = () => {
    if (!('geolocation' in navigator)) return setState(P.locateFailed);
    setState('busy');
    setHit(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const regions = all.data ?? [];
        const found = regionAt(regions, pos.coords.latitude, pos.coords.longitude);
        if (found) {
          setHit(found);
          setState('idle');
        } else
          setState(
            P.notCovered(regions.map((r) => regionLabel(r.names, r.nameEn, locale)).join(', ')),
          );
      },
      () => setState(P.locateFailed),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={locate}
        disabled={state === 'busy' || !all.data}
        className="border-line hover:border-ember flex min-h-10 w-full items-center justify-center gap-2 rounded-full border px-3 text-sm font-medium disabled:opacity-60"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="7" />
        </svg>
        {state === 'busy' ? P.locating : P.locate}
      </button>
      {hit && (
        <div role="status" className="mt-2 text-xs">
          <p>{P.near(regionLabel(hit.names, hit.nameEn, locale))}</p>
          <button
            type="button"
            onClick={() => router.push(`/r/${hit.iso3}`)}
            className="text-ember-text mt-1 font-semibold underline underline-offset-2"
          >
            {P.open(regionLabel(hit.names, hit.nameEn, locale))}
          </button>
        </div>
      )}
      {state !== 'idle' && state !== 'busy' && (
        <p role="status" className="text-warn mt-2 text-xs">
          {state}
        </p>
      )}
    </div>
  );
}

function RegionSearch() {
  const { t, locale } = useI18n();
  const P = t.picker;
  const router = useRouter();
  const [q, setQ] = useState('');
  const listId = useId();
  const { data, isError, error, isFetching } = useQuery({
    queryKey: ['regions', q.trim()],
    queryFn: () => getJson<RegionItem[]>(`/api/regions?q=${encodeURIComponent(q.trim())}`),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <div>
      <label htmlFor={`${listId}-q`} className="text-muted block text-xs">
        {P.search}
      </label>
      <input
        id={`${listId}-q`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={P.placeholder}
        autoComplete="off"
        className="border-line bg-ink focus:border-ember mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        aria-controls={listId}
      />
      {isError && <p className="text-warn mt-2 text-xs">{(error as Error).message}</p>}
      <ul
        id={listId}
        className="mt-2 max-h-48 space-y-0.5 overflow-auto text-sm"
        aria-busy={isFetching}
      >
        {data?.map((r) => (
          <li key={r.iso3}>
            <button
              type="button"
              onClick={() => router.push(`/r/${r.iso3}`)}
              className="hover:bg-panel-2 flex w-full items-center justify-between rounded px-2 py-1 text-left"
            >
              <span>{regionLabel(r.names, r.nameEn, locale)}</span>
              {r.iso3.length === 3 && (
                <span className="text-muted font-mono text-xs">{r.iso3}</span>
              )}
            </button>
          </li>
        ))}
        {data?.length === 0 && <li className="text-muted px-2 text-xs">{P.noMatch}</li>}
      </ul>
    </div>
  );
}

function CoordinatesForm({ draft }: { draft: { lat: number; lon: number } | null }) {
  const P = useI18n().t.picker;
  const router = useRouter();
  const [kind, setKind] = useState<'point' | 'bbox'>('point');
  const [f, setF] = useState({
    lat: draft ? draft.lat.toFixed(3) : '43.5',
    lon: draft ? draft.lon.toFixed(3) : '67.0',
    radius: '50',
    west: '',
    south: '',
    east: '',
    north: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));
    const input: AoiInput =
      kind === 'point'
        ? { kind, lat: n(f.lat), lon: n(f.lon), radiusKm: n(f.radius) }
        : { kind, west: n(f.west), south: n(f.south), east: n(f.east), north: n(f.north) };
    const problems = validateAoi(input);
    setErrors(problems);
    if (problems.length > 0) return;
    setBusy(true);
    try {
      const created = await getJson<AoiCreated>('/api/aoi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      router.push(`/a/${created.aoiId}`);
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof f, label: string, hint?: string) => (
    <label className="block text-xs">
      <span className="text-muted">{label}</span>
      <input
        inputMode="decimal"
        value={f[key]}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        className="border-line bg-ink focus:border-ember mt-1 w-full rounded-lg border px-2 py-2 font-mono text-sm outline-none"
        aria-describedby={hint ? `${id}-${key}` : undefined}
      />
      {hint && (
        <span id={`${id}-${key}`} className="text-muted">
          {hint}
        </span>
      )}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <fieldset className="flex gap-4 text-xs">
        <legend className="sr-only">{P.areaType}</legend>
        {(['point', 'bbox'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="accent-[var(--t-ember)]"
            />
            {k === 'point' ? P.point : P.bbox}
          </label>
        ))}
      </fieldset>
      {kind === 'point' ? (
        <div className="grid grid-cols-3 gap-2">
          {field('lat', P.lat)}
          {field('lon', P.lon)}
          {field('radius', P.radius, `${MIN_RADIUS_KM}–${MAX_RADIUS_KM}`)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {field('west', P.west)}
          {field('east', P.east)}
          {field('south', P.south)}
          {field('north', P.north)}
        </div>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="text-warn space-y-0.5 text-xs">
          {errors.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      )}
      <button
        type="submit"
        disabled={busy}
        className="bg-ember text-on-ember min-h-11 w-full rounded-full px-4 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? P.busy : P.submit}
      </button>
    </form>
  );
}
