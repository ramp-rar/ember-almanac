import { connection } from 'next/server';
import { clearSessionCookie, sameOriginJson, sessionToken } from '@/server/auth/http';
import { logout } from '@/server/auth/service';

export async function POST(request: Request): Promise<Response> {
  await connection();
  const refused = sameOriginJson(request);
  if (refused) return refused;
  const token = await sessionToken();
  if (token) await logout(token);
  await clearSessionCookie();
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
