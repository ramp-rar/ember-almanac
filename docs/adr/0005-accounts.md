# ADR 0005 — Accounts: e-mail + password, saved places

Status: accepted (owner decision, 2026-11-16) · Overrides the "no login" line of PROJECT_RULES.md "Do not".

## Context
The owner asked for sign-in so people can keep the places they follow. The product must stay
usable without an account, and nothing about fire data depends on who is signed in.

## Decision
- Own implementation on the existing stack (Postgres + Drizzle, Next.js route handlers); no third-party
  identity provider, so no personal data leaves our database.
- Passwords: scrypt (N=2^15, r=8, p=1, 16-byte salt), format `scrypt$N$r$p$salt$hash` so parameters can
  grow. Unknown e-mails do the same scrypt work (dummy hash): timing and messages do not reveal accounts.
- Sessions: 32-byte random token in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie for 30 days;
  only its SHA-256 is stored, so a database leak exposes no live session. Logout deletes the row.
- E-mail confirmation: single-use 24-hour token (SHA-256 stored), sent by SMTP (`MAIL_URL`; Mailpit locally).
  If sending fails, the new account is removed and the user is asked to retry. Without `MAIL_URL`,
  confirmation is not required (nobody could receive it).
- CSRF: state-changing routes accept JSON only and compare `Origin` with the request `Host`.
- Brute force: 10 attempts per 10 minutes per IP and action (in-memory per instance; a shared store such as
  Redis is the next step for many serverless instances).
- Redirects after confirmation are relative, so the browser stays on the host it used.
- Accounts are enabled only when `DATABASE_URL` is set; otherwise the UI hides sign-in entirely.

## Consequences
Local: `docker compose up -d db mailpit`, `pnpm db:migrate`. Vercel: add a Postgres (e.g. Neon) and an SMTP
provider, set `DATABASE_URL`, `MAIL_URL`, `MAIL_FROM`, `APP_URL`, run the migration. Password reset is not
built yet (next step, same token table with purpose `reset`).
