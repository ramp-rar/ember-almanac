/**
 * Fixed-window limiter per key (e.g. "login:<ip>"). In memory: per server instance, which is
 * enough to stop brute force against one instance; a shared store (e.g. Redis) is the next step
 * for many serverless instances (recorded in ADR 0005).
 */
const windows = new Map<string, { start: number; count: number }>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    }
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

/** Test hook. */
export function resetLimits(): void {
  windows.clear();
}
