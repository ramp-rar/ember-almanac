# 0003. First-load JS budget: 210 KB gzip
Date: 2026-11-15 · Status: accepted (owner decision)

## Context
perf-budget set the calendar route's first-load JS at ≤ 180 KB gzip. Measured on the production
build (docs/reviews/2026-11-15-skeleton-perf.md): 203 KB gzip, of which ~174 KB is the React +
Next.js 16 runtime alone, 15 KB app code and ~14 KB TanStack Query + nuqs (decided stack).
Brotli, which Vercel serves, gives 177 KB.

## Options
1. Raise the budget to 210 KB gzip — keeps the decided stack; ~7 KB headroom for app code.
2. Drop nuqs / TanStack Query for hand-written code (−14 KB) — changes the stack, more code to own.
3. Keep 180 KB and leave the gate failing.

## Decision
Option 1, decided by the project owner ("if more is needed, take more"). MapLibre and ECharts
stay lazy and outside this budget.

## Consequences
Any new client dependency on the calendar route must fit in the remaining headroom or be lazy.
Revisit if Next.js runtime size changes, or when measured on a real Vercel deployment.
