'use client';

/** Last-resort error screen: readable message and a retry, never a blank page. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div role="alert" className="border-line bg-panel rounded-lg border p-6">
        <p className="font-display text-lg">Something went wrong on this page.</p>
        <p className="text-muted mt-1 text-sm">Your data is unaffected. Try again.</p>
        <button
          type="button"
          onClick={reset}
          className="bg-ember text-ink mt-4 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
