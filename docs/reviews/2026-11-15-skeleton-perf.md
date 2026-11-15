# Phase 1 skeleton — performance check (2026-11-15)

Measured locally on the production build (`next build` + `next start`), mock delivery
`mock-2026-11-15a`, region ZZB. Not yet measured on a Vercel preview (no deployment exists).

| Metric | Budget | Measured | Result |
|---|---|---|---|
| Calendar route first-load JS (gzip) | ≤ 180 KB | 203 KB (brotli: 177 KB) | **FAIL** |
| Map and charts lazy (not in first load) | lazy | not referenced by the initial HTML; 464 KB gzip loaded on demand | PASS |
| Calendar API response size | ≤ 30 KB | 10 KB on the wire (62 KB raw) | PASS |
| Calendar API, warm, local | p95 ≤ 80 ms (CDN) | ~40 ms; first request after start 0.8 s (DuckDB loads the mock delivery) | indicative only |
| No horizontal scroll at 390 px | — | none | PASS |

## First-load JS breakdown (gzip)

| Part | Size |
|---|---|
| React + Next.js 16 runtime | ~174 KB |
| App code (calendar, headline, AOI picker, export) | 15 KB |
| TanStack Query + nuqs (stack in docs/PROJECT_RULES.md) | ~14 KB |

Fixed in this pass: `h3-js` (75 KB) was pulled into the browser through the AOI form;
`lib/h3/aoi-id.ts` now holds the browser-safe part and `lib/h3/aoi.ts` (cells) stays on the server.

## Decision needed (owner)

The framework alone uses ~97% of the 180 KB gzip budget. Options:
1. Raise the budget to 210 KB gzip (or state it in brotli, which Vercel serves: 177 KB) — ADR.
2. Drop nuqs and/or TanStack Query for hand-written equivalents (−14 KB) — changes the decided stack, ADR.
3. Keep the budget and treat this as an open FAIL until measured on a Vercel preview.

Not measured yet: LCP, INP, CLS (Lighthouse / interaction-timing test, F07), API p95 on Vercel with Neon.
