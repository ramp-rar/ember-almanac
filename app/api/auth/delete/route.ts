import { connection } from 'next/server';
import { z } from 'zod';
import {
  authErrorResponse,
  clearSessionCookie,
  limited,
  sameOriginJson,
  sessionToken,
} from '@/server/auth/http';
import { deleteAccount } from '@/server/auth/service';
import { jsonError } from '@/server/http';

const BodySchema = z.object({ password: z.string().min(1).max(200) });

/** Permanently deletes the signed-in account after re-entering the password. */
export async function POST(request: Request): Promise<Response> {
  await connection();
  const refused = sameOriginJson(request) ?? limited(request, 'delete');
  if (refused) return refused;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, 'invalid_input', 'Enter your password.');
  try {
    await deleteAccount(await sessionToken(), parsed.data.password);
    await clearSessionCookie();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
