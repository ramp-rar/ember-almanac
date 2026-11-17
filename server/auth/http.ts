import { cookies } from 'next/headers';
import { jsonError } from '@/server/http';
import { allow } from './rate-limit';
import { AuthError, SESSION_DAYS } from './service';

export const SESSION_COOKIE = 'ea_session';

/**
 * CSRF guard for state-changing requests: JSON only (a cross-site form cannot send it without a
 * CORS preflight we never allow) and, when the browser sends one, an Origin equal to ours.
 */
export function sameOriginJson(request: Request): Response | null {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    return jsonError(415, 'bad_request', 'Send JSON.');
  }
  // Compare with the host the browser actually used (behind a proxy request.url may differ).
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && (!host || safeHost(origin) !== host)) {
    return jsonError(403, 'forbidden', 'Cross-site request refused.');
  }
  return null;
}

function safeHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * Client address for rate limits. `x-forwarded-for` is trusted only behind a proxy that rewrites
 * it (Vercel, or TRUST_PROXY=1); elsewhere a client could rotate it to dodge the limit.
 */
export function clientKey(request: Request, scope: string): string {
  const trusted = Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === '1';
  const ip = trusted
    ? (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown')
    : 'direct';
  return `${scope}:${ip}`;
}

/** Per-account limit on top of the per-address one: 10 sign-in attempts per hour per e-mail. */
export function limitedAccount(scope: string, email: string): Response | null {
  return allow(`${scope}:${email}`, 10, 60 * 60_000)
    ? null
    : jsonError(429, 'rate_limited', 'Too many attempts. Wait a few minutes and try again.');
}

/** 10 attempts per 10 minutes per IP and action. */
export function limited(request: Request, scope: string): Response | null {
  return allow(clientKey(request, scope), 10, 10 * 60_000)
    ? null
    : jsonError(429, 'rate_limited', 'Too many attempts. Wait a few minutes and try again.');
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    const status =
      error.code === 'unavailable'
        ? 503
        : error.code === 'invalid_input'
          ? 400
          : error.code === 'rate_limited'
            ? 429
            : error.code === 'invalid_link'
              ? 400
              : 401;
    return jsonError(status, error.code, error.message);
  }
  console.error('auth: failed', error);
  return jsonError(500, 'internal', 'Something went wrong. Please retry.');
}

export function appUrl(request: Request): string {
  return process.env.APP_URL ?? new URL(request.url).origin;
}
