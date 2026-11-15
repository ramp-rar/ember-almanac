import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { datasetVersion } from '@/db/schema';
import { DatasetMetaSchema, type DatasetMeta } from '@/lib/domain/meta';
import { getDb, isDatabaseConfigured } from '@/server/db/client';
import { remoteApiBase, remoteMeta } from './remote-api';
import { snapshotMeta } from './snapshot';

export type MetaSource = 'database' | 'local_fixture' | 'remote_api' | 'snapshot';

export interface ActiveDataset {
  readonly meta: DatasetMeta;
  readonly source: MetaSource;
}

/** Round-trip time of `select 1`, in milliseconds. Throws when the database is unreachable. */
export async function pingDatabase(): Promise<number> {
  const started = performance.now();
  await getDb().execute(sql`select 1`);
  return Math.round(performance.now() - started);
}

async function activeFromDatabase(): Promise<DatasetMeta | null> {
  const rows = await getDb()
    .select({ meta: datasetVersion.meta })
    .from(datasetVersion)
    .where(eq(datasetVersion.isActive, true))
    .limit(1);
  const row = rows[0];
  return row ? DatasetMetaSchema.parse(row.meta) : null;
}

/**
 * Local runs only (never on Vercel), when no database is configured: the newest `delivery/mock-*`
 * folder written by `pnpm fixtures`. Only mock deliveries are ever served this way.
 */
export async function localDeliveryDir(): Promise<string | null> {
  if (process.env.VERCEL || isDatabaseConfigured() || remoteApiBase()) return null;
  if (process.env.FIRE_DATA !== 'mock') return null;
  const root = path.join(process.cwd(), 'delivery');
  let names: string[];
  try {
    names = await readdir(root);
  } catch {
    return null;
  }
  const newest = names
    .filter((n) => n.startsWith('mock-'))
    .sort()
    .at(-1);
  return newest ? path.join(root, newest) : null;
}

async function activeFromLocalFixture(): Promise<DatasetMeta | null> {
  const dir = await localDeliveryDir();
  if (!dir) return null;
  try {
    const raw = await readFile(path.join(dir, 'meta.json'), 'utf8');
    return DatasetMetaSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getActiveDataset(): Promise<ActiveDataset | null> {
  // An explicitly configured data service wins over everything else.
  const remote = remoteApiBase();
  if (remote) return { meta: await remoteMeta(remote), source: 'remote_api' };
  if (isDatabaseConfigured()) {
    const meta = await activeFromDatabase();
    return meta ? { meta, source: 'database' } : null;
  }
  // Real bundled data first; generated mock fixtures only when explicitly asked (FIRE_DATA=mock).
  if (process.env.FIRE_DATA !== 'mock') return { meta: await snapshotMeta(), source: 'snapshot' };
  if (process.env.VERCEL) return null;
  const meta = await activeFromLocalFixture();
  return meta ? { meta, source: 'local_fixture' } : null;
}
