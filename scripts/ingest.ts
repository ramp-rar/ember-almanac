/**
 * pnpm ingest <delivery-dir> [--skip-blob]
 *
 * Loads a validated delivery into Postgres (data-contract skill):
 *  a) uploads detections Parquet + regions to Vercel Blob under datasets/<version>/;
 *  b) loads cell_month, builds cell_month_r4 (parent cells) and region_month (country totals);
 *  c) inserts the dataset_version row and makes it active.
 * Everything in (b) and (c) is one transaction: a failed ingest leaves the database untouched.
 * Re-running an already active version is a no-op.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import { config } from 'dotenv';
import { cellToParent, polygonToCells } from 'h3-js';
import postgres from 'postgres';
import { z } from 'zod';
import { validateDelivery } from './lib/contract';
import { openDuck, rows, sqlPath } from './lib/duck';

config({ path: ['.env.local', '.env'], quiet: true });

const BATCH = 2000;
const COARSE_RESOLUTION = 4;

const RegionsSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        iso3: z.string().length(3),
        name_en: z.string().min(1),
        name_ru: z.string().optional(),
      }),
      geometry: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('Polygon'),
          coordinates: z.array(z.array(z.array(z.number()))),
        }),
        z.object({
          type: z.literal('MultiPolygon'),
          coordinates: z.array(z.array(z.array(z.array(z.number())))),
        }),
      ]),
    }),
  ),
});

interface CellRow extends Record<string, unknown> {
  h3: string;
  year: number;
  month: number;
  harm: number;
  harm_lo: number;
  harm_hi: number;
  raw_modis: number;
  raw_viirs: number;
  frp: number;
  processing: string;
}

const h3ToDb = (hex: string) => BigInt(`0x${hex}`).toString();

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
}

async function uploadToBlob(dir: string, version: string): Promise<number> {
  const files = [...(await listFiles(path.join(dir, 'detections')))];
  const regions = path.join(dir, 'regions.geojson');
  try {
    await readFile(regions);
    files.push(regions);
  } catch {
    // regions.geojson is optional
  }
  for (const file of files) {
    const key = `datasets/${version}/${path.relative(dir, file).replaceAll('\\', '/')}`;
    await put(key, await readFile(file), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }
  return files.length;
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir || dir.startsWith('--')) {
    console.error('Usage: pnpm ingest <delivery-dir> [--skip-blob]');
    process.exit(2);
  }
  const skipBlob = process.argv.includes('--skip-blob');

  const report = await validateDelivery(dir);
  if (!report.ok || !report.meta) {
    for (const c of report.checks.filter((c) => !c.ok))
      console.error(`FAIL  ${c.name} — ${c.detail}`);
    throw new Error(
      'Delivery is invalid; nothing was ingested. Run pnpm contract:validate for the report.',
    );
  }
  const meta = report.meta;
  const version = meta.dataset_version;

  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set');
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const existing = await sql<{ is_active: boolean }[]>`
      select is_active from dataset_version where id = ${version}`;
    if (existing[0]?.is_active) {
      console.log(`${version} is already active — nothing to do.`);
      return;
    }

    if (skipBlob) console.log('Blob upload skipped (--skip-blob).');
    else if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        'BLOB_READ_WRITE_TOKEN is not set (use --skip-blob to load the database only)',
      );
    } else console.log(`Uploaded ${await uploadToBlob(dir, version)} files to Blob.`);

    const duck = await openDuck();
    const cells = await rows<CellRow>(
      duck,
      `SELECT h3, year::INTEGER AS year, month::INTEGER AS month, fire_days_harm::DOUBLE AS harm,
              fire_days_harm_lo::DOUBLE AS harm_lo, fire_days_harm_hi::DOUBLE AS harm_hi,
              det_modis_raw AS raw_modis, det_viirs_raw AS raw_viirs, frp_sum_mw::DOUBLE AS frp,
              processing::VARCHAR AS processing
         FROM read_parquet(${sqlPath(path.join(dir, 'cell_month.parquet'))})`,
    );
    duck.closeSync();

    // Parent (r4) totals. Bounds are summed, which is the widest (most cautious) interval.
    const coarse = new Map<string, CellRow>();
    for (const row of cells) {
      const parent = cellToParent(row.h3, COARSE_RESOLUTION);
      const key = `${parent}|${row.year}|${row.month}`;
      const sum = coarse.get(key);
      if (!sum) coarse.set(key, { ...row, h3: parent });
      else {
        sum.harm += row.harm;
        sum.harm_lo += row.harm_lo;
        sum.harm_hi += row.harm_hi;
        sum.raw_modis += row.raw_modis;
        sum.raw_viirs += row.raw_viirs;
        sum.frp += row.frp;
        if (row.processing === 'NRT') sum.processing = 'NRT';
      }
    }

    let regions: z.infer<typeof RegionsSchema>['features'] = [];
    try {
      const raw = await readFile(path.join(dir, 'regions.geojson'), 'utf8');
      regions = RegionsSchema.parse(JSON.parse(raw)).features;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      console.log('No regions.geojson in the delivery — regions are left as they are.');
    }

    await sql.begin(async (tx) => {
      await tx`delete from dataset_version where id = ${version}`; // leftovers of an inactive attempt
      await tx`insert into dataset_version (id, meta, is_active)
               values (${version}, ${tx.json(meta as never)}, false)`;

      const insertCells = async (
        table: 'cell_month' | 'cell_month_r4',
        data: Iterable<CellRow>,
      ) => {
        let batch: Record<string, unknown>[] = [];
        let n = 0;
        const flush = async () => {
          if (batch.length === 0) return;
          await tx`insert into ${tx(table)} ${tx(batch)}`;
          n += batch.length;
          batch = [];
        };
        for (const r of data) {
          batch.push({ ...r, h3: h3ToDb(r.h3), version_id: version });
          if (batch.length >= BATCH) await flush();
        }
        await flush();
        return n;
      };
      console.log(`cell_month: ${await insertCells('cell_month', cells)} rows`);
      console.log(`cell_month_r4: ${await insertCells('cell_month_r4', coarse.values())} rows`);

      for (const feature of regions) {
        const { iso3, name_en, name_ru } = feature.properties;
        const polygons =
          feature.geometry.type === 'Polygon'
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;
        const points = polygons.flat(2);
        const lons = points.map((p) => p[0]!);
        const lats = points.map((p) => p[1]!);
        const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
        const regionCells = new Set(
          polygons.flatMap((p) => polygonToCells(p, meta.harmonization.h3_resolution, true)),
        );

        await tx`insert into region (iso3, name_en, name_ru, bbox)
                 values (${iso3}, ${name_en}, ${name_ru ?? null}, ${bbox})
                 on conflict (iso3) do update
                   set name_en = excluded.name_en, name_ru = excluded.name_ru, bbox = excluded.bbox`;
        await tx`delete from region_cell where iso3 = ${iso3}`;
        const list = [...regionCells].map((h3) => ({ iso3, h3: h3ToDb(h3) }));
        for (let i = 0; i < list.length; i += BATCH * 4) {
          await tx`insert into region_cell ${tx(list.slice(i, i + BATCH * 4))}`;
        }
        console.log(`region ${iso3}: ${list.length} cells`);
      }

      // Country totals: aggregate first, medians are computed later on these sums.
      await tx`
        insert into region_month (version_id, iso3, year, month, harm, harm_lo, harm_hi, raw_modis, raw_viirs)
        select c.version_id, rc.iso3, c.year, c.month,
               sum(c.harm), sum(c.harm_lo), sum(c.harm_hi), sum(c.raw_modis), sum(c.raw_viirs)
          from cell_month c
          join region_cell rc on rc.h3 = c.h3
         where c.version_id = ${version}
         group by c.version_id, rc.iso3, c.year, c.month`;

      // Atomic swap of the active version.
      await tx`update dataset_version set is_active = false where is_active`;
      await tx`update dataset_version set is_active = true where id = ${version}`;
    });

    console.log(`${version} ingested and active.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
