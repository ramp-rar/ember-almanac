import { z } from 'zod';
import { DatasetMetaSchema, isMockDataset } from '@/lib/domain/meta';
import { isDatabaseConfigured } from '@/server/db/client';
import { getActiveDataset, pingDatabase } from '@/server/repositories/dataset-repository';

export const MetaResponseSchema = z.object({
  dataset_version: z.string(),
  is_mock: z.boolean(),
  source: z.enum(['database', 'local_fixture', 'remote_api', 'snapshot']),
  meta: DatasetMetaSchema,
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  dataset_version: z.string().nullable(),
  db: z.object({
    configured: z.boolean(),
    reachable: z.boolean(),
    latency_ms: z.number().nullable(),
  }),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export async function getMeta(): Promise<MetaResponse | null> {
  const active = await getActiveDataset();
  if (!active) return null;
  return MetaResponseSchema.parse({
    dataset_version: active.meta.dataset_version,
    is_mock: isMockDataset(active.meta),
    source: active.source,
    meta: active.meta,
  });
}

/** Never throws: an unreachable database is reported as `degraded`, not as a crash. */
export async function getHealth(now: Date): Promise<HealthResponse> {
  const configured = isDatabaseConfigured();
  let reachable = false;
  let latency: number | null = null;
  let version: string | null = null;

  if (configured) {
    try {
      latency = await pingDatabase();
      reachable = true;
    } catch (error) {
      console.error('health: database ping failed', error);
    }
  }
  if (reachable || !configured) {
    try {
      version = (await getActiveDataset())?.meta.dataset_version ?? null;
    } catch (error) {
      console.error('health: reading the active dataset failed', error);
    }
  }

  return HealthResponseSchema.parse({
    // No database configured is fine when a bundled/remote dataset serves the app.
    status: (reachable || !configured) && version !== null ? 'ok' : 'degraded',
    dataset_version: version,
    db: { configured, reachable, latency_ms: latency },
    time: now.toISOString(),
  });
}
