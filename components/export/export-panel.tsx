'use client';

import type { AoiRef } from '@/lib/api/types';
import { useI18n } from '@/lib/i18n/use-locale';

/** F05 export. summary.csv works now; the ZIP with detections waits for ADR 0002. */
export function ExportPanel({ aoi }: { aoi: AoiRef }) {
  const E = useI18n().t.export;
  const param = aoi.kind === 'region' ? `r:${aoi.iso3}` : `a:${aoi.id}`;
  return (
    <section aria-labelledby="export-h" className="card p-4 sm:p-5">
      <h2 id="export-h" className="text-lg font-semibold">
        {E.title}
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <a
            href={`/api/export/summary?aoi=${encodeURIComponent(param)}`}
            download
            className="border-line hover:border-ember flex items-center justify-between rounded-lg border px-3 py-2.5"
          >
            <span>summary.csv</span>
            <span className="text-muted font-mono text-xs">{E.summary}</span>
          </a>
        </li>
        <li>
          <a
            href={`/api/export/metadata?aoi=${encodeURIComponent(param)}`}
            download
            className="border-line hover:border-ember flex items-center justify-between rounded-lg border px-3 py-2.5"
          >
            <span>metadata.json</span>
            <span className="text-muted font-mono text-xs">{E.meta}</span>
          </a>
        </li>
        <li className="border-line text-muted flex items-center justify-between rounded-md border border-dashed px-3 py-2">
          <span>{E.detections}</span>
          <span className="font-mono text-xs">{E.later}</span>
        </li>
      </ul>
      <p className="text-muted mt-3 text-xs">{E.note}</p>
    </section>
  );
}
