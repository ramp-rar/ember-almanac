import { connection } from 'next/server';
import { getMeta } from '@/server/services/meta-service';

export async function GET(): Promise<Response> {
  await connection();
  try {
    const meta = await getMeta();
    if (!meta) {
      return Response.json(
        { error: 'no_active_dataset', message: 'No dataset has been ingested yet.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    // The active version can change after an ingest, so this is cached only briefly.
    return Response.json(meta, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('meta: failed', error);
    return Response.json(
      { error: 'meta_unavailable', message: 'Dataset metadata is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
