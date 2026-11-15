/**
 * pnpm contract:validate <delivery-dir>
 * Validates a science-team delivery against docs/DATA_CONTRACT.md, writes
 * docs/reviews/contract-<dataset_version>.md and exits non-zero on any violation.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { reportMarkdown, validateDelivery } from './lib/contract';

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: pnpm contract:validate <delivery-dir>');
    process.exit(2);
  }

  const report = await validateDelivery(dir);
  for (const c of report.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);

  const name = report.meta?.dataset_version ?? path.basename(path.resolve(dir));
  const out = path.join('docs', 'reviews', `contract-${name}.md`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, reportMarkdown(report, new Date().toISOString()));
  console.log(`\n${report.ok ? 'PASS' : 'FAIL'} — report: ${out}`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
