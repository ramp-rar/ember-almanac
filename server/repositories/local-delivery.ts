import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cellToParent, polygonToCells } from 'h3-js';
import { z } from 'zod';
import type { AoiMonthRow } from '@/lib/domain/calendar';
import type { FireSource } from './fire-source';

/**
 * Local development without a database: a mock delivery read once from `delivery/mock-*`
 * (cell_month.parquet via DuckDB, regions.geojson) and indexed in memory.
 */

type Row = AoiMonthRow;

const RegionsSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({ iso3: z.string(), name_en: z.string() }),
      geometry: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
      }),
    }),
  ),
});

function addInto(sums: Map<number, Row>, row: Row): void {
  const key = row.year * 12 + row.month;
  const s = sums.get(key);
  if (!s) sums.set(key, { ...row });
  else {
    sums.set(key, {
      year: row.year,
      month: row.month,
      harm: s.harm + row.harm,
      harmLo: s.harmLo + row.harmLo,
      harmHi: s.harmHi + row.harmHi,
      rawModis: s.rawModis + row.rawModis,
      rawViirs: s.rawViirs + row.rawViirs,
    });
  }
}

function sumCells(index: Map<string, Row[]>, cells: Iterable<string>): Row[] {
  const sums = new Map<number, Row>();
  for (const cell of cells) for (const row of index.get(cell) ?? []) addInto(sums, row);
  return [...sums.values()];
}

async function load(dir: string): Promise<FireSource> {
  const { DuckDBInstance } = await import('@duckdb/node-api');
  const instance = await DuckDBInstance.create(':memory:');
  const db = await instance.connect();
  const file = path.join(dir, 'cell_month.parquet').replaceAll('\\', '/').replaceAll("'", "''");
  const reader = await db.runAndReadAll(
    `SELECT h3, year::INTEGER, month::INTEGER, fire_days_harm::DOUBLE, fire_days_harm_lo::DOUBLE,
            fire_days_harm_hi::DOUBLE, det_modis_raw::INTEGER, det_viirs_raw::INTEGER
       FROM read_parquet('${file}')`,
  );
  const fine = new Map<string, Row[]>();
  for (const r of reader.getRows()) {
    const row: Row = {
      year: Number(r[1]),
      month: Number(r[2]),
      harm: Number(r[3]),
      harmLo: Number(r[4]),
      harmHi: Number(r[5]),
      rawModis: Number(r[6]),
      rawViirs: Number(r[7]),
    };
    const h3 = String(r[0]);
    const list = fine.get(h3);
    if (list) list.push(row);
    else fine.set(h3, [row]);
  }
  db.closeSync();

  let coarse: Map<string, Row[]> | null = null;
  const coarseIndex = () => {
    if (coarse) return coarse;
    coarse = new Map();
    for (const [cell, rows] of fine) {
      const parent = cellToParent(cell, 4);
      const list = coarse.get(parent) ?? [];
      list.push(...rows);
      coarse.set(parent, list);
    }
    return coarse;
  };

  const geo = RegionsSchema.parse(
    JSON.parse(await readFile(path.join(dir, 'regions.geojson'), 'utf8')),
  );
  const regions = geo.features.map((f) => {
    const ring = f.geometry.coordinates[0]!;
    const lons = ring.map((p) => p[0]!);
    const lats = ring.map((p) => p[1]!);
    const cells = polygonToCells(f.geometry.coordinates, 6, true);
    return {
      iso3: f.properties.iso3,
      nameEn: f.properties.name_en,
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as const,
      cellsCount: cells.length,
      monthly: sumCells(fine, cells),
    };
  });

  return {
    async listRegions(query) {
      const q = query.trim().toLowerCase();
      return regions
        .filter((r) => !q || r.nameEn.toLowerCase().includes(q) || r.iso3.toLowerCase().includes(q))
        .map(({ iso3, nameEn, bbox }) => ({ iso3, nameEn, bbox }));
    },
    async region(iso3) {
      const r = regions.find((x) => x.iso3 === iso3);
      return r ? { iso3: r.iso3, nameEn: r.nameEn, bbox: r.bbox, cellsCount: r.cellsCount } : null;
    },
    async regionMonthly(iso3) {
      return regions.find((x) => x.iso3 === iso3)?.monthly ?? [];
    },
    async aoiMonthly(cells, resolution) {
      return sumCells(resolution === 4 ? coarseIndex() : fine, cells);
    },
  };
}

const cache = new Map<string, Promise<FireSource>>();

export function loadLocalDelivery(dir: string): Promise<FireSource> {
  let source = cache.get(dir);
  if (!source) {
    source = load(dir);
    source.catch(() => cache.delete(dir));
    cache.set(dir, source);
  }
  return source;
}
