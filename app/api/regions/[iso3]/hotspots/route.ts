import { connection, type NextRequest } from 'next/server';
import { todayUtc } from '@/server/services/calendar-service';
import { getHotspots } from '@/server/services/hotspots-service';
import { CALENDAR_CACHE, handleError, jsonError, parseYearMonth } from '@/server/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ iso3: string }> },
): Promise<Response> {
  await connection();
  const { iso3 } = await params;
  if (!/^[A-Z]{3}$/.test(iso3))
    return jsonError(400, 'bad_request', 'Region code must be 3 capital letters.');
  const today = todayUtc();
  const month = parseYearMonth(request.nextUrl.searchParams, today);
  if (month instanceof Response) return month;
  try {
    const data = await getHotspots({ kind: 'region', iso3 }, month.y, month.m, today);
    return Response.json(data, { headers: { 'Cache-Control': CALENDAR_CACHE } });
  } catch (error) {
    return handleError('region hotspots', error);
  }
}
