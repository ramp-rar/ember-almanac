import { connection } from 'next/server';
import { decodeAoi } from '@/lib/h3/aoi';
import { getCalendar, todayUtc } from '@/server/services/calendar-service';
import { DATA_CACHE_HEADERS, handleError, jsonError } from '@/server/http';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ aoiId: string }> },
): Promise<Response> {
  await connection();
  const { aoiId } = await params;
  if (aoiId.length > 80 || !decodeAoi(aoiId)) {
    return jsonError(400, 'bad_request', 'Invalid area id.');
  }
  try {
    const data = await getCalendar({ kind: 'aoi', id: aoiId }, todayUtc());
    return Response.json(data, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    return handleError('aoi calendar', error);
  }
}
