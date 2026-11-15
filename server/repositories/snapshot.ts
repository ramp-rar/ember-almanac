import { z } from 'zod';
import type { DatasetMeta } from '@/lib/domain/meta';
import kazakhstan from '@/data/snapshot/kazakhstan.json';
import regionsFile from '@/data/snapshot/regions.json';
import texas from '@/data/snapshot/texas.json';
import type { FireSource } from './fire-source';
import {
  CalendarRowSchema,
  OutsideCoverageError,
  RegionSchema,
  deriveMeta,
  summary,
  toRows,
  type ApiRegion,
  type ApiRow,
} from './remote-api';

/**
 * Real monthly data of the data team's Fire Calendar API, bundled with the app
 * (data/snapshot, exported from the API's /regions and /regions/{id}/calendar). It lets the app run anywhere — Vercel included —
 * without reaching the live service. Whole regions only: custom areas need the live service.
 */
const SnapshotSchema = z.object({
  generated_at: z.string(),
  source: z.string(),
  regions: z.array(RegionSchema),
});
const parsed = SnapshotSchema.parse(regionsFile);
const rowsById: Record<string, readonly ApiRow[]> = {
  kazakhstan: z.array(CalendarRowSchema).parse(kazakhstan),
  texas: z.array(CalendarRowSchema).parse(texas),
};
const regions: readonly ApiRegion[] = parsed.regions.filter((r) => rowsById[r.id] !== undefined);

export const SNAPSHOT_GENERATED_AT = parsed.generated_at;

export function snapshotMeta(): Promise<DatasetMeta> {
  return deriveMeta(regions, async (id) => rowsById[id] ?? [], 'snapshot');
}

export function snapshotSource(): FireSource {
  return {
    async monthCells() {
      return [];
    },
    async listRegions(query) {
      const q = query.trim().toLowerCase();
      return regions
        .filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.includes(q))
        .map(summary);
    },
    async region(iso3) {
      const r = regions.find((x) => x.id === iso3.toLowerCase());
      return r ? { ...summary(r), cellsCount: r.hexes_r5 ?? 0 } : null;
    },
    async regionMonthly(iso3) {
      const r = regions.find((x) => x.id === iso3.toLowerCase());
      return r ? toRows(rowsById[r.id] ?? []) : [];
    },
    async aoiMonthly() {
      throw new OutsideCoverageError(
        'Custom areas need the live data service, which is not connected in this deployment. Pick a country or region from the list.',
      );
    },
  };
}
