import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { DatasetMeta } from '@/lib/domain/meta';
import type { FireSource } from './fire-source';
import {
  CalendarRowSchema,
  CorridorRowSchema,
  ForecastRowSchema,
  OutsideCoverageError,
  toForecast,
  toRows,
} from './remote-api';
import { SNAPSHOT_DIR, matchesQuery, snapshotIndex } from './snapshot-index';

/**
 * Real data of the data team's Fire Calendar API exported into data/snapshot by `pnpm snapshot`,
 * so the app runs anywhere — Vercel included — without the live service. Whole regions only;
 * custom areas need the live service. Region files are read on demand and kept in memory.
 */
const RegionFileSchema = z.object({
  calendar: z.array(CalendarRowSchema),
  forecast: z.array(ForecastRowSchema).nullable(),
  anomalies: z.array(CorridorRowSchema).nullable(),
});
type RegionFile = z.infer<typeof RegionFileSchema>;

const files = new Map<string, Promise<RegionFile | null>>();

function regionFile(id: string): Promise<RegionFile | null> {
  if (!/^[a-z0-9_]{1,60}$/.test(id)) return Promise.resolve(null); // never a path from the URL
  let p = files.get(id);
  if (!p) {
    p = readFile(path.join(SNAPSHOT_DIR, 'regions', `${id}.json`), 'utf8')
      .then((raw) => RegionFileSchema.parse(JSON.parse(raw)))
      .catch((error: unknown) => {
        files.delete(id);
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      });
    files.set(id, p);
  }
  return p;
}

export async function snapshotMeta(): Promise<DatasetMeta | null> {
  return (await snapshotIndex())?.meta ?? null;
}

export function snapshotSource(): FireSource {
  const find = async (iso3: string) =>
    (await snapshotIndex())?.regions.find((r) => r.id === iso3.toLowerCase()) ?? null;
  const summary = (r: NonNullable<Awaited<ReturnType<typeof find>>>) => ({
    iso3: r.id.toUpperCase(),
    nameEn: r.names.en,
    names: { en: r.names.en, ru: r.names.ru, tg: r.names.tg },
    bbox: r.bbox,
  });
  return {
    async monthCells() {
      return [];
    },
    async corridorHistory(iso3) {
      return (await regionFile(iso3.toLowerCase()))?.anomalies ?? null;
    },
    async forecast(iso3) {
      const f = (await regionFile(iso3.toLowerCase()))?.forecast;
      return f ? toForecast(f) : null;
    },
    async listRegions(query) {
      const index = await snapshotIndex();
      return (index?.regions ?? [])
        .filter((r) => matchesQuery(query, r.id, r.name, r.names))
        .map(summary)
        .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    },
    async region(iso3) {
      const r = await find(iso3);
      return r ? { ...summary(r), cellsCount: r.hexes_r5 ?? 0 } : null;
    },
    async regionMonthly(iso3) {
      const f = await regionFile(iso3.toLowerCase());
      return f ? toRows(f.calendar) : [];
    },
    async aoiMonthly() {
      throw new OutsideCoverageError(
        'Custom areas need the live data service, which is not connected in this deployment. Pick a country or region from the list.',
      );
    },
  };
}
