import { connection } from 'next/server';
import { getCalendar, todayUtc } from '@/server/services/calendar-service';
import { CALENDAR_CACHE, handleError, jsonError } from '@/server/http';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ iso3: string }> },
): Promise<Response> {
  await connection();
  const { iso3 } = await params;
  if (!/^[A-Z]{3}$/.test(iso3))
    return jsonError(400, 'bad_request', 'Region code must be 3 capital letters.');
  try {
    const data = await getCalendar({ kind: 'region', iso3 }, todayUtc());
    return Response.json(data, { headers: { 'Cache-Control': CALENDAR_CACHE } });
  } catch (error) {
    return handleError('region calendar', error);
  }
}
