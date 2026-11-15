import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getResolution, isValidCell } from 'h3-js';
import { monthEnd, monthStart } from '@/lib/domain/iso-date';
import { DatasetMetaSchema, type DatasetMeta } from '@/lib/domain/meta';
import { openDuck, rows, sqlPath } from './duck';

/** Row-level checks of a delivery against docs/DATA_CONTRACT.md (contract v1). */

export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface ValidationReport {
  readonly dir: string;
  readonly meta: DatasetMeta | null;
  readonly checks: readonly Check[];
  readonly ok: boolean;
  readonly stats: { cellMonthRows: number; cells: number; detectionRows: number } | null;
}

const CELL_MONTH_COLUMNS: Record<string, readonly string[]> = {
  h3: ['VARCHAR'],
  year: ['SMALLINT'],
  month: ['TINYINT'],
  fire_days_harm: ['FLOAT'],
  fire_days_harm_lo: ['FLOAT'],
  fire_days_harm_hi: ['FLOAT'],
  det_modis_raw: ['INTEGER'],
  det_viirs_raw: ['INTEGER'],
  frp_sum_mw: ['FLOAT'],
  source_mode: ['VARCHAR'],
  processing: ['VARCHAR'],
};

const DETECTION_COLUMNS = [
  'lat',
  'lon',
  'acq_date_utc',
  'acq_time_utc',
  'local_solar_date',
  'satellite',
  'instrument',
  'confidence_raw',
  'confidence_norm',
  'frp_mw',
  'daynight',
  'type',
  'processing',
  'h3',
] as const;

/**
 * Detections are matched to `cell_month` by the month of `local_solar_date`: a "fire-day" is a
 * local day, and a night overpass is on the previous UTC date east of Greenwich.
 */
const DETECTION_MONTH_FIELD = 'local_solar_date';

export async function validateDelivery(dir: string): Promise<ValidationReport> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const done = (meta: DatasetMeta | null, stats: ValidationReport['stats'] = null) => ({
    dir,
    meta,
    checks,
    ok: checks.every((c) => c.ok),
    stats,
  });

  // 1. meta.json
  const metaPath = path.join(dir, 'meta.json');
  if (!existsSync(metaPath)) {
    add('meta.json present', false, `${metaPath} not found`);
    return done(null);
  }
  let rawMeta: unknown;
  try {
    rawMeta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch (error) {
    add('meta.json is valid JSON', false, String(error));
    return done(null);
  }
  const parsed = DatasetMetaSchema.safeParse(rawMeta);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    add('meta.json matches contract v1', false, issues);
    return done(null);
  }
  const meta = parsed.data;
  add('meta.json matches contract v1', true, `dataset_version ${meta.dataset_version}`);
  add(
    'folder name equals dataset_version',
    path.basename(path.resolve(dir)) === meta.dataset_version,
    `folder ${path.basename(path.resolve(dir))}, dataset_version ${meta.dataset_version}`,
  );

  // 2. cell_month.parquet
  const cellPath = path.join(dir, 'cell_month.parquet');
  if (!existsSync(cellPath)) {
    add('cell_month.parquet present', false, `${cellPath} not found`);
    return done(meta);
  }
  const db = await openDuck();
  const cm = `read_parquet(${sqlPath(cellPath)})`;
  const count = async (sql: string) => (await rows<{ n: number }>(db, sql))[0]!.n;

  const described = await rows<{ column_name: string; column_type: string }>(
    db,
    `DESCRIBE SELECT * FROM ${cm}`,
  );
  const actual = new Map(described.map((d) => [d.column_name, d.column_type]));
  const schemaProblems: string[] = [];
  for (const [name, types] of Object.entries(CELL_MONTH_COLUMNS)) {
    const type = actual.get(name);
    if (type === undefined) schemaProblems.push(`missing column ${name}`);
    else if (!types.includes(type) && !type.startsWith('ENUM')) {
      schemaProblems.push(`${name} is ${type}, expected ${types.join('|')}`);
    }
  }
  add(
    'cell_month: columns and types',
    schemaProblems.length === 0,
    schemaProblems.join('; ') || 'ok',
  );
  if (schemaProblems.length > 0) return done(meta);

  const total = await count(`SELECT count(*) AS n FROM ${cm}`);
  const nulls = await count(
    `SELECT count(*) AS n FROM ${cm} WHERE ${Object.keys(CELL_MONTH_COLUMNS)
      .map((c) => `${c} IS NULL`)
      .join(' OR ')}`,
  );
  add('cell_month: no NULLs', nulls === 0, `${nulls} rows with NULL`);

  const duplicates = await count(
    `SELECT count(*) AS n FROM (SELECT h3, year, month FROM ${cm} GROUP BY ALL HAVING count(*) > 1)`,
  );
  add('cell_month: key (h3, year, month) unique', duplicates === 0, `${duplicates} duplicate keys`);

  const lastYear = Number(meta.nrt_through.slice(0, 4));
  const lastMonth = Number(meta.nrt_through.slice(5, 7));
  const badRange = await count(
    `SELECT count(*) AS n FROM ${cm} WHERE year < 2000 OR year > ${lastYear} OR month < 1 OR month > 12
       OR fire_days_harm < 0 OR fire_days_harm_lo < 0 OR det_modis_raw < 0 OR det_viirs_raw < 0 OR frp_sum_mw < 0
       OR NOT isfinite(fire_days_harm) OR NOT isfinite(fire_days_harm_lo)
       OR NOT isfinite(fire_days_harm_hi) OR NOT isfinite(frp_sum_mw)`,
  );
  add('cell_month: value ranges', badRange === 0, `${badRange} rows out of range`);

  const afterNrt = await count(
    `SELECT count(*) AS n FROM ${cm} WHERE year * 12 + month > ${lastYear * 12 + lastMonth}`,
  );
  add(
    'cell_month: no rows after nrt_through',
    afterNrt === 0,
    `${afterNrt} rows after ${meta.nrt_through}`,
  );

  const badBounds = await count(
    `SELECT count(*) AS n FROM ${cm} WHERE NOT (fire_days_harm_lo <= fire_days_harm AND fire_days_harm <= fire_days_harm_hi)`,
  );
  add('cell_month: lo ≤ harm ≤ hi', badBounds === 0, `${badBounds} rows violate the bounds`);

  const allZero = await count(
    `SELECT count(*) AS n FROM ${cm} WHERE fire_days_harm = 0 AND det_modis_raw = 0 AND det_viirs_raw = 0`,
  );
  add('cell_month: sparse (no all-zero rows)', allZero === 0, `${allZero} all-zero rows`);

  const badEnums = await count(
    `SELECT count(*) AS n FROM ${cm} WHERE source_mode::VARCHAR NOT IN ('modis_only', 'overlap', 'viirs_only')
       OR processing::VARCHAR NOT IN ('SP', 'NRT')`,
  );
  add('cell_month: enums', badEnums === 0, `${badEnums} rows with unknown source_mode/processing`);

  const cells = await rows<{ h3: string }>(db, `SELECT DISTINCT h3 FROM ${cm}`);
  const badCells = cells.filter(
    (c) => !isValidCell(c.h3) || getResolution(c.h3) !== meta.harmonization.h3_resolution,
  );
  add(
    `cell_month: h3 valid at resolution ${meta.harmonization.h3_resolution}`,
    badCells.length === 0,
    badCells.length === 0
      ? `${cells.length} distinct cells`
      : `${badCells.length} invalid, e.g. ${badCells[0]!.h3}`,
  );

  // No data before MODIS start; everything after the SP date is NRT.
  const months = await rows<{ year: number; month: number; n: number; nrt: number }>(
    db,
    `SELECT year, month, count(*) AS n, count(*) FILTER (WHERE processing::VARCHAR = 'NRT') AS nrt
       FROM ${cm} WHERE month BETWEEN 1 AND 12 GROUP BY year, month`,
  );
  const beforeModis = months.filter((m) => monthEnd(m.year, m.month) < meta.coverage.MODIS.start);
  add(
    'cell_month: nothing before coverage.MODIS.start',
    beforeModis.length === 0,
    `${beforeModis.length} months before ${meta.coverage.MODIS.start}`,
  );
  const notNrt = months.filter(
    (m) => monthStart(m.year, m.month) > meta.standard_processing_through && m.nrt !== m.n,
  );
  add(
    'cell_month: rows after standard_processing_through are NRT',
    notNrt.length === 0,
    notNrt.length === 0
      ? 'ok'
      : `${notNrt.length} months, e.g. ${notNrt[0]!.year}-${notNrt[0]!.month}`,
  );

  // 3. detections/
  const detDir = path.join(dir, 'detections');
  let detectionRows = 0;
  if (!existsSync(detDir)) {
    add('detections/ present', false, `${detDir} not found (required for CSV export)`);
  } else {
    const det = `read_parquet(${sqlPath(path.join(detDir, '**', '*.parquet'))}, hive_partitioning = true)`;
    const detCols = new Set(
      (await rows<{ column_name: string }>(db, `DESCRIBE SELECT * FROM ${det}`)).map(
        (d) => d.column_name,
      ),
    );
    const missing = DETECTION_COLUMNS.filter((c) => !detCols.has(c));
    add(
      'detections: columns',
      missing.length === 0,
      missing.length ? `missing ${missing.join(', ')}` : 'ok',
    );
    if (missing.length === 0) {
      detectionRows = await count(`SELECT count(*) AS n FROM ${det}`);
      const badDet = await count(
        `SELECT count(*) AS n FROM ${det} WHERE lat NOT BETWEEN -90 AND 90 OR lon NOT BETWEEN -180 AND 180
           OR confidence_norm::VARCHAR NOT IN ('low', 'nominal', 'high') OR daynight::VARCHAR NOT IN ('D', 'N')
           OR type NOT BETWEEN 0 AND 3 OR processing::VARCHAR NOT IN ('SP', 'NRT') OR frp_mw < 0`,
      );
      add('detections: value ranges and enums', badDet === 0, `${badDet} rows out of range`);

      const mismatch = async (field: string) =>
        count(
          `WITH a AS (SELECT year, month, sum(det_modis_raw + det_viirs_raw) AS n FROM ${cm} GROUP BY ALL),
                b AS (SELECT year(${field}::DATE) AS year, month(${field}::DATE) AS month, count(*) AS n
                        FROM ${det} GROUP BY ALL)
           SELECT count(*) AS n FROM a FULL JOIN b USING (year, month)
            WHERE coalesce(a.n, 0) <> coalesce(b.n, 0)`,
        );
      const bad = await mismatch(DETECTION_MONTH_FIELD);
      let detail = `${bad} months differ (by ${DETECTION_MONTH_FIELD})`;
      if (bad > 0) detail += `; by acq_date_utc: ${await mismatch('acq_date_utc')} months differ`;
      add('detections: monthly counts equal sum of det_*_raw (±0)', bad === 0, detail);
    }
  }

  return done(meta, { cellMonthRows: total, cells: cells.length, detectionRows });
}

export function reportMarkdown(report: ValidationReport, generatedAt: string): string {
  const lines = [
    `# Contract validation — ${report.meta?.dataset_version ?? 'unknown delivery'}`,
    '',
    `Result: **${report.ok ? 'PASS' : 'FAIL'}** · contract v1 · ${generatedAt}`,
    '',
    `Delivery folder: \`${report.dir.replaceAll('\\', '/')}\``,
  ];
  if (report.stats) {
    lines.push(
      '',
      `cell_month rows: ${report.stats.cellMonthRows} · distinct cells: ${report.stats.cells} · detection rows: ${report.stats.detectionRows}`,
    );
  }
  lines.push('', '| Check | Result | Detail |', '|---|---|---|');
  for (const c of report.checks) {
    lines.push(`| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail.replaceAll('|', '\\|')} |`);
  }
  return `${lines.join('\n')}\n`;
}
