import { connection, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveSource } from '@/server/repositories/fire-source';
import { handleError, jsonError } from '@/server/http';

const Query = z.object({ q: z.string().max(64).default('') });

export async function GET(request: NextRequest): Promise<Response> {
  await connection();
  const parsed = Query.safeParse({ q: request.nextUrl.searchParams.get('q') ?? undefined });
  if (!parsed.success) return jsonError(400, 'bad_request', 'q must be at most 64 characters.');
  try {
    const active = await getActiveSource();
    if (!active) return jsonError(503, 'no_active_dataset', 'No dataset has been ingested yet.');
    const regions = await active.source.listRegions(parsed.data.q);
    return Response.json(regions, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch (error) {
    return handleError('regions', error);
  }
}
