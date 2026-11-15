'use client';

import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CalendarResponse } from '@/lib/api/types';
import type { CalendarCell } from '@/lib/domain/calendar';
import { MONTHS_SHORT, STATUS_LABEL, fmt, monthLong } from '@/lib/format';
import { cellLook, rawTotal, type Mode, type PaletteName } from './palette';

const CW = 30;
const CH = 18;
const GAP = 2;
const LEFT = 56;
const TOP = 20;
const BAR_GAP = 10;
const BAR_W = 70;
const BAR_TEXT = 46;
const MED_GAP = 8;
const MED_H = 34;

export interface CalendarProps {
  readonly data: CalendarResponse;
  readonly mode: Mode;
  readonly palette: PaletteName;
  readonly newestFirst: boolean;
  readonly selected: { y: number; m: number } | null;
  readonly onSelect: (y: number, m: number) => void;
}

export function cellLabel(c: CalendarCell): string {
  const when = `${monthLong(c.m)} ${c.y}`;
  if (c.s === 'future') return `${when}: not yet observed`;
  if (c.s === 'no_data' || c.h === null) return `${when}: no data`;
  const parts = [`${when}: ${fmt(c.h)} harmonized fire-days`, STATUS_LABEL[c.s]];
  if (c.cov[0] < c.cov[1]) parts.push(`${c.cov[0]} of ${c.cov[1]} days observed`);
  if (c.r.v !== null) parts.push(`${c.r.v.toFixed(1)} times the median`);
  else if (c.r.note) parts.push(c.r.note);
  return parts.join(', ');
}

function Patterns() {
  return (
    <defs>
      <pattern
        id="ft-hatch"
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" />
      </pattern>
      <pattern id="ft-nodata" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#2a2f36" />
        <path d="M0 0L6 6M6 0L0 6" stroke="#4b535d" strokeWidth="0.8" />
      </pattern>
    </defs>
  );
}

interface LayerProps {
  readonly cells: readonly CalendarCell[];
  readonly years: readonly number[];
  readonly mode: Mode;
  readonly palette: PaletteName;
  readonly breaks: CalendarResponse['calendar']['breaks'];
}

/** All 324 cells. Memoised: hover, focus and selection never re-render it. */
const CellsLayer = memo(function CellsLayer({ cells, years, mode, palette, breaks }: LayerProps) {
  return (
    <>
      {years.map((y, row) => (
        <g key={y} role="row" aria-label={String(y)}>
          {cells
            .filter((c) => c.y === y)
            .map((c) => {
              const x = LEFT + (c.m - 1) * (CW + GAP);
              const top = TOP + row * (CH + GAP);
              const look = cellLook(c, mode, breaks, palette);
              const fill =
                look.kind === 'colour'
                  ? look.fill
                  : look.kind === 'no_data'
                    ? 'url(#ft-nodata)'
                    : look.kind === 'no_ratio'
                      ? '#14181d'
                      : 'transparent';
              const stroke =
                look.kind === 'future'
                  ? '#3a424c'
                  : look.kind === 'no_ratio'
                    ? '#4b535d'
                    : undefined;
              return (
                <g
                  key={c.m}
                  role="gridcell"
                  id={`cell-${c.y}-${c.m}`}
                  aria-label={cellLabel(c)}
                  data-y={c.y}
                  data-m={c.m}
                >
                  <rect
                    x={x}
                    y={top}
                    width={CW}
                    height={CH}
                    rx={2}
                    fill={fill}
                    stroke={stroke}
                    strokeDasharray={look.kind === 'no_ratio' ? '2 2' : undefined}
                  />
                  {c.s === 'preliminary' && look.kind !== 'no_data' && (
                    <rect
                      x={x}
                      y={top}
                      width={CW}
                      height={CH}
                      rx={2}
                      fill="url(#ft-hatch)"
                      pointerEvents="none"
                    />
                  )}
                  {c.s === 'estimate' && (
                    <line
                      x1={x + 3}
                      x2={x + CW - 3}
                      y1={top + CH - 2.5}
                      y2={top + CH - 2.5}
                      stroke="#ffffff"
                      strokeOpacity="0.75"
                      strokeDasharray="1 2"
                      pointerEvents="none"
                    />
                  )}
                  {c.h !== null && c.cov[0] < c.cov[1] && (
                    <path
                      d={`M${x + CW - 8} ${top} h6 a2 2 0 0 1 2 2 v6 z`}
                      fill="#e6eaef"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
        </g>
      ))}
    </>
  );
});

export function BurningCalendar({
  data,
  mode,
  palette,
  newestFirst,
  selected,
  onSelect,
}: CalendarProps) {
  const { calendar, dataset } = data;
  const years = useMemo(() => {
    const ys = calendar.yearTotals.map((t) => t.y);
    return newestFirst ? [...ys].reverse() : ys;
  }, [calendar.yearTotals, newestFirst]);
  const rowOf = useMemo(() => new Map(years.map((y, i) => [y, i])), [years]);
  const cellAt = useMemo(
    () => new Map(calendar.cells.map((c) => [`${c.y}-${c.m}`, c])),
    [calendar.cells],
  );

  const gridW = 12 * (CW + GAP) - GAP;
  const gridH = years.length * (CH + GAP) - GAP;
  const width = LEFT + gridW + BAR_GAP + BAR_W + BAR_TEXT;
  const height = TOP + gridH + MED_GAP + MED_H + 16;

  const [hover, setHover] = useState<CalendarCell | null>(null);
  const [active, setActive] = useState<{ y: number; m: number } | null>(selected);
  const [focused, setFocused] = useState(false);
  const overlay = useRef<SVGRectElement>(null);

  const place = (y: number, m: number) => ({
    x: LEFT + (m - 1) * (CW + GAP),
    y: TOP + (rowOf.get(y) ?? 0) * (CH + GAP),
  });

  const moveOverlay = useCallback(
    (c: CalendarCell | null) => {
      const el = overlay.current;
      if (!el) return;
      if (!c) {
        el.setAttribute('visibility', 'hidden');
        return;
      }
      const x = LEFT + (c.m - 1) * (CW + GAP);
      const y = TOP + (rowOf.get(c.y) ?? 0) * (CH + GAP);
      el.setAttribute('transform', `translate(${x} ${y})`);
      el.setAttribute('visibility', 'visible');
    },
    [rowOf],
  );

  const cellFromEvent = (target: EventTarget | null): CalendarCell | null => {
    const g = (target as Element | null)?.closest?.('[data-y]');
    if (!g) return null;
    return cellAt.get(`${g.getAttribute('data-y')}-${g.getAttribute('data-m')}`) ?? null;
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const cur = active ?? selected ?? { y: years[0]!, m: 1 };
    let { y, m } = cur;
    const row = rowOf.get(y) ?? 0;
    switch (e.key) {
      case 'ArrowLeft':
        m = Math.max(1, m - 1);
        break;
      case 'ArrowRight':
        m = Math.min(12, m + 1);
        break;
      case 'ArrowUp':
        y = years[Math.max(0, row - 1)]!;
        break;
      case 'ArrowDown':
        y = years[Math.min(years.length - 1, row + 1)]!;
        break;
      case 'Home':
        m = 1;
        break;
      case 'End':
        m = 12;
        break;
      case 'Enter':
      case ' ':
        onSelect(y, m);
        e.preventDefault();
        return;
      default:
        return;
    }
    e.preventDefault();
    setActive({ y, m });
    const c = cellAt.get(`${y}-${m}`) ?? null;
    moveOverlay(c);
    setHover(c);
  };

  // Right margin: year totals. Bottom margin: month medians.
  const totalOf = (t: (typeof calendar.yearTotals)[number]) => (mode === 'raw' ? t.raw : t.harm);
  const maxTotal = Math.max(1, ...calendar.yearTotals.map((t) => totalOf(t).v ?? 0));
  const maxMedian = Math.max(1, ...calendar.monthMedians.map((x) => x.harm.v ?? 0));

  const eraMarkers = Object.entries(dataset.coverage)
    .filter(([platform]) => platform !== 'MODIS')
    .flatMap(([platform, c]) => [
      { date: c.start, label: `${platform.replace('VIIRS_', '')} start` },
      ...(c.end ? [{ date: c.end, label: `${platform.replace('VIIRS_', '')} end` }] : []),
    ])
    .filter((mk) => rowOf.has(Number(mk.date.slice(0, 4))));

  const tooltipCell = hover;
  const tipPos = tooltipCell ? place(tooltipCell.y, tooltipCell.m) : null;
  const activeId = active ? `cell-${active.y}-${active.m}` : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-manipulation outline-none select-none"
        role="grid"
        aria-label={`Burning calendar of ${data.aoi.label}: rows are years, columns are months. Use arrow keys to move and Enter to select a month.`}
        aria-activedescendant={focused ? activeId : undefined}
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => {
          setFocused(true);
          const start = active ?? selected;
          if (start) {
            setActive(start);
            moveOverlay(cellAt.get(`${start.y}-${start.m}`) ?? null);
          }
        }}
        onBlur={() => {
          setFocused(false);
          moveOverlay(null);
          setHover(null);
        }}
        onPointerMove={(e) => {
          const c = cellFromEvent(e.target);
          if (c?.y === hover?.y && c?.m === hover?.m) return;
          moveOverlay(c);
          setHover(c);
        }}
        onPointerLeave={() => {
          if (!focused) moveOverlay(null);
          setHover(null);
        }}
        onClick={(e) => {
          const c = cellFromEvent(e.target);
          if (c) {
            setActive({ y: c.y, m: c.m });
            onSelect(c.y, c.m);
          }
        }}
      >
        <Patterns />
        {/* month labels */}
        {MONTHS_SHORT.map((label, i) => (
          <text
            key={label}
            x={LEFT + i * (CW + GAP) + CW / 2}
            y={TOP - 7}
            textAnchor="middle"
            className="fill-[var(--color-muted)] font-mono text-[9px]"
          >
            {label}
          </text>
        ))}
        {/* sensor-era rail */}
        {years.map((y) => {
          const row = rowOf.get(y)!;
          const modisOnly = y < dataset.estimateBeforeYear;
          return (
            <g key={y}>
              <rect
                x={2}
                y={TOP + row * (CH + GAP)}
                width={4}
                height={CH + GAP}
                fill={modisOnly ? '#4b535d' : '#ff6a2b'}
                fillOpacity={modisOnly ? 1 : 0.7}
              />
              <text
                x={LEFT - 8}
                y={TOP + row * (CH + GAP) + CH / 2 + 3}
                textAnchor="end"
                className="fill-[var(--color-text)] font-mono text-[9.5px]"
              >
                {y}
              </text>
            </g>
          );
        })}
        {eraMarkers.map((mk) => {
          const y = Number(mk.date.slice(0, 4));
          const m = Number(mk.date.slice(5, 7));
          const top = TOP + rowOf.get(y)! * (CH + GAP) + ((m - 1) / 12) * (CH + GAP);
          return (
            <g key={mk.label}>
              <title>{`${mk.label}: ${mk.date}`}</title>
              <path d={`M7 ${top} l5 -3 v6 z`} fill="#e6eaef" />
            </g>
          );
        })}

        <CellsLayer
          cells={calendar.cells}
          years={years}
          mode={mode}
          palette={palette}
          breaks={calendar.breaks}
        />

        {/* selection, hover/focus overlay */}
        {selected && rowOf.has(selected.y) && (
          <rect
            {...place(selected.y, selected.m)}
            width={CW}
            height={CH}
            rx={2}
            fill="none"
            stroke="#ff6a2b"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
        <rect
          ref={overlay}
          width={CW}
          height={CH}
          rx={2}
          fill="none"
          stroke="#ffffff"
          strokeWidth={focused ? 2 : 1.4}
          visibility="hidden"
          pointerEvents="none"
        />

        {/* year totals */}
        {calendar.yearTotals.map((t) => {
          const row = rowOf.get(t.y)!;
          const v = totalOf(t);
          const top = TOP + row * (CH + GAP);
          const x0 = LEFT + gridW + BAR_GAP;
          const w = v.v === null ? 0 : Math.max(1, (v.v / maxTotal) * BAR_W);
          return (
            <g key={t.y}>
              <title>{`${t.y} total: ${v.v === null ? `— (${v.note ?? STATUS_LABEL[v.s]})` : fmt(v.v)}, ${STATUS_LABEL[v.s]}`}</title>
              {v.v === null ? (
                <rect
                  x={x0}
                  y={top + 3}
                  width={BAR_W}
                  height={CH - 6}
                  fill="url(#ft-nodata)"
                  opacity={0.5}
                />
              ) : (
                <>
                  <rect x={x0} y={top + 3} width={w} height={CH - 6} fill="#8b96a3" />
                  {v.s === 'preliminary' && (
                    <rect x={x0} y={top + 3} width={w} height={CH - 6} fill="url(#ft-hatch)" />
                  )}
                </>
              )}
              <text
                x={x0 + BAR_W + 4}
                y={top + CH / 2 + 3}
                className="fill-[var(--color-muted)] font-mono text-[9px]"
              >
                {v.v === null ? '—' : fmt(v.v)}
              </text>
            </g>
          );
        })}
        <text
          x={LEFT + gridW + BAR_GAP}
          y={TOP - 7}
          className="fill-[var(--color-muted)] font-mono text-[9px]"
        >
          {mode === 'raw' ? 'year total (raw)' : 'year total'}
        </text>

        {/* month medians */}
        {calendar.monthMedians.map((md) => {
          const x = LEFT + (md.m - 1) * (CW + GAP);
          const base = TOP + gridH + MED_GAP + MED_H;
          const h = md.harm.v === null ? 0 : Math.max(1, (md.harm.v / maxMedian) * (MED_H - 10));
          return (
            <g key={md.m}>
              <title>{`${monthLong(md.m)} median: ${md.harm.v === null ? `— (${md.harm.note ?? ''})` : fmt(md.harm.v)} (n = ${md.n}, ${STATUS_LABEL[md.harm.s]})`}</title>
              {md.harm.v === null ? (
                <rect x={x + 4} y={base - 6} width={CW - 8} height={6} fill="url(#ft-nodata)" />
              ) : (
                <rect x={x + 4} y={base - h} width={CW - 8} height={h} fill="#8b96a3" />
              )}
              <text
                x={x + CW / 2}
                y={base + 11}
                textAnchor="middle"
                className="fill-[var(--color-muted)] font-mono text-[8px]"
              >
                {fmt(md.harm.v)}
              </text>
            </g>
          );
        })}
        <text
          x={LEFT - 8}
          y={TOP + gridH + MED_GAP + MED_H - 2}
          textAnchor="end"
          className="fill-[var(--color-muted)] font-mono text-[8.5px]"
        >
          {mode === 'raw' ? 'harm. median' : 'median'}
        </text>
      </svg>

      {tooltipCell && tipPos && (
        <CellTooltip
          cell={tooltipCell}
          leftPct={((tipPos.x + CW) / width) * 100}
          topPct={((tipPos.y + CH) / height) * 100}
        />
      )}
    </div>
  );
}

function CellTooltip({
  cell: c,
  leftPct,
  topPct,
}: {
  cell: CalendarCell;
  leftPct: number;
  topPct: number;
}) {
  const raw = rawTotal(c);
  return (
    <div
      role="tooltip"
      className="border-line bg-panel pointer-events-none absolute z-10 w-60 rounded-md border p-3 text-xs shadow-xl"
      style={{
        left: `min(${leftPct}%, calc(100% - 15rem))`,
        top: `${topPct}%`,
      }}
    >
      <p className="font-display text-sm font-medium">
        {monthLong(c.m)} {c.y}
      </p>
      <p className="mt-1 font-mono">
        <span className="text-muted">status </span>
        {STATUS_LABEL[c.s]}
        {c.cov[0] < c.cov[1] && c.h !== null && (
          <span className="text-muted">
            {' '}
            · {c.cov[0]} of {c.cov[1]} days
          </span>
        )}
      </p>
      {c.h !== null ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono">
          <dt className="text-muted">harmonized</dt>
          <dd>
            {fmt(c.h)}{' '}
            <span className="text-muted">
              ({fmt(c.lo)}–{fmt(c.hi)})
            </span>
          </dd>
          <dt className="text-muted">vs median</dt>
          <dd>
            {c.r.v !== null ? `×${c.r.v.toFixed(1)}` : (c.r.note ?? '—')}
            {c.r.v !== null && <span className="text-muted"> · n {c.r.n}</span>}
          </dd>
          <dt className="text-muted">raw MODIS</dt>
          <dd>{fmt(c.rm)}</dd>
          <dt className="text-muted">raw VIIRS</dt>
          <dd>{fmt(c.rv)}</dd>
          <dt className="text-muted">raw total</dt>
          <dd>{fmt(raw)}</dd>
        </dl>
      ) : (
        <p className="text-muted mt-2">
          {c.s === 'future' ? 'Not yet observed.' : 'No observations — not zero.'}
        </p>
      )}
    </div>
  );
}
