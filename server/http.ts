import { z } from 'zod';
import {
  InvalidAreaError,
  NoDatasetError,
  NotFoundError,
} from '@/server/services/calendar-service';
import { OutsideCoverageError, RemoteApiError } from '@/server/repositories/remote-api';

export function jsonError(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Maps domain errors to readable API errors; never leaks internals. */
export function handleError(scope: string, error: unknown): Response {
  if (error instanceof NotFoundError) return jsonError(404, 'not_found', error.message);
  if (error instanceof NoDatasetError) return jsonError(503, 'no_active_dataset', error.message);
  if (error instanceof OutsideCoverageError) return jsonError(404, 'no_coverage', error.message);
  if (error instanceof RemoteApiError) {
    console.error(`${scope}: data service`, error);
    return jsonError(503, 'unavailable', error.message);
  }
  if (error instanceof InvalidAreaError) return jsonError(400, 'invalid_area', error.message);
  console.error(`${scope}: failed`, error);
  // Database connection failures are outages (503); anything else is a bug (500).
  const message = error instanceof Error ? error.message : '';
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|connect/i.test(message)) {
    return jsonError(
      503,
      'unavailable',
      'The data service is temporarily unavailable. Please retry.',
    );
  }
  return jsonError(500, 'internal', 'Something went wrong while computing this calendar.');
}

const intParam = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number);

/**
 * Validates `?y=YYYY&m=M` (y in 2000..current year + 1, m in 1..12).
 * Returns the parsed month, or a 400 Response in the ApiError shape.
 */
export function parseYearMonth(
  params: URLSearchParams,
  today: string,
): { y: number; m: number } | Response {
  const maxYear = Number(today.slice(0, 4)) + 1;
  const Query = z.object({
    y: intParam.pipe(z.number().int().min(2000).max(maxYear)),
    m: intParam.pipe(z.number().int().min(1).max(12)),
  });
  const parsed = Query.safeParse({
    y: params.get('y') ?? undefined,
    m: params.get('m') ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(
      400,
      'bad_request',
      `y must be a year from 2000 to ${maxYear} and m a month from 1 to 12.`,
    );
  }
  return parsed.data;
}

/** Responses change when a new dataset is activated or a day passes. */
export const CALENDAR_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';
