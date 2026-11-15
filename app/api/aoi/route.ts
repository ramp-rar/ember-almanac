import { connection } from 'next/server';
import { z } from 'zod';
import { decodeAoi, encodeAoi, validateAoi, type AoiInput } from '@/lib/h3/aoi';
import { handleError, jsonError } from '@/server/http';
import { cellsOrThrow } from '@/server/services/calendar-service';

const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point'), lat: z.number(), lon: z.number(), radiusKm: z.number() }),
  z.object({
    kind: z.literal('bbox'),
    west: z.number(),
    south: z.number(),
    east: z.number(),
    north: z.number(),
  }),
]);

/** {point+radius | bbox} → {aoiId, cellsCount, areaKm2, resolution}. Drawn polygons come with F01. */
export async function POST(request: Request): Promise<Response> {
  await connection();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, 'bad_request', 'Body must be JSON.');
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success)
    return jsonError(400, 'bad_request', 'Expected a point with radius or a bounding box.');
  const input = parsed.data as AoiInput;
  const problems = validateAoi(input);
  if (problems.length > 0) return jsonError(400, 'invalid_area', problems.join(' '));

  // The id is rounded; validate what the calendar GET will see.
  const aoiId = encodeAoi(input);
  const canonical = decodeAoi(aoiId);
  if (!canonical) return jsonError(400, 'invalid_area', 'This area is not valid after rounding.');
  let cells;
  try {
    cells = cellsOrThrow(canonical);
  } catch (error) {
    return handleError('aoi', error);
  }
  return Response.json(
    {
      aoiId,
      cellsCount: cells.cells.length,
      areaKm2: cells.areaKm2,
      resolution: cells.resolution,
      coarse: cells.coarse,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
