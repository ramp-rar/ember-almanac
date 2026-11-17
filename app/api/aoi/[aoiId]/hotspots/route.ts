import { connection, type NextRequest } from 'next/server';
import { decodeAoi } from '@/lib/h3/aoi';
import { todayUtc } from '@/server/services/calendar-service';
import { getHotspots } from '@/server/services/hotspots-service';
import { DATA_CACHE_HEADERS, handleError, jsonError, parseYearMonth } from '@/server/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ aoiId: string }> },
): Promise<Response> {
  await connection();
  const { aoiId } = await params;
  if (aoiId.length > 80 || !decodeAoi(aoiId)) {
    return jsonError(400, 'bad_request', 'Invalid area id.');
  }
  const today = todayUtc();
  const month = parseYearMonth(request.nextUrl.searchParams, today);
  if (month instanceof Response) return month;
  try {
    const data = await getHotspots({ kind: 'aoi', id: aoiId }, month.y, month.m, today);
    return Response.json(data, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    return handleError('aoi hotspots', error);
  }
}
