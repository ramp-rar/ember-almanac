import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  varchar,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { DatasetMeta } from '@/lib/domain/meta';

/** Data model from docs/SPEC.md. H3 indexes are stored as bigint (bit 63 of an H3 index is 0). */

export const datasetVersion = pgTable(
  'dataset_version',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb('meta').$type<DatasetMeta>().notNull(),
    isActive: boolean('is_active').notNull().default(false),
  },
  (t) => [
    // At most one active version: the swap in ingest is atomic.
    uniqueIndex('dataset_version_one_active')
      .on(t.isActive)
      .where(sql`${t.isActive}`),
  ],
);

const cellMonthColumns = {
  versionId: text('version_id')
    .notNull()
    .references(() => datasetVersion.id, { onDelete: 'cascade' }),
  h3: bigint('h3', { mode: 'bigint' }).notNull(),
  year: smallint('year').notNull(),
  month: smallint('month').notNull(),
  harm: real('harm').notNull(),
  harmLo: real('harm_lo').notNull(),
  harmHi: real('harm_hi').notNull(),
  rawModis: integer('raw_modis').notNull(),
  rawViirs: integer('raw_viirs').notNull(),
  frp: real('frp').notNull(),
  /** 'SP' or 'NRT'. varchar, not the char(3) of SPEC.md: char pads 'SP' to 'SP '. */
  processing: varchar('processing', { length: 3 }).notNull(),
};

/** Sparse: a missing row is 0 when the month is observed; otherwise meta decides the status. */
export const cellMonth = pgTable('cell_month', cellMonthColumns, (t) => [
  primaryKey({ columns: [t.versionId, t.h3, t.year, t.month] }),
]);

/** Same values aggregated to the r4 parent cells, for AOIs above 50 000 cells. */
export const cellMonthR4 = pgTable('cell_month_r4', cellMonthColumns, (t) => [
  primaryKey({ columns: [t.versionId, t.h3, t.year, t.month] }),
]);

export const region = pgTable('region', {
  iso3: text('iso3').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameRu: text('name_ru'),
  /** [west, south, east, north] */
  bbox: doublePrecision('bbox').array().notNull(),
  geomBlobUrl: text('geom_blob_url'),
});

export const regionCell = pgTable(
  'region_cell',
  {
    iso3: text('iso3')
      .notNull()
      .references(() => region.iso3, { onDelete: 'cascade' }),
    h3: bigint('h3', { mode: 'bigint' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.iso3, t.h3] }), index('region_cell_h3').on(t.h3)],
);

/** Precomputed country totals (sum over the region's cells), one row per observed month. */
export const regionMonth = pgTable(
  'region_month',
  {
    versionId: text('version_id')
      .notNull()
      .references(() => datasetVersion.id, { onDelete: 'cascade' }),
    iso3: text('iso3')
      .notNull()
      .references(() => region.iso3, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    month: smallint('month').notNull(),
    harm: real('harm').notNull(),
    harmLo: real('harm_lo').notNull(),
    harmHi: real('harm_hi').notNull(),
    rawModis: integer('raw_modis').notNull(),
    rawViirs: integer('raw_viirs').notNull(),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.iso3, t.year, t.month] })],
);

export const aoi = pgTable('aoi', {
  /** Hash of the normalised geometry → shareable `/a/<aoiId>` links. */
  id: text('id').primaryKey(),
  /** 'polygon' | 'bbox' | 'point_radius' */
  kind: text('kind').notNull(),
  geojson: jsonb('geojson').notNull(),
  cellsCompact: bigint('cells_compact', { mode: 'bigint' }).array().notNull(),
  resolution: smallint('resolution').notNull(),
  areaKm2: doublePrecision('area_km2').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
