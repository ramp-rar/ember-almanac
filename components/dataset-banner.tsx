import { connection } from 'next/server';
import { getMeta } from '@/server/services/meta-service';

/** Data-version banner (F06). Shows "MOCK DATA" for generated fixtures. */
export async function DatasetBanner() {
  await connection();
  let meta = null;
  let failed = false;
  try {
    meta = await getMeta();
  } catch {
    failed = true;
  }

  if (!meta) {
    return (
      <p role="status" className="border-line text-muted border-b px-4 py-2 font-mono text-xs">
        {failed ? 'Dataset metadata is unavailable.' : 'No dataset loaded yet.'}
      </p>
    );
  }

  return (
    <p
      role="status"
      data-testid="dataset-banner"
      className="border-line flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 font-mono text-xs"
    >
      {meta.is_mock && (
        <strong className="bg-ember text-ink rounded-sm px-1.5 py-0.5 font-semibold tracking-wide">
          MOCK DATA
        </strong>
      )}
      <span className="text-muted">
        dataset <span className="text-text">{meta.dataset_version}</span> · standard processing
        through <span className="text-text">{meta.meta.standard_processing_through}</span> · near
        real-time through <span className="text-text">{meta.meta.nrt_through}</span>
      </span>
    </p>
  );
}
