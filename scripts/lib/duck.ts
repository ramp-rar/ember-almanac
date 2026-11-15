import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

export async function openDuck(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:');
  return instance.connect();
}

/** A filesystem path as a SQL string literal (forward slashes, quotes escaped). */
export function sqlPath(p: string): string {
  return `'${p.replaceAll('\\', '/').replaceAll("'", "''")}'`;
}

/** Runs a query and returns plain objects; BIGINT/HUGEINT values become numbers. */
export async function rows<T extends Record<string, unknown>>(
  db: DuckDBConnection,
  sql: string,
): Promise<T[]> {
  const reader = await db.runAndReadAll(sql);
  return reader.getRowObjects().map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = typeof value === 'bigint' ? Number(value) : value;
    }
    return out as T;
  });
}
