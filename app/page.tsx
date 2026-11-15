import { Suspense } from 'react';
import { Explorer, ExplorerSkeleton } from '@/components/explorer/explorer';

/** The Burning Calendar is the home screen; with no area chosen it opens the first region. */
export default function Home() {
  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <Explorer aoi={null} />
    </Suspense>
  );
}
