import { describe, expect, it } from 'vitest';
import {
  DUMMY_HASH,
  hashPassword,
  newToken,
  tokenHash,
  verifyPassword,
} from '@/server/auth/crypto';
import { allow, resetLimits } from '@/server/auth/rate-limit';
import { CredentialsSchema, PlaceIdSchema } from '@/server/auth/service';

describe('passwords', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse batterY', a)).toBe(false);
  });

  it('rejects malformed hashes and never matches the dummy hash', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
    expect(await verifyPassword('anything at all', DUMMY_HASH)).toBe(false);
  });
});

describe('tokens', () => {
  it('are long, URL-safe and stored only as SHA-256', () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash(t)).not.toContain(t);
    expect(newToken()).not.toBe(t);
  });
});

describe('rate limit', () => {
  it('allows `limit` attempts per window, then refuses until it resets', () => {
    resetLimits();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow('login:1.2.3.4', 3, 60_000, now)).toBe(true);
    expect(allow('login:1.2.3.4', 3, 60_000, now + 1)).toBe(false);
    expect(allow('login:5.6.7.8', 3, 60_000, now + 1)).toBe(true);
    expect(allow('login:1.2.3.4', 3, 60_000, now + 60_000)).toBe(true);
  });
});

describe('input validation', () => {
  it('normalises e-mail and enforces the password length', () => {
    const ok = CredentialsSchema.parse({ email: '  Ali@Example.ORG ', password: '0123456789' });
    expect(ok).toMatchObject({ email: 'ali@example.org', locale: 'en' });
    expect(
      CredentialsSchema.safeParse({ email: 'not-an-email', password: '0123456789' }).success,
    ).toBe(false);
    expect(CredentialsSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(
      CredentialsSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(201) }).success,
    ).toBe(false);
  });

  it('accepts only region or area ids as places', () => {
    expect(PlaceIdSchema.safeParse('r:TAJIKISTAN').success).toBe(true);
    expect(PlaceIdSchema.safeParse('a:pt_48_68_100').success).toBe(true);
    for (const bad of ['../etc/passwd', 'r:tajikistan', '<script>', 'x:ABC', '']) {
      expect(PlaceIdSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});
