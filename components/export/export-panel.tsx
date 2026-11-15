import type { AoiRef } from '@/lib/api/types';

/** F05 export. summary.csv works now; the ZIP with detections waits for ADR 0002. */
export function ExportPanel({ aoi }: { aoi: AoiRef }) {
  const param = aoi.kind === 'region' ? `r:${aoi.iso3}` : `a:${aoi.id}`;
  return (
    <section aria-labelledby="export-h" className="card p-4 sm:p-5">
      <h2 id="export-h" className="font-display text-sm font-medium">
        Export
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <a
            href={`/api/export/summary?aoi=${encodeURIComponent(param)}`}
            download
            className="border-line hover:border-ember flex items-center justify-between rounded-lg border px-3 py-2.5"
          >
            <span>summary.csv</span>
            <span className="text-muted font-mono text-xs">monthly · with status</span>
          </a>
        </li>
        <li>
          <a
            href={`/api/export/metadata?aoi=${encodeURIComponent(param)}`}
            download
            className="border-line hover:border-ember flex items-center justify-between rounded-lg border px-3 py-2.5"
          >
            <span>metadata.json</span>
            <span className="text-muted font-mono text-xs">method · AOI · version</span>
          </a>
        </li>
        <li className="border-line text-muted flex items-center justify-between rounded-md border border-dashed px-3 py-2">
          <span>detections.csv (ZIP)</span>
          <span className="font-mono text-xs">after ADR 0002</span>
        </li>
      </ul>
      <p className="text-muted mt-3 text-xs">
        Every row carries its status. No-data months are empty cells, never 0.
      </p>
    </section>
  );
}
