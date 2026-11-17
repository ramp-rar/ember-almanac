import { connection } from 'next/server';
import { clearSessionCookie, sameOriginJson, sessionToken } from '@/server/auth/http';
import { logout } from '@/server/auth/service';

export async function POST(request: Request): Promise<Response> {
  await connection();
  const refused = sameOriginJson(request);
  if (refused) return refused;
  const token = await sessionToken();
  try {
    if (token) await logout(token);
  } catch (error) {
    console.error('logout: failed to delete the session row', error);
  } finally {
    // The cookie goes in every case, so the browser is signed out even if the database is not.
    await clearSessionCookie();
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
