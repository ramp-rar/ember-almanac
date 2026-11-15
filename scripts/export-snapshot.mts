/**
 * Export the data team's API into data/snapshot (what the app serves when no live API is set,
 * e.g. on Vercel). Validates every response with the same Zod schemas as the live adapter.
 *
 *   FIRE_API_URL=http://localhost:8000 pnpm snapshot
 *
 * Writes:
 *   data/snapshot/index.json            meta (derived once), regions with names in en/ru/tg
 *   data/snapshot/regions/<id>.json     monthly calendar, forecast and corridor history
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  CalendarRowSchema,
  CorridorRowSchema,
  ForecastRowSchema,
  RegionSchema,
  deriveMeta,
  remoteApiBase,
} from '@/server/repositories/remote-api';

const base = remoteApiBase();
if (!base) throw new Error('Set FIRE_API_URL, e.g. http://localhost:8000');
const OUT = path.join(process.cwd(), 'data', 'snapshot');

async function get<T>(p: string, schema: z.ZodType<T>, optional = false): Promise<T | null> {
  const res = await fetch(`${base}${p}`, { signal: AbortSignal.timeout(120_000) });
  if (optional && res.status === 404) return null;
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return schema.parse(await res.json());
}

/** API ids → ISO 3166-1 alpha-2, for country names in every language (Intl, CLDR). */
const OVERRIDES: Record<string, string | null> = {
  texas: null,
  dem_rep_korea: 'KP',
  republic_of_korea: 'KR',
  lao_pdr: 'LA',
  macedonia_former_yugoslav_republic_of: 'MK',
  republic_of_congo: 'CG',
  swaziland: 'SZ',
  the_gambia: 'GM',
  timor_leste: 'TL',
  czech_republic: 'CZ',
  cote_d_ivoire: 'CI',
  kosovo: 'XK',
  palestine: 'PS',
  bosnia_and_herzegovina: 'BA',
  myanmar: 'MM',
  trinidad_and_tobago: 'TT',
  turkey: 'TR',
};
const MANUAL: Record<string, { en: string; ru: string; tg: string }> = {
  texas: { en: 'Texas (USA)', ru: 'Техас (США)', tg: 'Техас (ИМА)' },
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
const byName = new Map<string, string>();
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    const name = enNames.of(code);
    if (name && name !== code) byName.set(norm(name), code);
  }
}

function namesOf(id: string, apiName: string) {
  if (MANUAL[id]) return MANUAL[id];
  const code = id in OVERRIDES ? OVERRIDES[id] : byName.get(id);
  if (!code) throw new Error(`No ISO code for region "${id}" — add it to OVERRIDES`);
  const of = (l: string) => new Intl.DisplayNames([l], { type: 'region' }).of(code) ?? apiName;
  return { en: of('en'), ru: of('ru'), tg: of('tg'), iso2: code };
}

const regions = (await get('/regions', z.array(RegionSchema.loose())))!;
await mkdir(path.join(OUT, 'regions'), { recursive: true });
const rows = new Map<string, z.infer<typeof CalendarRowSchema>[]>();

for (const r of regions) {
  const id = encodeURIComponent(r.id);
  const calendar = (await get(
    `/regions/${id}/calendar?start_year=2000`,
    z.array(CalendarRowSchema),
  ))!;
  const forecast = await get(`/regions/${id}/forecast`, z.array(ForecastRowSchema), true);
  const anomalies = await get(
    `/regions/${id}/anomalies?only_flagged=false`,
    z.array(CorridorRowSchema.loose()),
    true,
  );
  rows.set(r.id, calendar);
  const slim = {
    calendar: calendar.map(({ month, value, source, partial }) => ({
      month,
      value,
      source,
      partial,
    })),
    forecast,
    anomalies:
      anomalies?.map(({ month, actual, lo80, hi80, lo95, hi95 }) => ({
        month,
        actual,
        lo80,
        hi80,
        lo95,
        hi95,
      })) ?? null,
  };
  await writeFile(path.join(OUT, 'regions', `${r.id}.json`), JSON.stringify(slim));
}

const meta = await deriveMeta(regions, async (id) => rows.get(id) ?? [], 'snapshot');
const index = {
  generated_at: new Date().toISOString().slice(0, 19) + 'Z',
  source: `fire-calendar-api (data team) at ${base}`,
  meta,
  regions: regions.map((r) => ({
    id: r.id,
    name: r.name,
    data_end: r.data_end,
    last_full_month: r.last_full_month,
    first_month: r.first_month,
    bbox: r.bbox,
    hexes_r5: r.hexes_r5,
    group: (r as { group?: string }).group ?? 'world',
    names: namesOf(r.id, r.name),
  })),
};
await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`snapshot: ${regions.length} regions, data through ${meta.nrt_through}`);
