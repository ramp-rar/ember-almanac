/**
 * pnpm bench [base-url]
 * autocannon against the API (perf-budget skill): 30 s, 20 connections per endpoint.
 * BENCH_DURATION / BENCH_CONNECTIONS override the defaults. Feature endpoints are added
 * to ENDPOINTS as they ship. autocannon reports p97.5, an upper bound for the p95 budgets.
 */
import autocannon from 'autocannon';

const ENDPOINTS = ['/api/health', '/api/meta'];

async function main(): Promise<void> {
  const base = (process.argv[2] ?? process.env.BENCH_URL ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
  const duration = Number(process.env.BENCH_DURATION ?? 30);
  const connections = Number(process.env.BENCH_CONNECTIONS ?? 20);

  console.log(`| endpoint | p50 ms | p97.5 ms | p99 ms | req/s | non-2xx | errors |`);
  console.log(`|---|---|---|---|---|---|---|`);
  let failed = false;
  for (const endpoint of ENDPOINTS) {
    const r = await autocannon({ url: base + endpoint, duration, connections });
    if (r.errors > 0 || r.non2xx > 0) failed = true;
    console.log(
      `| ${endpoint} | ${r.latency.p50} | ${r.latency.p97_5} | ${r.latency.p99} | ${r.requests.average} | ${r.non2xx} | ${r.errors} |`,
    );
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
