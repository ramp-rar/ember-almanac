import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DatasetMetaSchema } from '@/lib/domain/meta';

/**
 * data/snapshot/index.json, written by `pnpm snapshot`: dataset meta and the region list with
 * names in every UI language. Read once per server instance. Shared by the snapshot source and
 * the live API adapter (the live API names regions in one language only).
 */
export const NamesSchema = z.object({ en: z.string(), ru: z.string(), tg: z.string() });
export type RegionNames = z.infer<typeof NamesSchema>;

const IndexSchema = z.object({
  generated_at: z.string(),
  source: z.string(),
  meta: DatasetMetaSchema,
  regions: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9_]{1,60}$/),
      name: z.string(),
      data_end: z.iso.date(),
      last_full_month: z.string(),
      first_month: z.string(),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      hexes_r5: z.number().int().nonnegative().optional(),
      names: NamesSchema.loose(),
    }),
  ),
});
export type SnapshotIndex = z.infer<typeof IndexSchema>;

export const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'snapshot');
let cache: Promise<SnapshotIndex | null> | null = null;

export function snapshotIndex(): Promise<SnapshotIndex | null> {
  cache ??= readFile(path.join(SNAPSHOT_DIR, 'index.json'), 'utf8')
    .then((raw) => IndexSchema.parse(JSON.parse(raw)))
    .catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      cache = null;
      throw error;
    });
  return cache;
}

export async function namesOf(id: string): Promise<RegionNames | null> {
  const index = await snapshotIndex();
  const r = index?.regions.find((x) => x.id === id.toLowerCase());
  return r ? { en: r.names.en, ru: r.names.ru, tg: r.names.tg } : null;
}

/** Search across the source name, the id and the names in every UI language. */
export function matchesQuery(
  query: string,
  id: string,
  name: string,
  names: RegionNames | null,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [id, name, ...(names ? Object.values(names) : [])].some((n) =>
    n.toLowerCase().includes(q),
  );
}
