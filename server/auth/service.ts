import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { after } from 'next/server';
import { z } from 'zod';
import { appSession, appUser, emailToken, savedPlace } from '@/db/schema';
import { getDb, isDatabaseConfigured } from '@/server/db/client';
import { DUMMY_HASH, hashPassword, newToken, tokenHash, verifyPassword } from './crypto';
import { mailConfigured, sendMail, verificationMail } from './mail';

/** Account rules, ADR 0005. Every error message is generic: it never reveals which e-mails exist. */
export const SESSION_DAYS = 30;
const VERIFY_HOURS = 24;

export class AuthError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'invalid_credentials'
      | 'unverified'
      | 'invalid_link'
      | 'unavailable'
      | 'rate_limited',
    message: string,
  ) {
    super(message);
  }
}

export const CredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ message: 'Enter a valid e-mail address.' })),
  password: z
    .string()
    .min(10, { message: 'Use at least 10 characters.' })
    .max(200, { message: 'Use at most 200 characters.' }),
  locale: z.enum(['en', 'ru', 'tg']).default('en'),
});
export type Credentials = z.infer<typeof CredentialsSchema>;

let tablesReady: Promise<boolean> | null = null;

/**
 * Accounts are on when a database is configured AND migrated (ADR 0005). Checked once per server
 * instance; a failed check is retried on the next request.
 */
export async function accountsAvailable(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  tablesReady ??= getDb()
    .select({ id: appUser.id })
    .from(appUser)
    .limit(1)
    .then(() => true)
    .catch((error: unknown) => {
      console.error('accounts: tables not available', error);
      tablesReady = null;
      return false;
    });
  return tablesReady;
}

async function requireDb() {
  if (!(await accountsAvailable())) {
    throw new AuthError('unavailable', 'Accounts are not enabled on this deployment.');
  }
  return getDb();
}

/**
 * Creates an unverified account and e-mails the confirmation link. The answer is the same whether
 * the address is new or known, and the e-mail is sent after the response (`after`), so neither the
 * message nor the timing reveals which addresses have accounts.
 *
 * Known but unconfirmed address: with mail on, the new password replaces the old one and old
 * links and sessions are revoked — whoever controls the inbox decides (no pre-registration
 * takeover, no lock-out after a mistyped password). With mail off nobody can prove the inbox,
 * so an existing account is never overwritten.
 */
export async function register(input: Credentials, appUrl: string): Promise<{ mailSent: boolean }> {
  const db = await requireDb();
  const mail = mailConfigured();
  const passwordHash = await hashPassword(input.password);
  const inserted = await db
    .insert(appUser)
    .values({ id: randomUUID(), email: input.email, passwordHash, locale: input.locale })
    .onConflictDoNothing({ target: appUser.email })
    .returning({ id: appUser.id });

  let userId = inserted[0]?.id ?? null;
  if (!userId) {
    const found = (
      await db
        .select({ id: appUser.id, verified: appUser.emailVerifiedAt })
        .from(appUser)
        .where(eq(appUser.email, input.email))
        .limit(1)
    )[0];
    userId = null;
    if (found && !found.verified && mail) {
      await db
        .update(appUser)
        .set({ passwordHash, locale: input.locale })
        .where(eq(appUser.id, found.id));
      await db.delete(emailToken).where(eq(emailToken.userId, found.id));
      await db.delete(appSession).where(eq(appSession.userId, found.id));
      userId = found.id;
    }
  }

  if (userId && mail) {
    const id = userId;
    after(async () => {
      try {
        await sendVerification(id, input.email, input.locale, appUrl);
      } catch (error) {
        // The user can register again to get a new link.
        console.error('register: confirmation e-mail failed', error);
      }
    });
  }
  return { mailSent: mail };
}

async function sendVerification(
  userId: string,
  email: string,
  locale: string,
  appUrl: string,
): Promise<boolean> {
  if (!mailConfigured()) return false;
  const token = newToken();
  await getDb()
    .insert(emailToken)
    .values({
      tokenHash: tokenHash(token),
      userId,
      purpose: 'verify',
      expiresAt: new Date(Date.now() + VERIFY_HOURS * 3600_000),
    });
  const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const mail = verificationMail(locale, link);
  await sendMail(email, mail.subject, mail.text);
  return true;
}

/** Marks the e-mail verified; the link works once and expires. */
export async function verifyEmail(token: string): Promise<void> {
  const db = await requireDb();
  const now = new Date();
  const rows = await db
    .update(emailToken)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailToken.tokenHash, tokenHash(token)),
        eq(emailToken.purpose, 'verify'),
        isNull(emailToken.usedAt),
        gt(emailToken.expiresAt, now),
      ),
    )
    .returning({ userId: emailToken.userId });
  const row = rows[0];
  if (!row) {
    // Mail scanners often open links first: if this link was used and its account is confirmed,
    // the person clicking it now is told so instead of "invalid link".
    const used = await db
      .select({ verified: appUser.emailVerifiedAt })
      .from(emailToken)
      .innerJoin(appUser, eq(appUser.id, emailToken.userId))
      .where(and(eq(emailToken.tokenHash, tokenHash(token)), eq(emailToken.purpose, 'verify')))
      .limit(1);
    if (used[0]?.verified) return;
    throw new AuthError('invalid_link', 'This link is invalid or has expired.');
  }
  await db.update(appUser).set({ emailVerifiedAt: now }).where(eq(appUser.id, row.userId));
}

/** Returns a new session token for the cookie. */
export async function login(input: Credentials): Promise<{ token: string; expiresAt: Date }> {
  const db = await requireDb();
  const rows = await db.select().from(appUser).where(eq(appUser.email, input.email)).limit(1);
  const user = rows[0];
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AuthError('invalid_credentials', 'Wrong e-mail or password.');
  // Without a mail server nobody could ever verify, so verification is required only with mail.
  if (!user.emailVerifiedAt && mailConfigured()) {
    throw new AuthError('unverified', 'Confirm your e-mail first: we sent you a link.');
  }
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(appSession).values({ tokenHash: tokenHash(token), userId: user.id, expiresAt });
  return { token, expiresAt };
}

export async function logout(token: string): Promise<void> {
  if (!(await accountsAvailable())) return;
  await getDb()
    .delete(appSession)
    .where(eq(appSession.tokenHash, tokenHash(token)));
}

export interface Me {
  readonly email: string;
  readonly verified: boolean;
  readonly places: readonly string[];
}

export async function me(token: string | undefined): Promise<Me | null> {
  if (!token || !(await accountsAvailable())) return null;
  const db = getDb();
  const rows = await db
    .select({ id: appUser.id, email: appUser.email, verified: appUser.emailVerifiedAt })
    .from(appSession)
    .innerJoin(appUser, eq(appUser.id, appSession.userId))
    .where(and(eq(appSession.tokenHash, tokenHash(token)), gt(appSession.expiresAt, new Date())))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  const places = await db
    .select({ placeId: savedPlace.placeId })
    .from(savedPlace)
    .where(eq(savedPlace.userId, user.id))
    .orderBy(savedPlace.createdAt);
  return {
    email: user.email,
    verified: user.verified !== null,
    places: places.map((p) => p.placeId),
  };
}

export const PlaceIdSchema = z.string().regex(/^(r:[A-Z][A-Z0-9_]{1,59}|a:[a-z0-9_.-]{3,70})$/);

export async function setPlace(token: string | undefined, placeId: string, saved: boolean) {
  const user = token ? await userIdOf(token) : null;
  if (!user) throw new AuthError('invalid_credentials', 'Sign in first.');
  const db = getDb();
  if (saved) {
    await db.insert(savedPlace).values({ userId: user, placeId }).onConflictDoNothing();
  } else {
    await db
      .delete(savedPlace)
      .where(and(eq(savedPlace.userId, user), eq(savedPlace.placeId, placeId)));
  }
}

async function userIdOf(token: string): Promise<string | null> {
  if (!(await accountsAvailable())) return null;
  const rows = await getDb()
    .select({ userId: appSession.userId })
    .from(appSession)
    .where(and(eq(appSession.tokenHash, tokenHash(token)), gt(appSession.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.userId ?? null;
}

/**
 * Deletes the account and everything tied to it (sessions, e-mail tokens, saved places cascade).
 * Requires the current password, so a stolen session alone cannot erase an account.
 */
export async function deleteAccount(token: string | undefined, password: string): Promise<void> {
  const userId = token ? await userIdOf(token) : null;
  if (!userId) throw new AuthError('invalid_credentials', 'Sign in first.');
  const db = await requireDb();
  const rows = await db
    .select({ hash: appUser.passwordHash })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  if (!rows[0] || !(await verifyPassword(password, rows[0].hash))) {
    throw new AuthError('invalid_credentials', 'Wrong password.');
  }
  await db.delete(appUser).where(eq(appUser.id, userId));
}
