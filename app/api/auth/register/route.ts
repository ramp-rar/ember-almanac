import { connection } from 'next/server';
import { appUrl, authErrorResponse, limited, sameOriginJson } from '@/server/auth/http';
import { CredentialsSchema, register } from '@/server/auth/service';
import { jsonError } from '@/server/http';

export async function POST(request: Request): Promise<Response> {
  await connection();
  const refused = sameOriginJson(request) ?? limited(request, 'register');
  if (refused) return refused;
  const parsed = CredentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, 'invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }
  try {
    const { mailSent } = await register(parsed.data, appUrl(request));
    return Response.json({ ok: true, mailSent }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
