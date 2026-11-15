import { Suspense } from 'react';
import { Explorer, ExplorerSkeleton } from '@/components/explorer/explorer';

export default function RegionPage({ params }: { params: Promise<{ iso3: string }> }) {
  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <RegionExplorer params={params} />
    </Suspense>
  );
}

async function RegionExplorer({ params }: { params: Promise<{ iso3: string }> }) {
  const { iso3 } = await params;
  return <Explorer aoi={{ kind: 'region', iso3: iso3.toUpperCase() }} />;
}
