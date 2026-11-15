import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateDelivery } from '@/scripts/lib/contract';
import { openDuck, sqlPath } from '@/scripts/lib/duck';
import { rawContractMeta } from '../fixtures/meta';

/** Failure paths of the delivery gate: each case is a tiny delivery with exactly one violation. */

const CELL = '86411e927ffffff'; // a valid resolution-6 cell
const CELL_R5 = '85411e93fffffff';

interface CellRow {
  h3?: string;
  year?: number;
  month?: number;
  harm?: string;
  lo?: string;
  hi?: string;
  modis?: number;
  viirs?: number;
  frp?: string;
  mode?: string;
  processing?: string;
}
interface Detection {
  local: string;
  utc?: string;
}

const goodCells: CellRow[] = [
  { year: 2020, month: 8, modis: 1, viirs: 2 },
  { year: 2026, month: 9, modis: 1, viirs: 0, processing: 'NRT' },
];
const goodDetections: Detection[] = [
  { local: '2020-08-05' },
  { local: '2020-08-06' },
  { local: '2020-08-01', utc: '2020-07-31' }, // night overpass: previous UTC date, same local month
  { local: '2026-09-10' },
];

let root: string;
let counter = 0;

async function delivery(
  cells: CellRow[] = goodCells,
  detections: Detection[] | null = goodDetections,
  meta: Record<string, unknown> = {},
): Promise<string> {
  const dir = path.join(root, `case-${counter++}`, rawContractMeta.dataset_version);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify({ ...rawContractMeta, ...meta }));

  const db = await openDuck();
  const values = cells
    .map((c) => {
      const harm = c.harm ?? '2.0';
      return `('${c.h3 ?? CELL}', ${c.year ?? 2020}::SMALLINT, ${c.month ?? 8}::TINYINT,
        ${harm}::FLOAT, ${c.lo ?? '1.0'}::FLOAT, ${c.hi ?? '3.0'}::FLOAT,
        ${c.modis ?? 1}::INTEGER, ${c.viirs ?? 0}::INTEGER, ${c.frp ?? '5.0'}::FLOAT,
        '${c.mode ?? 'overlap'}', '${c.processing ?? 'SP'}')`;
    })
    .join(',');
  await db.run(
    `COPY (SELECT * FROM (VALUES ${values}) t(h3, year, month, fire_days_harm, fire_days_harm_lo,
       fire_days_harm_hi, det_modis_raw, det_viirs_raw, frp_sum_mw, source_mode, processing))
     TO ${sqlPath(path.join(dir, 'cell_month.parquet'))} (FORMAT PARQUET)`,
  );
  if (detections) {
    const det = detections
      .map(
        (d) =>
          `(44.5, 70.1, DATE '${d.utc ?? d.local}', '0800', DATE '${d.local}', 'Terra', 'MODIS', '55',
            'nominal', 10.0::FLOAT, 'D', 0::TINYINT, 'SP', '${CELL}', ${d.local.slice(0, 4)})`,
      )
      .join(',');
    await db.run(
      `COPY (SELECT * FROM (VALUES ${det}) t(lat, lon, acq_date_utc, acq_time_utc, local_solar_date,
         satellite, instrument, confidence_raw, confidence_norm, frp_mw, daynight, type, processing,
         h3, year))
       TO ${sqlPath(path.join(dir, 'detections'))} (FORMAT PARQUET, PARTITION_BY (year))`,
    );
  }
  db.closeSync();
  return dir;
}

async function failedChecks(dir: string): Promise<string[]> {
  const report = await validateDelivery(dir);
  expect(report.ok).toBe(report.checks.every((c) => c.ok));
  return report.checks.filter((c) => !c.ok).map((c) => c.name);
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'fire-trace-contract-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('validateDelivery()', () => {
  it('passes a minimal valid delivery (night detections count by local date)', async () => {
    const report = await validateDelivery(await delivery());
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats).toEqual({ cellMonthRows: 2, cells: 1, detectionRows: 4 });
  });

  it.each<[string, CellRow[], string]>([
    ['duplicate key', [goodCells[0]!, goodCells[0]!], 'cell_month: key (h3, year, month) unique'],
    ['lo > harm', [{ ...goodCells[0]!, lo: '2.5' }, goodCells[1]!], 'cell_month: lo ≤ harm ≤ hi'],
    ['harm > hi', [{ ...goodCells[0]!, hi: '1.5' }, goodCells[1]!], 'cell_month: lo ≤ harm ≤ hi'],
    ['NaN', [{ ...goodCells[0]!, harm: "'NaN'" }, goodCells[1]!], 'cell_month: value ranges'],
    [
      'Infinity',
      [{ ...goodCells[0]!, harm: "'Infinity'", hi: "'Infinity'" }, goodCells[1]!],
      'cell_month: value ranges',
    ],
    ['negative lo', [{ ...goodCells[0]!, lo: '-1.0' }, goodCells[1]!], 'cell_month: value ranges'],
    ['month 13', [{ ...goodCells[0]!, month: 13 }, goodCells[1]!], 'cell_month: value ranges'],
    [
      'wrong H3 resolution',
      [{ ...goodCells[0]!, h3: CELL_R5 }, goodCells[1]!],
      'cell_month: h3 valid at resolution 6',
    ],
    [
      'invalid H3',
      [{ ...goodCells[0]!, h3: 'not-a-cell' }, goodCells[1]!],
      'cell_month: h3 valid at resolution 6',
    ],
    [
      'data before MODIS start',
      [...goodCells, { year: 2000, month: 10, modis: 0, viirs: 0 }],
      'cell_month: nothing before coverage.MODIS.start',
    ],
    [
      'SP row after the SP date',
      [goodCells[0]!, { ...goodCells[1]!, processing: 'SP' }],
      'cell_month: rows after standard_processing_through are NRT',
    ],
    [
      'row after nrt_through',
      [...goodCells, { year: 2026, month: 12, modis: 0, viirs: 0, processing: 'NRT' }],
      'cell_month: no rows after nrt_through',
    ],
    [
      'all-zero row',
      [...goodCells, { year: 2021, month: 1, harm: '0', lo: '0', hi: '0', modis: 0, viirs: 0 }],
      'cell_month: sparse (no all-zero rows)',
    ],
    ['unknown enum', [{ ...goodCells[0]!, mode: 'both' }, goodCells[1]!], 'cell_month: enums'],
  ])('rejects %s', async (_name, cells, check) => {
    expect(await failedChecks(await delivery(cells))).toContain(check);
  });

  it('rejects a detection count that is off by one', async () => {
    const failed = await failedChecks(await delivery(goodCells, goodDetections.slice(1)));
    expect(failed).toEqual(['detections: monthly counts equal sum of det_*_raw (±0)']);
  });

  it('rejects a delivery without detections/', async () => {
    expect(await failedChecks(await delivery(goodCells, null))).toEqual(['detections/ present']);
  });

  it('rejects an invalid meta.json and a wrong folder name', async () => {
    const bad = await delivery(goodCells, goodDetections, { contract_version: '2' });
    expect(await failedChecks(bad)).toEqual(['meta.json matches contract v1']);
    const renamed = await delivery(goodCells, goodDetections, { dataset_version: 'other' });
    expect(await failedChecks(renamed)).toContain('folder name equals dataset_version');
  });

  it('reports a missing meta.json', async () => {
    expect(await failedChecks(path.join(root, 'nowhere'))).toEqual(['meta.json present']);
  });
});
