import { Suspense } from 'react';
import { Explorer, ExplorerSkeleton } from '@/components/explorer/explorer';

export default function AoiPage({ params }: { params: Promise<{ aoiId: string }> }) {
  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <AoiExplorer params={params} />
    </Suspense>
  );
}

async function AoiExplorer({ params }: { params: Promise<{ aoiId: string }> }) {
  const { aoiId } = await params;
  let id = aoiId;
  try {
    id = decodeURIComponent(aoiId);
  } catch {
    // keep the raw segment; the API rejects it with a readable error
  }
  return <Explorer aoi={{ kind: 'aoi', id }} />;
}
