import { connection, type NextRequest } from 'next/server';
import { decodeAoi } from '@/lib/h3/aoi';
import type { AoiRef } from '@/lib/api/types';
import { exportMetadata, getCalendar, todayUtc } from '@/server/services/calendar-service';
import { handleError, jsonError } from '@/server/http';

/** GET /api/export/metadata?aoi=r:ZZA | a:<aoiId> → metadata.json for summary.csv (F05). */
export async function GET(request: NextRequest): Promise<Response> {
  await connection();
  const param = request.nextUrl.searchParams.get('aoi') ?? '';
  let ref: AoiRef | null = null;
  if (/^r:[A-Z]{3}$/.test(param)) ref = { kind: 'region', iso3: param.slice(2) };
  else if (param.startsWith('a:') && decodeAoi(param.slice(2)))
    ref = { kind: 'aoi', id: param.slice(2) };
  if (!ref) return jsonError(400, 'bad_request', 'aoi must be r:<ISO3> or a:<aoiId>.');
  try {
    const data = await getCalendar(ref, todayUtc());
    const name = `fire-trace_${data.aoi.id}_${data.dataset.version}_metadata.json`;
    return new Response(JSON.stringify(exportMetadata(data, new Date().toISOString()), null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleError('metadata export', error);
  }
}
