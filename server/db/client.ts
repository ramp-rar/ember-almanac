import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Request-time client, created lazily so builds need no database. Neon URLs use the HTTP driver
 * (best for serverless); any other Postgres (local, CI) uses postgres.js.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const isNeon = new URL(url).hostname.endsWith('.neon.tech');
  cached = (isNeon
    ? drizzleNeon(neon(url), { schema })
    : drizzlePostgres(postgres(url, { max: 5 }), { schema })) as unknown as Db;
  return cached;
}
