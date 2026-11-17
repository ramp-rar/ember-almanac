import { connection } from 'next/server';
import {
  authErrorResponse,
  limited,
  limitedAccount,
  sameOriginJson,
  setSessionCookie,
} from '@/server/auth/http';
import { CredentialsSchema, login } from '@/server/auth/service';
import { jsonError } from '@/server/http';

export async function POST(request: Request): Promise<Response> {
  await connection();
  const refused = sameOriginJson(request) ?? limited(request, 'login');
  if (refused) return refused;
  const parsed = CredentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Same answer as a wrong password: the form validates the shape on its own.
    return jsonError(401, 'invalid_credentials', 'Wrong e-mail or password.');
  }
  const perAccount = limitedAccount('login-account', parsed.data.email);
  if (perAccount) return perAccount;
  try {
    const { token, expiresAt } = await login(parsed.data);
    await setSessionCookie(token, expiresAt);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
