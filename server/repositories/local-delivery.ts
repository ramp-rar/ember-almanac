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

function addInto(sums: Map<number, Row>, row: Row): void {
  const key = row.year * 12 + row.month;
  const s = sums.get(key);
  if (!s) sums.set(key, { ...row });
  else {
    sums.set(key, {
      year: row.year,
      month: row.month,
      harm: s.harm + row.harm,
      harmLo: (s.harmLo ?? 0) + (row.harmLo ?? 0),
      harmHi: (s.harmHi ?? 0) + (row.harmHi ?? 0),
      rawModis: (s.rawModis ?? 0) + (row.rawModis ?? 0),
      rawViirs: (s.rawViirs ?? 0) + (row.rawViirs ?? 0),
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

  /** (year*12+month) → h3 → harm, built lazily per index; coarse parents sum their children. */
  const monthIndexes = new Map<Map<string, Row[]>, Map<number, Map<string, number>>>();
  const monthIndex = (index: Map<string, Row[]>) => {
    let byMonth = monthIndexes.get(index);
    if (byMonth) return byMonth;
    byMonth = new Map();
    for (const [cell, rows] of index) {
      for (const row of rows) {
        const key = row.year * 12 + row.month;
        const cells = byMonth.get(key) ?? new Map<string, number>();
        cells.set(cell, (cells.get(cell) ?? 0) + row.harm);
        byMonth.set(key, cells);
      }
    }
    monthIndexes.set(index, byMonth);
    return byMonth;
  };
  const pick = (byCell: Map<string, number> | undefined, cells: Iterable<string>) => {
    const out: { h3: string; harm: number }[] = [];
    if (!byCell) return out;
    for (const h3 of cells) {
      const harm = byCell.get(h3);
      if (harm !== undefined) out.push({ h3, harm });
    }
    return out;
  };

  const geo = RegionsSchema.parse(
    JSON.parse(await readFile(path.join(dir, 'regions.geojson'), 'utf8')),
  );
  const regions = geo.features.map((f) => {
    const polygons =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const points = polygons.flat(2);
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lon, lat] of points) {
      bbox[0] = Math.min(bbox[0]!, lon!);
      bbox[1] = Math.min(bbox[1]!, lat!);
      bbox[2] = Math.max(bbox[2]!, lon!);
      bbox[3] = Math.max(bbox[3]!, lat!);
    }
    const cells = [...new Set(polygons.flatMap((p) => polygonToCells(p, 6, true)))];
    return {
      iso3: f.properties.iso3,
      nameEn: f.properties.name_en,
      bbox: [bbox[0]!, bbox[1]!, bbox[2]!, bbox[3]!] as const,
      cellsCount: cells.length,
      cells,
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
    async monthCells(target, year, month) {
      const key = year * 12 + month;
      if (target.kind === 'region') {
        const r = regions.find((x) => x.iso3 === target.iso3);
        return r ? pick(monthIndex(fine).get(key), r.cells) : [];
      }
      const index = target.resolution === 4 ? coarseIndex() : fine;
      return pick(monthIndex(index).get(key), new Set(target.cells));
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
