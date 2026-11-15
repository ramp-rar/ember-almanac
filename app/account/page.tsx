import { Suspense } from 'react';
import { AccountPage } from '@/components/account/account-page';

export default function Account() {
  return (
    <Suspense fallback={<main id="main" className="mx-auto max-w-xl px-4 py-10" />}>
      <AccountPage />
    </Suspense>
  );
}
