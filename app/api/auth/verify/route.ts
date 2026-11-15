import { connection } from 'next/server';
import { AuthError, verifyEmail } from '@/server/auth/service';

/** The link in the confirmation e-mail. Redirects to the sign-in page with the outcome. */
export async function GET(request: Request): Promise<Response> {
  await connection();
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  let outcome = 'ok';
  try {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new AuthError('invalid_link', 'bad token');
    await verifyEmail(token);
  } catch (error) {
    outcome = error instanceof AuthError ? 'invalid' : 'error';
    if (!(error instanceof AuthError)) console.error('verify: failed', error);
  }
  // Relative Location keeps the browser on the host it used (proxies may rewrite request.url).
  return new Response(null, {
    status: 303,
    headers: { Location: `/account?verified=${outcome}`, 'Cache-Control': 'no-store' },
  });
}
