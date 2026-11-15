import { RATIO_LIMITS, VALUE_CLASSES } from '@/lib/domain/calendar';
import { STATUS_HELP, STATUS_LABEL, fmt } from '@/lib/format';
import { DIVERGING, SEQUENTIAL, type Mode, type PaletteName } from './palette';

function Swatch({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="26" height="16" aria-hidden="true" className="shrink-0">
        {children}
      </svg>
      <span>{label}</span>
    </li>
  );
}

const PATTERNS = (
  <defs>
    <pattern
      id="lg-hatch"
      width="5"
      height="5"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" />
    </pattern>
    <pattern id="lg-nodata" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" style={{ fill: 'var(--t-nodata-bg)' }} />
      <path d="M0 0L6 6M6 0L0 6" style={{ stroke: 'var(--t-nodata-line)' }} strokeWidth="0.8" />
    </pattern>
  </defs>
);

export function Legend({
  mode,
  palette,
  breaks,
  estimateBeforeYear,
}: {
  estimateBeforeYear: number;
  mode: Mode;
  palette: PaletteName;
  breaks: readonly number[];
}) {
  const colours = SEQUENTIAL[palette];
  const valueLabels: string[] = ['0'];
  if (breaks.length > 0) {
    valueLabels.push(`> 0 – ${fmt(breaks[0]!)}`);
    for (let i = 1; i < breaks.length; i++)
      valueLabels.push(`${fmt(breaks[i - 1]!)} – ${fmt(breaks[i]!)}`);
    valueLabels.push(`> ${fmt(breaks[breaks.length - 1]!)}`);
  }
  const ratioLabels = [
    `≤ ×${RATIO_LIMITS[0]}`,
    ...RATIO_LIMITS.slice(0, -1).map((l, i) => `×${l} – ${RATIO_LIMITS[i + 1]}`),
    `≥ ×${RATIO_LIMITS[RATIO_LIMITS.length - 1]}`,
  ];

  return (
    <div className="grid gap-4 text-xs sm:grid-cols-2" aria-label="Legend">
      <div>
        <p className="text-muted mb-2 font-mono tracking-wide uppercase">
          {mode === 'ratio'
            ? 'ratio to median of the same month'
            : mode === 'harm'
              ? 'harmonized fire-days (classes of this area — compare areas by numbers, not colours)'
              : 'raw detections, MODIS + VIIRS (classes of this area)'}
        </p>
        <ul className="grid grid-cols-2 gap-1.5 font-mono">
          {mode === 'ratio'
            ? DIVERGING.map((c, i) => (
                <Swatch key={c} label={ratioLabels[i]!}>
                  <rect width="26" height="16" rx="2" fill={c} />
                </Swatch>
              ))
            : valueLabels.slice(0, VALUE_CLASSES).map((label, i) => (
                <Swatch key={label} label={label}>
                  <rect width="26" height="16" rx="2" fill={colours[i]} />
                </Swatch>
              ))}
          {mode === 'ratio' && (
            <Swatch label="no ratio (see tooltip)">
              <rect
                x="0.5"
                y="0.5"
                width="25"
                height="15"
                rx="2"
                style={{ fill: 'var(--t-no-ratio)', stroke: 'var(--t-nodata-line)' }}
                strokeDasharray="2 2"
              />
            </Swatch>
          )}
        </ul>
        {mode === 'raw' && (
          <p className="text-muted mt-2">
            Raw counts jump when VIIRS starts ({estimateBeforeYear}) because the sensor sees more,
            not because more burned. Use harmonized values to compare years.
          </p>
        )}
      </div>
      <div>
        <p className="text-muted mb-2 font-mono tracking-wide uppercase">data status</p>
        <ul className="grid gap-1.5">
          <Swatch label={`${STATUS_LABEL.final} — ${STATUS_HELP.final}`}>
            <rect width="26" height="16" rx="2" fill={colours[4]} />
          </Swatch>
          <Swatch label={`${STATUS_LABEL.estimate} — ${STATUS_HELP.estimate}`}>
            <rect width="26" height="16" rx="2" fill={colours[4]} />
            <line
              x1="3"
              x2="23"
              y1="13.5"
              y2="13.5"
              stroke="#fff"
              strokeOpacity="0.75"
              strokeDasharray="1 2"
            />
          </Swatch>
          <Swatch label={`${STATUS_LABEL.preliminary} — ${STATUS_HELP.preliminary}`}>
            {PATTERNS}
            <rect width="26" height="16" rx="2" fill={colours[4]} />
            <rect width="26" height="16" rx="2" fill="url(#lg-hatch)" />
          </Swatch>
          <Swatch label={`${STATUS_LABEL.no_data} — ${STATUS_HELP.no_data}`}>
            <rect width="26" height="16" rx="2" fill="url(#lg-nodata)" />
          </Swatch>
          <Swatch label={`${STATUS_LABEL.future} — ${STATUS_HELP.future}`}>
            <rect
              x="0.5"
              y="0.5"
              width="25"
              height="15"
              rx="2"
              fill="none"
              style={{ stroke: 'var(--t-future-line)' }}
            />
          </Swatch>
          <Swatch label="partly observed month — no ratio, not comparable with full months">
            <rect width="26" height="16" rx="2" fill={colours[3]} />
            <path d="M18 0 h6 a2 2 0 0 1 2 2 v6 z" fill="#ffffff" />
          </Swatch>
        </ul>
      </div>
    </div>
  );
}
