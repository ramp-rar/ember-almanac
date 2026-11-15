import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { cellMonth, cellMonthR4, region, regionCell, regionMonth } from '@/db/schema';
import type { AoiMonthRow } from '@/lib/domain/calendar';
import type { DatasetMeta } from '@/lib/domain/meta';
import { getDb } from '@/server/db/client';
import { getActiveDataset, localDeliveryDir, type MetaSource } from './dataset-repository';
import { loadLocalDelivery } from './local-delivery';

export type Bbox = readonly [number, number, number, number];

export interface RegionSummary {
  readonly iso3: string;
  readonly nameEn: string;
  readonly bbox: Bbox;
}

/** Where fire numbers come from. Two implementations: Postgres, and a local mock delivery. */
export interface FireSource {
  listRegions(query: string): Promise<RegionSummary[]>;
  region(iso3: string): Promise<(RegionSummary & { cellsCount: number }) | null>;
  /** Country totals per (year, month), sparse. */
  regionMonthly(iso3: string): Promise<AoiMonthRow[]>;
  /** Totals over a set of H3 cells (hex) at the given resolution, sparse. */
  aoiMonthly(cells: readonly string[], resolution: number): Promise<AoiMonthRow[]>;
  /** Per-cell harm (h3 as hex) for one month, sparse: only rows that exist. */
  monthCells(target: MonthCellTarget, year: number, month: number): Promise<MonthCell[]>;
}

export type MonthCellTarget =
  | { readonly kind: 'region'; readonly iso3: string }
  | { readonly kind: 'cells'; readonly cells: readonly string[]; readonly resolution: number };

export interface MonthCell {
  readonly h3: string;
  readonly harm: number;
}

export interface ActiveSource {
  readonly meta: DatasetMeta;
  readonly origin: MetaSource;
  readonly source: FireSource;
}

const h3ToDb = (hex: string) => BigInt(`0x${hex}`).toString();
const dbToH3 = (value: bigint) => value.toString(16);

function postgresSource(version: string): FireSource {
  const db = getDb();
  const toBbox = (b: number[]): Bbox => [b[0]!, b[1]!, b[2]!, b[3]!];
  return {
    async listRegions(query) {
      const q = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      const rows = await db
        .select({ iso3: region.iso3, nameEn: region.nameEn, bbox: region.bbox })
        .from(region)
        .where(query ? or(ilike(region.nameEn, q), ilike(region.iso3, q)) : undefined)
        .orderBy(asc(region.nameEn))
        .limit(20);
      return rows.map((r) => ({ ...r, bbox: toBbox(r.bbox) }));
    },
    async region(iso3) {
      const rows = await db
        .select({ iso3: region.iso3, nameEn: region.nameEn, bbox: region.bbox })
        .from(region)
        .where(eq(region.iso3, iso3))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const [cells] = await db
        .select({ n: count() })
        .from(regionCell)
        .where(eq(regionCell.iso3, iso3));
      return { ...row, bbox: toBbox(row.bbox), cellsCount: cells?.n ?? 0 };
    },
    async regionMonthly(iso3) {
      const rows = await db
        .select()
        .from(regionMonth)
        .where(and(eq(regionMonth.versionId, version), eq(regionMonth.iso3, iso3)));
      return rows.map((r) => ({
        year: r.year,
        month: r.month,
        harm: r.harm,
        harmLo: r.harmLo,
        harmHi: r.harmHi,
        rawModis: r.rawModis,
        rawViirs: r.rawViirs,
      }));
    },
    async aoiMonthly(cells, resolution) {
      if (cells.length === 0) return [];
      const t = resolution === 4 ? cellMonthR4 : cellMonth;
      const csv = cells.map(h3ToDb).join(',');
      const f8 = (col: AnyPgColumn) => sql<number>`sum(${col})::float8`.mapWith(Number);
      return db
        .select({
          year: t.year,
          month: t.month,
          harm: f8(t.harm),
          harmLo: f8(t.harmLo),
          harmHi: f8(t.harmHi),
          rawModis: f8(t.rawModis),
          rawViirs: f8(t.rawViirs),
        })
        .from(t)
        .where(
          and(eq(t.versionId, version), sql`${t.h3} = any(string_to_array(${csv}, ',')::bigint[])`),
        )
        .groupBy(t.year, t.month);
    },
    async monthCells(target, year, month) {
      if (target.kind === 'region') {
        // region_cell (PK iso3, h3) drives PK lookups into cell_month (version, h3, year, month).
        const rows = await db
          .select({ h3: cellMonth.h3, harm: cellMonth.harm })
          .from(regionCell)
          .innerJoin(
            cellMonth,
            and(
              eq(cellMonth.h3, regionCell.h3),
              eq(cellMonth.versionId, version),
              eq(cellMonth.year, year),
              eq(cellMonth.month, month),
            ),
          )
          .where(eq(regionCell.iso3, target.iso3));
        return rows.map((r) => ({ h3: dbToH3(r.h3), harm: r.harm }));
      }
      if (target.cells.length === 0) return [];
      const t = target.resolution === 4 ? cellMonthR4 : cellMonth;
      const csv = target.cells.map(h3ToDb).join(',');
      const rows = await db
        .select({ h3: t.h3, harm: t.harm })
        .from(t)
        .where(
          and(
            eq(t.versionId, version),
            eq(t.year, year),
            eq(t.month, month),
            sql`${t.h3} = any(string_to_array(${csv}, ',')::bigint[])`,
          ),
        );
      return rows.map((r) => ({ h3: dbToH3(r.h3), harm: r.harm }));
    },
  };
}

export async function getActiveSource(): Promise<ActiveSource | null> {
  const active = await getActiveDataset();
  if (!active) return null;
  if (active.source === 'database') {
    return { ...active, origin: 'database', source: postgresSource(active.meta.dataset_version) };
  }
  const dir = await localDeliveryDir();
  if (!dir) return null;
  return { ...active, origin: 'local_fixture', source: await loadLocalDelivery(dir) };
}
