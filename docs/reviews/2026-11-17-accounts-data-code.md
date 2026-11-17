# Code review — accounts, data path, scripts, map (2026-11-17)

Reviewer: independent code reviewer · Verdict: **CHANGES REQUESTED** (2 blockers, 5 major).
Resolution status is tracked at the end of this file.

## Blockers
- **B1** `components/map/aoi-map.tsx` — `m.isStyleLoaded()` is false while tiles load and `'load'` fires
  once, so a month change during tile loading keeps the previous month's points under the new
  caption. Same for a new area outline. Fix: apply when the sources exist, else defer to load.
- **B2** `server/auth/service.ts` register — re-registering an existing *unverified* e-mail ignored the
  new password and re-sent a link for the old one: account pre-hijack (attacker registers first) or
  permanent lock-out after a mistyped password. Fix: replace hash, drop old tokens and sessions.

## Major
- **M1** register timing differed between new and existing e-mails (SMTP on one path) — enumeration.
- **M2** `scripts/export_cities.py` turned a country's `null` month into `0` for cities (latent; no
  null months today) — breaks "no data is never zero"; rounding to 0.1 also distorts small sums.
- **M3** remote meta derivation made one serial request per region on every cold cache.
- **M4** rate-limit key from client-controlled `x-forwarded-for` outside Vercel; no per-e-mail limit.
- **M5** concurrent registrations of one new e-mail returned 500 (unique violation).

## Minor (selected)
Logout without try/finally; silent sign-out and save failures; no cap on saved places; verify
links built from Host without `APP_URL`; mail scanners consuming one-time links; expired rows never
deleted; non-JSON or schema-invalid API answers mapped to 500; "area too large" as no_coverage; DB
round-trip before every snapshot answer; city map window anchored on the wrong last month; city
cell counts include cross-border cells; unvalidated folder ids in export_geo; migrate-prod.sh
portability and log location; `__pycache__` not ignored; non-atomic snapshot writes; tab pattern and
toggle labels for assistive tech; focus marker kept across areas; failed map fetches cached.

## Verified OK
scrypt parameters and constant-time compare; login does not reveal accounts; tokens hashed and
single-use; cookie flags; CSRF guard on every state-changing route; no open redirect; Drizzle-bound
SQL; migration matches schema; no path traversal; Zod at every boundary; empty-DB fallback; cache
headers; no secrets in the repository.

## Resolution
See the commit "fix: review findings" and the list in the next section once applied.
