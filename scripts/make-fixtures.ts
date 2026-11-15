/**
 * pnpm fixtures [--cells 600] [--out delivery]
 *
 * Generates a deterministic MOCK delivery for Central Asia in the shape of
 * docs/DATA_CONTRACT.md. Nothing here is a measurement: the dataset version is `mock-*`
 * and the UI shows a "MOCK DATA" banner for it.
 *
 * What the fixture exercises:
 *  - 2000-01…10 absent (before MODIS start); a fully missing month (2014-02) → no_data;
 *  - a sensor step in raw VIIRS counts from 2012 that is NOT present in the harmonized value;
 *  - NRT rows after the standard-processing date; the last month is cut at nrt_through;
 *  - night detections whose UTC date is the day before their local solar date.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { cellToChildren, cellToLatLng, polygonToCells } from 'h3-js';
import { daysOfMonth, monthStart, type IsoDate } from '@/lib/domain/iso-date';
import { DatasetMetaSchema, type DatasetMeta } from '@/lib/domain/meta';
import { openDuck, sqlPath } from './lib/duck';

const DATASET_VERSION = 'mock-2026-11-15a';
const BBOX = [46.0, 35.0, 88.0, 56.0] as const; // west, south, east, north
const MISSING_MONTH = { year: 2014, month: 2 } as const;
const SEASON = [0.05, 0.08, 0.45, 0.9, 0.5, 0.45, 0.9, 1.0, 0.7, 0.35, 0.1, 0.04] as const;

const VIIRS = [
  { platform: 'VIIRS_SNPP', satellite: 'N' },
  { platform: 'VIIRS_NOAA20', satellite: 'N20' },
  { platform: 'VIIRS_NOAA21', satellite: 'N21' },
] as const;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

/** mulberry32 — small deterministic PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function previousDay(date: IsoDate): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildMeta(): DatasetMeta {
  const missingMonth = daysOfMonth(MISSING_MONTH.year, MISSING_MONTH.month).flatMap((date) => [
    { date, platform: 'MODIS' },
    { date, platform: 'VIIRS_SNPP' },
  ]);
  return DatasetMetaSchema.parse({
    contract_version: '1',
    dataset_version: DATASET_VERSION,
    harmonization: {
      method: 'MOCK — synthetic values from scripts/make-fixtures.ts, not a harmonization',
      unit: 'harmonized fire-days, VIIRS(NOAA-20)-equivalent',
      h3_resolution: 6,
      baseline_years: [2003, 2025],
    },
    coverage: {
      MODIS: { start: '2000-11-01', end: null },
      VIIRS_SNPP: { start: '2012-01-20', end: '2026-11-02' },
      VIIRS_NOAA20: { start: '2018-04-01', end: null },
      VIIRS_NOAA21: { start: '2023-03-01', end: null },
    },
    standard_processing_through: '2026-06-30',
    nrt_through: '2026-11-14',
    estimate_before_year: 2012,
    missing_days: [{ date: '2016-02-11', platform: 'VIIRS_SNPP' }, ...missingMonth],
    region_bbox: [...BBOX],
  });
}

/** Days of the month on which `platform` observed: within coverage, not missing, ≤ nrt_through. */
function observedDays(meta: DatasetMeta, platform: string, year: number, month: number): IsoDate[] {
  const coverage = meta.coverage[platform]!;
  const missing = new Set(
    meta.missing_days.filter((d) => d.platform === platform).map((d) => d.date),
  );
  return daysOfMonth(year, month).filter(
    (day) =>
      day >= coverage.start &&
      (coverage.end === null || day <= coverage.end) &&
      day <= meta.nrt_through &&
      !missing.has(day),
  );
}

function pickCells(target: number, rand: () => number): string[] {
  const [west, south, east, north] = BBOX;
  const ring = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
  const parents = polygonToCells([ring], 4, true).sort();
  const wanted = Math.max(1, Math.ceil(target / 2));
  const step = Math.max(1, Math.floor(parents.length / wanted));
  const cells: string[] = [];
  for (let i = 0; i < parents.length && cells.length < target; i += step) {
    const children = cellToChildren(parents[i]!, 6).sort();
    const first = Math.floor(rand() * children.length);
    cells.push(children[first]!, children[(first + 17) % children.length]!);
  }
  return cells.slice(0, target);
}

/** Three vertical strips of the bbox with ISO 3166 user-assigned codes: never real countries. */
function mockRegions() {
  const [west, south, east, north] = BBOX;
  const width = (east - west) / 3;
  const names = ['West', 'Central', 'East'];
  return {
    type: 'FeatureCollection',
    features: names.map((name, i) => {
      const w = west + i * width;
      const e = w + width;
      return {
        type: 'Feature',
        properties: {
          iso3: `ZZ${'ABC'[i]}`,
          name_en: `Mock Region ${name} (fixture)`,
          name_ru: `Тестовый регион ${i + 1} (фикстура)`,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [w, south],
              [e, south],
              [e, north],
              [w, north],
              [w, south],
            ],
          ],
        },
      };
    }),
  };
}

async function main(): Promise<void> {
  const cellsTarget = Number(arg('cells', '600'));
  if (!Number.isInteger(cellsTarget) || cellsTarget < 1) throw new Error('--cells must be ≥ 1');
  const outDir = path.join(arg('out', 'delivery'), DATASET_VERSION);
  const tmpDir = path.join(outDir, '.tmp');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  const meta = buildMeta();
  const rand = prng(20261115);
  const cells = pickCells(cellsTarget, rand);
  const cellInfo = cells.map((h3) => {
    const [lat, lon] = cellToLatLng(h3);
    // A third of the cells never burn (desert, water); the rest vary by ~2 orders of magnitude.
    const propensity = rand() < 0.33 ? 0 : Math.exp(rand() * 3.2 - 2.6);
    return { h3, lat, lon, propensity };
  });

  const cellCsv = createWriteStream(path.join(tmpDir, 'cell_month.csv'));
  const detCsv = createWriteStream(path.join(tmpDir, 'detections.csv'));
  cellCsv.write(
    'h3,year,month,fire_days_harm,fire_days_harm_lo,fire_days_harm_hi,det_modis_raw,det_viirs_raw,frp_sum_mw,source_mode,processing\n',
  );
  detCsv.write(
    'lat,lon,acq_date_utc,acq_time_utc,local_solar_date,satellite,instrument,confidence_raw,confidence_norm,frp_mw,daynight,type,processing,h3,year\n',
  );

  const lastYear = Number(meta.nrt_through.slice(0, 4));
  const lastMonth = Number(meta.nrt_through.slice(5, 7));
  let cellRows = 0;
  let detRows = 0;

  const writeDetections = async (
    count: number,
    days: readonly IsoDate[],
    satelliteFor: (day: IsoDate) => string,
    instrument: 'MODIS' | 'VIIRS',
    cell: (typeof cellInfo)[number],
    processing: string,
    year: number,
  ) => {
    let chunk = '';
    for (let i = 0; i < count; i++) {
      const local = days[Math.floor(rand() * days.length)]!;
      const night = rand() < 0.2;
      // Central Asia is UTC+5/+6: a ~01:30 local overpass is ~20:00 UTC on the previous date.
      const utcDate = night ? previousDay(local) : local;
      const hour = night ? 20 + Math.floor(rand() * 2) : 7 + Math.floor(rand() * 3);
      const time = `${String(hour).padStart(2, '0')}${String(Math.floor(rand() * 60)).padStart(2, '0')}`;
      const level = rand();
      const norm = level < 0.1 ? 'low' : level < 0.8 ? 'nominal' : 'high';
      const raw =
        instrument === 'VIIRS'
          ? norm[0]
          : String(norm === 'low' ? 20 : norm === 'nominal' ? 55 : 90);
      const lat = (cell.lat + (rand() - 0.5) * 0.016).toFixed(5);
      const lon = (cell.lon + (rand() - 0.5) * 0.016).toFixed(5);
      const frp = (2 + rand() * 40).toFixed(1);
      chunk += `${lat},${lon},${utcDate},${time},${local},${satelliteFor(local)},${instrument},${raw},${norm},${frp},${night ? 'N' : 'D'},0,${processing},${cell.h3},${year}\n`;
    }
    detRows += count;
    if (!detCsv.write(chunk))
      await new Promise<void>((resolve) => detCsv.once('drain', () => resolve()));
  };

  for (let year = 2000; year <= lastYear; year++) {
    const yearFactor = 0.6 + rand();
    for (let month = 1; month <= (year === lastYear ? lastMonth : 12); month++) {
      const modisDays = observedDays(meta, 'MODIS', year, month);
      const viirsDays = VIIRS.map((v) => ({
        ...v,
        days: observedDays(meta, v.platform, year, month),
      }));
      const anyViirsDays = [...new Set(viirsDays.flatMap((v) => v.days))].sort();
      const observed = Math.max(modisDays.length, anyViirsDays.length);
      if (observed === 0) continue; // before MODIS start, or the fully missing month

      const processing = monthStart(year, month) > meta.standard_processing_through ? 'NRT' : 'SP';
      const uncertainty = year < meta.estimate_before_year ? 0.35 : 0.12;
      const totalDays = daysOfMonth(year, month).length;

      for (const cell of cellInfo) {
        if (cell.propensity === 0) continue;
        const lambda =
          cell.propensity * SEASON[month - 1]! * yearFactor * 6 * (observed / totalDays);
        const harm = Math.min(observed, Math.round(lambda * (0.5 + rand()) * 10) / 10);
        if (harm < 0.5) continue; // sparse format: zero rows are not delivered

        const modis =
          modisDays.length > 0 ? Math.max(1, Math.round(harm * (0.8 + 0.6 * rand()))) : 0;
        // The sensor step: VIIRS sees several times more detections than MODIS.
        const viirs =
          anyViirsDays.length > 0
            ? Math.round(harm * (2.5 + 1.5 * rand()) * (anyViirsDays.length / observed))
            : 0;
        const frp = ((modis + viirs) * (5 + 20 * rand())).toFixed(1);
        const lo = (harm * (1 - uncertainty)).toFixed(3);
        const hi = (harm * (1 + uncertainty)).toFixed(3);
        const mode = viirs > 0 ? 'overlap' : 'modis_only';
        cellCsv.write(
          `${cell.h3},${year},${month},${harm},${lo},${hi},${modis},${viirs},${frp},${mode},${processing}\n`,
        );
        cellRows += 1;

        if (modis > 0) {
          const terraOnly = year < 2003;
          await writeDetections(
            modis,
            modisDays,
            () => (terraOnly || rand() < 0.5 ? 'Terra' : 'Aqua'),
            'MODIS',
            cell,
            processing,
            year,
          );
        }
        if (viirs > 0) {
          await writeDetections(
            viirs,
            anyViirsDays,
            (day) => {
              const flying = viirsDays.filter((v) => v.days.includes(day));
              return flying[Math.floor(rand() * flying.length)]!.satellite;
            },
            'VIIRS',
            cell,
            processing,
            year,
          );
        }
      }
    }
  }
  cellCsv.end();
  detCsv.end();
  await Promise.all([finished(cellCsv), finished(detCsv)]);

  const db = await openDuck();
  await db.run(
    `COPY (
       SELECT h3::VARCHAR AS h3, year::SMALLINT AS year, month::TINYINT AS month,
              fire_days_harm::FLOAT AS fire_days_harm,
              least(fire_days_harm_lo::FLOAT, fire_days_harm::FLOAT) AS fire_days_harm_lo,
              greatest(fire_days_harm_hi::FLOAT, fire_days_harm::FLOAT) AS fire_days_harm_hi,
              det_modis_raw::INTEGER AS det_modis_raw, det_viirs_raw::INTEGER AS det_viirs_raw,
              frp_sum_mw::FLOAT AS frp_sum_mw, source_mode::VARCHAR AS source_mode,
              processing::VARCHAR AS processing
         FROM read_csv(${sqlPath(path.join(tmpDir, 'cell_month.csv'))}, header = true, all_varchar = true)
     ) TO ${sqlPath(path.join(outDir, 'cell_month.parquet'))} (FORMAT PARQUET, COMPRESSION ZSTD)`,
  );
  await db.run(
    `COPY (
       SELECT lat::DOUBLE AS lat, lon::DOUBLE AS lon, acq_date_utc::DATE AS acq_date_utc,
              acq_time_utc::VARCHAR AS acq_time_utc, local_solar_date::DATE AS local_solar_date,
              satellite::VARCHAR AS satellite, instrument::VARCHAR AS instrument,
              confidence_raw::VARCHAR AS confidence_raw, confidence_norm::VARCHAR AS confidence_norm,
              frp_mw::FLOAT AS frp_mw, daynight::VARCHAR AS daynight, type::TINYINT AS type,
              processing::VARCHAR AS processing, h3::VARCHAR AS h3, year::INTEGER AS year
         FROM read_csv(${sqlPath(path.join(tmpDir, 'detections.csv'))}, header = true, all_varchar = true)
     ) TO ${sqlPath(path.join(outDir, 'detections'))} (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (year))`,
  );
  db.closeSync();

  await writeFile(path.join(outDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(path.join(outDir, 'regions.geojson'), `${JSON.stringify(mockRegions())}\n`);
  await rm(tmpDir, { recursive: true, force: true });

  console.log(
    `MOCK delivery written to ${outDir}: ${cells.length} cells, ${cellRows} cell-month rows, ${detRows} detections`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
