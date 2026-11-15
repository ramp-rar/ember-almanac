import { Suspense } from 'react';
import { DatasetBanner } from '@/components/dataset-banner';
import { STATUSES, type Status } from '@/lib/domain/honest-value';

const STATUS_MEANING: Record<Status, string> = {
  final: 'Standard-processed data.',
  estimate: 'MODIS-only years, scaled into VIIRS-equivalent units.',
  preliminary: 'Near real-time data, replaced by standard processing later.',
  no_data: 'No observations. Never shown as zero.',
  future: 'Not yet observed.',
};

export default function Home() {
  return (
    <>
      <Suspense
        fallback={<p className="border-line text-muted border-b px-4 py-2 font-mono text-xs">…</p>}
      >
        <DatasetBanner />
      </Suspense>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          FIRE <span className="text-ember">TRACE</span>
        </h1>
        <p className="text-muted mt-3 max-w-xl">
          Did Earth burn more — or did our satellites just get better at seeing it?
        </p>

        <section aria-labelledby="statuses" className="mt-10">
          <h2 id="statuses" className="font-display text-lg font-medium">
            Every number carries a status
          </h2>
          <dl className="border-line mt-4 divide-y divide-[var(--color-line)] border-y">
            {STATUSES.map((status) => (
              <div key={status} className="grid grid-cols-[8rem_1fr] gap-4 py-2 text-sm">
                <dt className="font-mono">{status}</dt>
                <dd className="text-muted">{STATUS_MEANING[status]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-muted mt-10 text-sm">The Burning Calendar arrives with feature F02.</p>
      </main>
    </>
  );
}
