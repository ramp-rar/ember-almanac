import { NoDatasetError, NotFoundError } from '@/server/services/calendar-service';

export function jsonError(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Maps domain errors to readable API errors; never leaks internals. */
export function handleError(scope: string, error: unknown): Response {
  if (error instanceof NotFoundError) return jsonError(404, 'not_found', error.message);
  if (error instanceof NoDatasetError) return jsonError(503, 'no_active_dataset', error.message);
  console.error(`${scope}: failed`, error);
  return jsonError(
    503,
    'unavailable',
    'The data service is temporarily unavailable. Please retry.',
  );
}

/** Responses change when a new dataset is activated or a day passes. */
export const CALENDAR_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';
