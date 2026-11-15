import { connection } from 'next/server';
import { z } from 'zod';
import { authErrorResponse, sameOriginJson, sessionToken } from '@/server/auth/http';
import { PlaceIdSchema, setPlace } from '@/server/auth/service';
import { jsonError } from '@/server/http';

const BodySchema = z.object({ placeId: PlaceIdSchema, saved: z.boolean() });

/** Save or remove a place in "My places". */
export async function PUT(request: Request): Promise<Response> {
  await connection();
  const refused = sameOriginJson(request);
  if (refused) return refused;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, 'invalid_input', 'Invalid place.');
  try {
    await setPlace(await sessionToken(), parsed.data.placeId, parsed.data.saved);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
