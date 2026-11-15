import { MIN_BASELINE_YEARS } from '@/lib/domain/baseline';
import type { CalendarCell, CalendarData } from '@/lib/domain/calendar';
import { MIN_MANN_KENDALL_N } from '@/lib/domain/stats';
import type { I18n } from './use-locale';

/**
 * Localized scientific sentences, built from the structured values the domain computed
 * (kind, n, baseline years, p), so every language says exactly what the statistics support.
 */

export function pText(p: number | null, i: I18n): string {
  if (p === null) return i.t.trend.pNone;
  if (p < 0.001) return 'p < 0.001';
  const s = String(Number(p.toPrecision(2)));
  return `p = ${i.locale === 'en' ? s : s.replace('.', ',')}`;
}

/** "×1.2" with one decimal, in the locale's decimal separator. */
export function times(v: number, i: I18n): string {
  const s = v.toFixed(1);
  return `×${i.locale === 'en' ? s : s.replace('.', ',')}`;
}

export function ratioText(c: CalendarCell, i: I18n): string {
  const h = i.t.headline;
  switch (c.r.k) {
    case 'target_unavailable':
      return c.s === 'future' ? h.notYet : h.noData;
    case 'insufficient_baseline':
      return h.insufficient(c.r.n, MIN_BASELINE_YEARS);
    case 'no_usual_activity':
      return h.noUsual;
    case 'partial_month':
      return h.partial(c.cov[0], c.cov[1]);
    case 'ratio': {
      const [from, to] = c.r.by ?? [0, 0];
      const x = times(c.r.v ?? 0, i);
      const month = i.locale === 'en' ? i.month(c.m) : i.month(c.m).toLowerCase();
      const base = h.ratio(x, c.r.n, month, from, to);
      return c.s === 'preliminary' ? base + h.prelim : base;
    }
  }
}

export function trendText(series: CalendarData['series'], i: I18n): string {
  const t = series.trend;
  const tr = i.t.trend;
  if (!t) return tr.notEnough(series.mk?.n ?? 0, MIN_MANN_KENDALL_N);
  const p = pText(t.p, i);
  if (!t.significant) return tr.none(p, t.n, t.from, t.to);
  return t.slope > 0 ? tr.up(p, t.n, t.from, t.to) : tr.down(p, t.n, t.from, t.to);
}

export function cellLabelText(c: CalendarCell, i: I18n): string {
  const k = i.t.calendar;
  const when = `${i.month(c.m)} ${c.y}`;
  if (c.s === 'future') return `${when}: ${k.cellNotYet}`;
  if (c.s === 'no_data' || c.h === null) return `${when}: ${k.cellNoData}`;
  const parts = [`${when}: ${k.cellHarm(i.n(c.h))}`, i.t.status.label[c.s]];
  if (c.cov[0] < c.cov[1]) parts.push(k.cellDays(c.cov[0], c.cov[1]));
  if (c.r.v !== null) parts.push(k.cellTimes(times(c.r.v, i)));
  else if (c.r.k !== 'ratio') parts.push(ratioText(c, i));
  return parts.join(', ');
}
