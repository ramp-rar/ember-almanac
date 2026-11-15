import { connection } from 'next/server';
import { getMeta } from '@/server/services/meta-service';
import { BannerText } from './site-chrome';

/** Data-version banner (F06). Says plainly when the numbers are generated test data. */
export async function DatasetBanner() {
  await connection();
  let meta = null;
  let failed = false;
  try {
    meta = await getMeta();
  } catch {
    failed = true;
  }

  const wrap =
    'mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6';

  if (!meta) {
    return (
      <div role="status" className="border-line border-b text-sm">
        <p className={`${wrap} text-muted`}>
          {failed ? 'Dataset information is unavailable right now.' : 'No dataset is loaded yet.'}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="dataset-banner"
      className={`border-line border-b text-sm ${meta.is_mock ? 'bg-[color-mix(in_srgb,var(--t-ember)_9%,transparent)]' : ''}`}
    >
      <p className={wrap}>
        <BannerText
          mock={meta.is_mock}
          version={meta.dataset_version}
          sp={meta.meta.standard_processing_through}
          nrt={meta.meta.nrt_through}
        />
      </p>
    </div>
  );
}
