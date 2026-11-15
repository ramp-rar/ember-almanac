/**
 * All user-facing copy in three languages. `en` defines the shape; `ru` and `tg` must match it
 * exactly (enforced by the `Messages` type), so a missing translation is a compile error.
 * Scientific sentences are built from structured values here, never by translating English text.
 * Numbers arrive already formatted for the locale.
 */

export const LOCALES = ['en', 'ru', 'tg'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAME: Record<Locale, string> = { en: 'English', ru: 'Русский', tg: 'Тоҷикӣ' };
export const LOCALE_SHORT: Record<Locale, string> = { en: 'EN', ru: 'RU', tg: 'TJ' };

type S = string;
type Status = 'final' | 'estimate' | 'preliminary' | 'no_data' | 'future';

const en = {
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  monthsLong: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  nav: {
    skip: 'Skip to content',
    how: 'How it works',
    glossary: 'Glossary',
    theme: 'Colour theme',
    light: 'Light',
    dark: 'Dark',
    auto: 'Auto',
    autoTitle: 'Follow the device setting',
    themeTitle: (name: S) => `${name} theme`,
    language: 'Language',
    sections: 'Sections',
    tagline: 'Did Earth burn more — or did our satellites just get better at seeing it?',
  },
  banner: {
    mockText:
      'These are generated test numbers, not real fires. Real NASA FIRMS data will replace them.',
    line: (v: S, sp: S, nrt: S) => `dataset ${v} · checked data to ${sp} · quick data to ${nrt}`,
  },
  status: {
    title: {
      final: 'Checked',
      estimate: 'Estimate (older satellite)',
      preliminary: 'Preliminary',
      no_data: 'No data',
      future: 'Not yet',
    } satisfies Record<Status, S>,
    label: {
      final: 'final',
      estimate: 'estimate',
      preliminary: 'preliminary',
      no_data: 'no data',
      future: 'not yet observed',
    } satisfies Record<Status, S>,
    help: {
      final: 'checked data: NASA has finished standard processing, it will not change.',
      estimate:
        'before the newer VIIRS satellite, only MODIS saw fires; its counts are scaled to VIIRS units. Close, but less certain.',
      preliminary:
        'quick (near real-time) data. NASA re-checks it a few months later, so the number may still change a little.',
      no_data: 'no satellite observations. This is not zero: we simply do not know.',
      future: 'this month has not happened yet.',
    } satisfies Record<Status, S>,
  },
  explorer: {
    kindRegion: 'country / region',
    kindAoi: 'custom area',
    area: (km2: S) => `${km2} km²`,
    cells: (n: S) => `${n} map cells`,
    coarse: ' (coarser grid: the area is very large)',
    intro:
      'Satellites have watched fires since 2000. Two different satellites counted differently, so we put them on one scale. Pick a place, then click a month to compare it with a usual one.',
    selectedMonth: 'Selected month',
    calTitle: 'Burning calendar',
    calDesc:
      'Each row is a year, each column a month. The brighter the square, the more fire activity. Click any square.',
    colourBy: 'Colour by',
    modes: { harm: 'Harmonized fire-days', raw: 'Raw detections', ratio: 'Ratio to median' },
    modeHelp: {
      harm: 'Both satellites on one scale: the fair way to compare years.',
      raw: 'Plain satellite counts. They jump when the newer satellite starts, so do not compare years with this.',
      ratio: 'How this month compares with the usual one: blue is quieter, orange is busier.',
    },
    colours: (warm: boolean) => `colours: ${warm ? 'warm' : 'blue–yellow'}`,
    colourAria: (p: S) => `Colour scale: ${p}. Switch scale.`,
    newestFirst: 'newest first',
    oldestFirst: 'oldest first',
    empty:
      'No fire observations in this area. Observed months are shown as 0; months without observations are hatched.',
    mapTitle: 'Where is it?',
    mapDesc:
      'Real satellite picture with relief: forests, fields and mountains are visible. Drag to rotate, scroll to zoom.',
    trendTitle: 'Is it getting worse over the years?',
    slope: (s: S, from: number, to: number) =>
      `Slope (Theil–Sen): ${s} fire-days per year over complete years ${from}–${to}`,
    slopeEstimates: (e: number, n: number) =>
      `; includes ${e} older-satellite estimate years of ${n}`,
    checkedOnly: (from: number, to: number, n: number, s: S, p: S) =>
      `Checked years only (${from}–${to}, n = ${n}): ${s} fire-days per year, Mann–Kendall ${p}.`,
    checkedTooFew: 'Too few checked years for a separate test.',
    chartsNote:
      'Shaded columns are incomplete years without a total; hatched years are preliminary. Neither is in the trend. Significance level 0.05.',
    howTitle: 'How it works',
    how: [
      [
        '1. Two satellites, one scale.',
        'MODIS (since 2000) and VIIRS (since 2012) see fires differently. We convert both to one unit so years are comparable.',
      ],
      [
        '2. Compared with a usual month.',
        '“×1.2” means 20% more fire activity than the middle (median) of the same month in other years.',
      ],
      [
        '3. We say how sure we are.',
        'Every number is marked checked, estimate, preliminary or no data. No data is never shown as zero.',
      ],
    ] as [S, S][],
    glossaryTitle: 'Glossary',
    glossary: [
      [
        'Fire-day',
        'One map cell (about 1 km) with fire seen on one day. A measure of activity, not burnt area or number of fires.',
      ],
      [
        'MODIS / VIIRS',
        'Two satellite instruments. VIIRS is newer and sharper, so it sees more small fires.',
      ],
      [
        'Median',
        'The middle value: half of the years had more, half less. One extreme year does not distort it.',
      ],
      ['Preliminary', 'Quick data that NASA re-checks a few months later; it may change slightly.'],
      ['Estimate', 'Years before VIIRS: MODIS counts scaled to VIIRS units. Less certain.'],
      [
        'P74',
        'Percentile: this month had more activity than 74% of the same months in other years.',
      ],
    ] as [S, S][],
    method: (m: S, from: number, to: number, sp: S, nrt: S) =>
      `Method: ${m}. Usual month = median of ${from}–${to}. Checked data through ${sp}; quick data through ${nrt}.`,
    loadError: 'Could not load the calendar.',
    retry: 'Retry',
    noRegions: 'No regions are loaded yet.',
    loading: 'Loading the calendar',
  },
  headline: {
    pick: 'Click a month in the calendar to see how it compares.',
    ratio: (x: S, n: number, month: S, from: number, to: number) =>
      `${x} vs median of ${n} ${month}s (${from}–${to})`,
    prelim: ' (preliminary)',
    vsUsual: (h: S, md: S) => ` (${h} vs usual ${md} fire-days)`,
    percentile: (p: number) => `More activity than ${p}% of the same months in other years`,
    notYet: 'not yet observed',
    noData: 'no data',
    insufficient: (n: number, need: number) =>
      `insufficient baseline (${n} of ${need} years needed)`,
    noUsual: 'no usual activity in this month',
    partial: (a: number, b: number) => `partial month: ${a} of ${b} days observed`,
    harm: (v: S) => `${v} harmonized fire-days`,
    range: (lo: S, hi: S) => ` (range ${lo}–${hi})`,
    raw: (m: S, v: S) => ` · raw MODIS ${m}, VIIRS ${v}`,
    soFar: (a: number, b: number) => `${a} of ${b} days observed so far`,
    baselineNote: (e: number, n: number) =>
      `baseline includes ${e} MODIS-only estimate years of ${n}`,
  },
  trend: {
    notEnough: (n: number, need: number) =>
      `Not enough complete years for a trend (${n} of ${need} needed).`,
    none: (p: S, n: number, from: number, to: number) =>
      `No statistically detectable trend in harmonized fire-days (${p}, n = ${n}, ${from}–${to}).`,
    up: (p: S, n: number, from: number, to: number) =>
      `Upward trend in harmonized fire-days (Mann–Kendall ${p} < 0.05, n = ${n}, ${from}–${to}).`,
    down: (p: S, n: number, from: number, to: number) =>
      `Downward trend in harmonized fire-days (Mann–Kendall ${p} < 0.05, n = ${n}, ${from}–${to}).`,
    pNone: 'not computed',
  },
  calendar: {
    gridAria: (label: S) =>
      `Burning calendar of ${label}: rows are years, columns are months. Use arrow keys to move and Enter to select a month.`,
    yearTotal: 'year total',
    yearTotalRaw: 'year total (raw)',
    median: 'median',
    harmMedian: 'harm. median',
    cellNotYet: 'not yet observed',
    cellNoData: 'no data',
    cellHarm: (v: S) => `${v} harmonized fire-days`,
    cellDays: (a: number, b: number) => `${a} of ${b} days observed`,
    cellTimes: (v: S) => `${v} times the median`,
    tipStatus: 'status',
    tipDays: (a: number, b: number) => `${a} of ${b} days`,
    tipHarm: 'harmonized',
    tipVs: 'vs median',
    tipRawModis: 'raw MODIS',
    tipRawViirs: 'raw VIIRS',
    tipRawTotal: 'raw total',
    tipNotYet: 'Not yet observed.',
    tipNoObs: 'No observations — not zero.',
    yearTotalTitle: (y: number, v: S, s: S) => `${y} total: ${v}, ${s}`,
    medianTitle: (m: S, v: S, n: number, s: S) => `${m} median: ${v} (n = ${n}, ${s})`,
  },
  legend: {
    aria: 'Legend',
    ratio: 'ratio to median of the same month',
    harm: 'harmonized fire-days (classes of this area — compare areas by numbers, not colours)',
    raw: 'raw detections, MODIS + VIIRS (classes of this area)',
    noRatio: 'no ratio (see tooltip)',
    rawWarning: (y: number) =>
      `Raw counts jump when VIIRS starts (${y}) because the sensor sees more, not because more burned. Use harmonized values to compare years.`,
    status: 'data status',
    partial: 'partly observed month — no ratio, not comparable with full months',
  },
  picker: {
    title: 'Area of interest',
    tabs: { region: 'Country', coords: 'Coordinates', draw: 'Draw' },
    search: 'Search by name or code',
    placeholder: 'e.g. Texas',
    noMatch: 'No match.',
    draw1: 'Click the map to place a point; it opens in the Coordinates tab.',
    draw2:
      'Polygon drawing is not built yet — use a point with a radius or a bounding box meanwhile.',
    areaType: 'Area type',
    point: 'Point + radius',
    bbox: 'Bounding box',
    lat: 'Latitude',
    lon: 'Longitude',
    radius: 'Radius, km',
    west: 'West °',
    east: 'East °',
    south: 'South °',
    north: 'North °',
    busy: 'Computing cells…',
    submit: 'Show calendar',
  },
  export: {
    title: 'Download the data',
    summary: 'monthly · with status',
    meta: 'method · area · version',
    detections: 'detections.csv (ZIP)',
    later: 'coming later',
    note: 'Every row carries its status. No-data months are empty cells, never 0.',
  },
  forecast: {
    title: 'What to expect in the coming months',
    intro1: 'A statistical range based on how this place behaved in past years. It is ',
    introStrong: 'not a forecast of any particular fire',
    intro2:
      ': a real month can fall outside the range. Use it to see what is normal, not to plan around a single number.',
    caption:
      'Expected range of harmonized fire-days for each of the next months, with the usual value for that month in past years',
    colMonth: 'Month',
    colRange: 'Range (dark: likely · light: almost certain)',
    colLikely: 'Likely range',
    colUsual: 'Usual',
    middle: (v: S) => `middle estimate ${v}`,
    usual: (v: S) => `usual ${v}`,
    foot: 'Solid mark = middle estimate · dashed line = usual month (median of past years). The ranges come from the data team’s model (method still to be documented); the corridors are meant to hold the real value about 8 times in 10 (dark) and 19 in 20 (light) — we have not verified that ourselves. The current month is only partly observed.',
  },
  charts: {
    totals: 'Year totals and trend',
    totalsAria:
      'Bar chart of yearly harmonized fire-days with a Theil–Sen trend line; shaded columns are incomplete years without a total',
    anomalies: 'Anomalies',
    vsMean: (from: number, to: number, n: number) => `vs mean ${from}–${to} (n = ${n})`,
    anomaliesAria:
      'Bar chart of each year minus the multi-year mean; orange above, blue below; shaded columns are incomplete years',
    tipNoTotal: (y: number, s: S) => `${y}: no total (incomplete year) · ${s}`,
    tipTotal: (y: number, v: S, s: S, inTrend: boolean) =>
      `${y}: ${v} fire-days<br/>${s}${inTrend ? '' : ' · not in trend'}`,
    tipAnomaly: (y: number, v: S | null) =>
      `${y}: ${v === null ? 'incomplete year' : `${v} fire-days vs mean`}`,
  },
  place: {
    point: (r: number, lat: S, lon: S) => `${r} km around ${lat}°, ${lon}°`,
    bbox: (w: S, e: S, s: S, n: S) => `${w}° to ${e}° E, ${s}° to ${n}° N`,
    eraStart: (p: S) => `${p} starts`,
    eraEnd: (p: S) => `${p} ends`,
  },
  map: {
    aria: (label: S) =>
      `3D satellite map of ${label}. Click the map to propose a point for a custom area.`,
    to3d: 'Switch to 3D',
    toFlat: '3D relief on · switch to flat',
    controls: {
      'Map.Title': 'Map',
      'NavigationControl.ZoomIn': 'Zoom in',
      'NavigationControl.ZoomOut': 'Zoom out',
      'NavigationControl.ResetBearing': 'Reset view to north',
      'AttributionControl.ToggleAttribution': 'Show data sources',
    } as Record<S, S>,
  },
  errors: {
    no_coverage:
      'There is no fire data for this place in this version. Pick Kazakhstan or Texas from the country list.',
    not_found: 'This place was not found.',
    invalid_area:
      'This area cannot be computed. Try a smaller area or move it away from the poles.',
    bad_request: 'The request was not understood.',
    unavailable: 'The data service is temporarily unavailable. Please retry.',
    no_active_dataset: 'No dataset is loaded yet.',
    internal: 'Something went wrong. Please retry.',
  } as Record<S, S>,
  paletteName: { inferno: 'warm', cividis: 'blue–yellow' } as Record<S, S>,
  pageTitle: (place: S) => `${place} — burning calendar`,
};

export type Messages = typeof en;

const ru: Messages = {
  monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  monthsLong: [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ],
  nav: {
    skip: 'Перейти к содержанию',
    how: 'Как это работает',
    glossary: 'Словарь',
    theme: 'Тема оформления',
    light: 'Светлая',
    dark: 'Тёмная',
    auto: 'Авто',
    autoTitle: 'Как в настройках устройства',
    themeTitle: (name) => `${name} тема`,
    language: 'Язык',
    sections: 'Разделы',
    tagline: 'Земля стала гореть больше — или спутники стали лучше видеть?',
  },
  banner: {
    mockText:
      'Это сгенерированные тестовые числа, а не настоящие пожары. Их заменят реальные данные NASA FIRMS.',
    line: (v, sp, nrt) => `набор ${v} · проверенные данные до ${sp} · оперативные до ${nrt}`,
  },
  status: {
    title: {
      final: 'Проверено',
      estimate: 'Оценка (старый спутник)',
      preliminary: 'Предварительно',
      no_data: 'Нет данных',
      future: 'Ещё не было',
    },
    label: {
      final: 'проверено',
      estimate: 'оценка',
      preliminary: 'предварительно',
      no_data: 'нет данных',
      future: 'ещё не наблюдалось',
    },
    help: {
      final: 'проверенные данные: NASA завершило стандартную обработку, значение не изменится.',
      estimate:
        'до нового спутника VIIRS пожары видел только MODIS; его счёт пересчитан в единицы VIIRS. Близко, но менее точно.',
      preliminary:
        'оперативные данные (почти в реальном времени). NASA перепроверяет их через несколько месяцев, число может немного измениться.',
      no_data: 'нет спутниковых наблюдений. Это не ноль: мы просто не знаем.',
      future: 'этот месяц ещё не наступил.',
    },
  },
  explorer: {
    kindRegion: 'страна / регион',
    kindAoi: 'своя область',
    area: (km2) => `${km2} км²`,
    cells: (n) => `${n} ячеек карты`,
    coarse: ' (крупная сетка: область очень большая)',
    intro:
      'Спутники следят за пожарами с 2000 года. Два разных спутника считали по-разному, поэтому мы привели их к одной шкале. Выберите место и нажмите на месяц, чтобы сравнить его с обычным.',
    selectedMonth: 'Выбранный месяц',
    calTitle: 'Календарь пожаров',
    calDesc:
      'Каждая строка — год, каждый столбец — месяц. Чем ярче квадрат, тем больше пожарной активности. Нажмите на любой квадрат.',
    colourBy: 'Цвет по',
    modes: { harm: 'Гармонизированные дни', raw: 'Сырые обнаружения', ratio: 'К медиане' },
    modeHelp: {
      harm: 'Оба спутника на одной шкале: честный способ сравнивать годы.',
      raw: 'Простые счётчики спутников. Они скачут, когда начинает работать новый спутник, поэтому годы так сравнивать нельзя.',
      ratio: 'Насколько месяц отличается от обычного: синий — спокойнее, оранжевый — активнее.',
    },
    colours: (warm) => `цвета: ${warm ? 'тёплые' : 'сине-жёлтые'}`,
    colourAria: (p) => `Цветовая шкала: ${p}. Сменить шкалу.`,
    newestFirst: 'сначала новые',
    oldestFirst: 'сначала старые',
    empty:
      'В этой области пожаров не наблюдалось. Наблюдённые месяцы показаны как 0; месяцы без наблюдений заштрихованы.',
    mapTitle: 'Где это?',
    mapDesc:
      'Настоящий спутниковый снимок с рельефом: видны леса, поля и горы. Тяните, чтобы вращать, колесом — масштаб.',
    trendTitle: 'Становится ли хуже с годами?',
    slope: (s, from, to) =>
      `Наклон (Тейл–Сен): ${s} пожарных дней в год за полные годы ${from}–${to}`,
    slopeEstimates: (e, n) => `; из них ${e} лет — оценки по старому спутнику (из ${n})`,
    checkedOnly: (from, to, n, s, p) =>
      `Только проверенные годы (${from}–${to}, n = ${n}): ${s} пожарных дней в год, Манн–Кендалл ${p}.`,
    checkedTooFew: 'Слишком мало проверенных лет для отдельной проверки.',
    chartsNote:
      'Затенённые столбцы — неполные годы без суммы; заштрихованные — предварительные. Ни те, ни другие не входят в тренд. Уровень значимости 0,05.',
    howTitle: 'Как это работает',
    how: [
      [
        '1. Два спутника — одна шкала.',
        'MODIS (с 2000) и VIIRS (с 2012) видят пожары по-разному. Мы переводим оба в одну единицу, чтобы годы можно было сравнивать.',
      ],
      [
        '2. Сравнение с обычным месяцем.',
        '«×1,2» значит на 20% больше пожарной активности, чем середина (медиана) того же месяца в другие годы.',
      ],
      [
        '3. Мы говорим, насколько уверены.',
        'Каждое число помечено: проверено, оценка, предварительно или нет данных. «Нет данных» никогда не показывается как ноль.',
      ],
    ],
    glossaryTitle: 'Словарь',
    glossary: [
      [
        'Пожарный день',
        'Одна ячейка карты (около 1 км), где за сутки замечен огонь. Мера активности, а не площадь пожаров и не их число.',
      ],
      [
        'MODIS / VIIRS',
        'Два спутниковых прибора. VIIRS новее и чётче, поэтому видит больше мелких пожаров.',
      ],
      [
        'Медиана',
        'Серединное значение: в половине лет было больше, в половине — меньше. Один экстремальный год её не искажает.',
      ],
      [
        'Предварительно',
        'Оперативные данные, которые NASA перепроверяет через несколько месяцев; могут немного измениться.',
      ],
      ['Оценка', 'Годы до VIIRS: счёт MODIS, пересчитанный в единицы VIIRS. Менее точно.'],
      ['P74', 'Процентиль: в этом месяце активность выше, чем в 74% таких же месяцев других лет.'],
    ],
    method: (m, from, to, sp, nrt) =>
      `Метод: ${m}. Обычный месяц = медиана ${from}–${to}. Проверенные данные до ${sp}; оперативные до ${nrt}.`,
    loadError: 'Не удалось загрузить календарь.',
    retry: 'Повторить',
    noRegions: 'Регионы ещё не загружены.',
    loading: 'Загружаем календарь',
  },
  headline: {
    pick: 'Нажмите на месяц в календаре, чтобы увидеть сравнение.',
    ratio: (x, n, month, from, to) =>
      `${x} к медиане месяца «${month}» за ${n} лет (${from}–${to})`,
    prelim: ' (предварительно)',
    vsUsual: (h, md) => ` (${h} против обычных ${md} пожарных дней)`,
    percentile: (p) => `Активнее, чем ${p}% таких же месяцев в другие годы`,
    notYet: 'ещё не наблюдалось',
    noData: 'нет данных',
    insufficient: (n, need) => `мало лет для сравнения (${n} из ${need} нужных)`,
    noUsual: 'обычно в этом месяце пожаров нет',
    partial: (a, b) => `неполный месяц: наблюдалось ${a} из ${b} дней`,
    harm: (v) => `${v} гармонизированных пожарных дней`,
    range: (lo, hi) => ` (диапазон ${lo}–${hi})`,
    raw: (m, v) => ` · сырые MODIS ${m}, VIIRS ${v}`,
    soFar: (a, b) => `пока наблюдалось ${a} из ${b} дней`,
    baselineNote: (e, n) => `в базе сравнения ${e} лет — оценки только по MODIS (из ${n})`,
  },
  trend: {
    notEnough: (n, need) => `Мало полных лет для тренда (${n} из ${need} нужных).`,
    none: (p, n, from, to) => `Статистически значимого тренда нет (${p}, n = ${n}, ${from}–${to}).`,
    up: (p, n, from, to) =>
      `Тренд вверх по гармонизированным пожарным дням (Манн–Кендалл ${p} < 0,05, n = ${n}, ${from}–${to}).`,
    down: (p, n, from, to) =>
      `Тренд вниз по гармонизированным пожарным дням (Манн–Кендалл ${p} < 0,05, n = ${n}, ${from}–${to}).`,
    pNone: 'не рассчитано',
  },
  calendar: {
    gridAria: (label) =>
      `Календарь пожаров: ${label}. Строки — годы, столбцы — месяцы. Стрелки — перемещение, Enter — выбрать месяц.`,
    yearTotal: 'за год',
    yearTotalRaw: 'за год (сырые)',
    median: 'медиана',
    harmMedian: 'медиана (гарм.)',
    cellNotYet: 'ещё не наблюдалось',
    cellNoData: 'нет данных',
    cellHarm: (v) => `${v} гармонизированных пожарных дней`,
    cellDays: (a, b) => `наблюдалось ${a} из ${b} дней`,
    cellTimes: (v) => `${v} от медианы`,
    tipStatus: 'статус',
    tipDays: (a, b) => `${a} из ${b} дней`,
    tipHarm: 'гармониз.',
    tipVs: 'к медиане',
    tipRawModis: 'сырые MODIS',
    tipRawViirs: 'сырые VIIRS',
    tipRawTotal: 'сырые всего',
    tipNotYet: 'Ещё не наблюдалось.',
    tipNoObs: 'Нет наблюдений — это не ноль.',
    yearTotalTitle: (y, v, s) => `${y}, всего: ${v}, ${s}`,
    medianTitle: (m, v, n, s) => `${m}, медиана: ${v} (n = ${n}, ${s})`,
  },
  legend: {
    aria: 'Легенда',
    ratio: 'отношение к медиане того же месяца',
    harm: 'гармонизированные пожарные дни (классы этой области — сравнивайте области по числам, а не по цвету)',
    raw: 'сырые обнаружения, MODIS + VIIRS (классы этой области)',
    noRatio: 'нет отношения (см. подсказку)',
    rawWarning: (y) =>
      `Сырые счётчики скачут с началом работы VIIRS (${y}): прибор видит больше, а горит не больше. Для сравнения лет используйте гармонизированные значения.`,
    status: 'статус данных',
    partial: 'месяц наблюдался не полностью — без отношения, нельзя сравнивать с полными',
  },
  picker: {
    title: 'Область интереса',
    tabs: { region: 'Страна', coords: 'Координаты', draw: 'Нарисовать' },
    search: 'Поиск по названию или коду',
    placeholder: 'например, Техас',
    noMatch: 'Ничего не найдено.',
    draw1: 'Нажмите на карту, чтобы поставить точку; она откроется во вкладке «Координаты».',
    draw2:
      'Рисование многоугольников ещё не готово — пока используйте точку с радиусом или прямоугольник.',
    areaType: 'Тип области',
    point: 'Точка + радиус',
    bbox: 'Прямоугольник',
    lat: 'Широта',
    lon: 'Долгота',
    radius: 'Радиус, км',
    west: 'Запад °',
    east: 'Восток °',
    south: 'Юг °',
    north: 'Север °',
    busy: 'Считаем ячейки…',
    submit: 'Показать календарь',
  },
  export: {
    title: 'Скачать данные',
    summary: 'по месяцам · со статусом',
    meta: 'метод · область · версия',
    detections: 'detections.csv (ZIP)',
    later: 'позже',
    note: 'У каждой строки есть статус. Месяцы без данных — пустые ячейки, никогда не 0.',
  },
  forecast: {
    title: 'Чего ожидать в ближайшие месяцы',
    intro1: 'Статистический диапазон по тому, как это место вело себя в прошлые годы. Это ',
    introStrong: 'не прогноз конкретного пожара',
    intro2:
      ': реальный месяц может выйти за диапазон. Используйте его, чтобы понять норму, а не чтобы опираться на одно число.',
    caption:
      'Ожидаемый диапазон гармонизированных пожарных дней на ближайшие месяцы и обычное значение этого месяца в прошлые годы',
    colMonth: 'Месяц',
    colRange: 'Диапазон (тёмный: вероятно · светлый: почти наверняка)',
    colLikely: 'Вероятный диапазон',
    colUsual: 'Обычно',
    middle: (v) => `средняя оценка ${v}`,
    usual: (v) => `обычно ${v}`,
    foot: 'Сплошная метка — средняя оценка · пунктир — обычный месяц (медиана прошлых лет). Диапазоны взяты из модели команды данных (метод ещё описывается); коридоры должны содержать реальное значение примерно в 8 случаях из 10 (тёмный) и в 19 из 20 (светлый) — сами мы это не проверяли. Текущий месяц наблюдается не полностью.',
  },
  charts: {
    totals: 'Суммы по годам и тренд',
    totalsAria:
      'Столбчатая диаграмма гармонизированных пожарных дней по годам с линией тренда Тейла–Сена; затенённые столбцы — неполные годы без суммы',
    anomalies: 'Отклонения',
    vsMean: (from, to, n) => `от среднего ${from}–${to} (n = ${n})`,
    anomaliesAria:
      'Столбчатая диаграмма: каждый год минус многолетнее среднее; оранжевый — выше, синий — ниже; затенённые — неполные годы',
    tipNoTotal: (y, s) => `${y}: нет суммы (неполный год) · ${s}`,
    tipTotal: (y, v, s, inTrend) =>
      `${y}: ${v} пожарных дней<br/>${s}${inTrend ? '' : ' · не в тренде'}`,
    tipAnomaly: (y, v) => `${y}: ${v === null ? 'неполный год' : `${v} пожарных дней от среднего`}`,
  },
  place: {
    point: (r, lat, lon) => `${r} км вокруг ${lat}°, ${lon}°`,
    bbox: (w, e, s, n) => `от ${w}° до ${e}° в. д., от ${s}° до ${n}° с. ш.`,
    eraStart: (p) => `${p}: начало`,
    eraEnd: (p) => `${p}: конец`,
  },
  map: {
    aria: (label) =>
      `3D-карта со спутниковым снимком: ${label}. Нажмите на карту, чтобы предложить точку для своей области.`,
    to3d: 'Включить 3D',
    toFlat: '3D-рельеф включён · сделать плоской',
    controls: {
      'Map.Title': 'Карта',
      'NavigationControl.ZoomIn': 'Приблизить',
      'NavigationControl.ZoomOut': 'Отдалить',
      'NavigationControl.ResetBearing': 'Повернуть на север',
      'AttributionControl.ToggleAttribution': 'Показать источники данных',
    },
  },
  errors: {
    no_coverage:
      'Для этого места в этой версии нет данных о пожарах. Выберите Казахстан или Техас в списке стран.',
    not_found: 'Это место не найдено.',
    invalid_area: 'Эту область нельзя посчитать. Уменьшите её или отодвиньте от полюсов.',
    bad_request: 'Запрос не распознан.',
    unavailable: 'Сервис данных временно недоступен. Повторите попытку.',
    no_active_dataset: 'Данные ещё не загружены.',
    internal: 'Что-то пошло не так. Повторите попытку.',
  },
  paletteName: { inferno: 'тёплая', cividis: 'сине-жёлтая' },
  pageTitle: (place) => `${place} — календарь пожаров`,
};

const tg: Messages = {
  monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  monthsLong: [
    'Январ',
    'Феврал',
    'Март',
    'Апрел',
    'Май',
    'Июн',
    'Июл',
    'Август',
    'Сентябр',
    'Октябр',
    'Ноябр',
    'Декабр',
  ],
  nav: {
    skip: 'Ба мундариҷа гузаштан',
    how: 'Чӣ тавр кор мекунад',
    glossary: 'Луғат',
    theme: 'Мавзӯи ранг',
    light: 'Равшан',
    dark: 'Торик',
    auto: 'Худкор',
    autoTitle: 'Мисли танзимоти дастгоҳ',
    themeTitle: (name) => `Мавзӯи ${name}`,
    language: 'Забон',
    sections: 'Бахшҳо',
    tagline: 'Оё Замин бештар месӯзад — ё моҳвораҳо беҳтар мебинанд?',
  },
  banner: {
    mockText:
      'Ин рақамҳои санҷишии сохташуда мебошанд, на сӯхторҳои воқеӣ. Онҳоро маълумоти воқеии NASA FIRMS иваз мекунад.',
    line: (v, sp, nrt) =>
      `маҷмӯа ${v} · маълумоти санҷидашуда то ${sp} · маълумоти фаврӣ то ${nrt}`,
  },
  status: {
    title: {
      final: 'Санҷида шуд',
      estimate: 'Баҳо (моҳвораи кӯҳна)',
      preliminary: 'Пешакӣ',
      no_data: 'Маълумот нест',
      future: 'Ҳанӯз нест',
    },
    label: {
      final: 'санҷидашуда',
      estimate: 'баҳо',
      preliminary: 'пешакӣ',
      no_data: 'маълумот нест',
      future: 'ҳанӯз мушоҳида нашудааст',
    },
    help: {
      final: 'маълумоти санҷидашуда: NASA коркарди стандартиро анҷом дод, рақам дигар намешавад.',
      estimate:
        'то моҳвораи навтари VIIRS сӯхторҳоро танҳо MODIS медид; ҳисоби он ба воҳидҳои VIIRS табдил дода шудааст. Наздик, вале камтар дақиқ.',
      preliminary:
        'маълумоти фаврӣ (қариб дар вақти воқеӣ). NASA онро пас аз чанд моҳ дубора месанҷад, рақам метавонад каме тағйир ёбад.',
      no_data: 'мушоҳидаи моҳвораӣ нест. Ин сифр нест: мо танҳо намедонем.',
      future: 'ин моҳ ҳанӯз нарасидааст.',
    },
  },
  explorer: {
    kindRegion: 'кишвар / минтақа',
    kindAoi: 'минтақаи худӣ',
    area: (km2) => `${km2} км²`,
    cells: (n) => `${n} чашмаки харита`,
    coarse: ' (тӯри калон: минтақа хеле бузург аст)',
    intro:
      'Моҳвораҳо аз соли 2000 сӯхторҳоро назорат мекунанд. Ду моҳвораи гуногун ба таври гуногун ҳисоб мекарданд, бинобар ин мо онҳоро ба як миқёс овардем. Ҷойро интихоб кунед ва моҳро пахш кунед, то онро бо моҳи муқаррарӣ муқоиса кунед.',
    selectedMonth: 'Моҳи интихобшуда',
    calTitle: 'Тақвими сӯхтор',
    calDesc:
      'Ҳар сатр — сол, ҳар сутун — моҳ. Ҳар қадар мураббаъ равшантар бошад, фаъолияти сӯхтор ҳамон қадар зиёд аст. Ягон мураббаъро пахш кунед.',
    colourBy: 'Ранг аз рӯи',
    modes: { harm: 'Рӯзҳои ҳамоҳангшуда', raw: 'Ошкоркуниҳои хом', ratio: 'Нисбат ба медиана' },
    modeHelp: {
      harm: 'Ҳарду моҳвора дар як миқёс: роҳи одилонаи муқоисаи солҳо.',
      raw: 'Ҳисобҳои оддии моҳвора. Вақте ки моҳвораи нав ба кор медарояд, онҳо ҷаҳиш мекунанд, бинобар ин солҳоро бо ин муқоиса накунед.',
      ratio: 'Ин моҳ аз моҳи муқаррарӣ чӣ қадар фарқ мекунад: кабуд — оромтар, норанҷӣ — фаъолтар.',
    },
    colours: (warm) => `рангҳо: ${warm ? 'гарм' : 'кабуд–зард'}`,
    colourAria: (p) => `Миқёси ранг: ${p}. Иваз кардан.`,
    newestFirst: 'аввал навтарин',
    oldestFirst: 'аввал кӯҳнатарин',
    empty:
      'Дар ин минтақа сӯхтор мушоҳида нашудааст. Моҳҳои мушоҳидашуда ҳамчун 0 нишон дода мешаванд; моҳҳои бе мушоҳида хатдор мебошанд.',
    mapTitle: 'Ин дар куҷост?',
    mapDesc:
      'Тасвири воқеии моҳвораӣ бо релеф: ҷангалҳо, киштзорҳо ва кӯҳҳо намоёнанд. Барои гардондан кашед, барои калон кардан чархро гардонед.',
    trendTitle: 'Оё бо гузашти солҳо бадтар мешавад?',
    slope: (s, from, to) =>
      `Нишеб (Тейл–Сен): ${s} рӯзи сӯхтор дар як сол дар солҳои пурраи ${from}–${to}`,
    slopeEstimates: (e, n) => `; аз ҷумла ${e} соли баҳо аз рӯи моҳвораи кӯҳна (аз ${n})`,
    checkedOnly: (from, to, n, s, p) =>
      `Танҳо солҳои санҷидашуда (${from}–${to}, n = ${n}): ${s} рӯзи сӯхтор дар як сол, Манн–Кендалл ${p}.`,
    checkedTooFew: 'Барои санҷиши ҷудогона солҳои санҷидашуда кам аст.',
    chartsNote:
      'Сутунҳои сояафкан — солҳои нопурра бе ҷамъ; хатдор — пешакӣ. Ҳеҷ кадоме ба тамоюл дохил намешавад. Сатҳи аҳамият 0,05.',
    howTitle: 'Чӣ тавр кор мекунад',
    how: [
      [
        '1. Ду моҳвора — як миқёс.',
        'MODIS (аз соли 2000) ва VIIRS (аз соли 2012) сӯхторҳоро гуногун мебинанд. Мо ҳардуро ба як воҳид табдил медиҳем, то солҳоро муқоиса кардан мумкин бошад.',
      ],
      [
        '2. Муқоиса бо моҳи муқаррарӣ.',
        '«×1,2» маънои 20% фаъолияти бештари сӯхторро нисбат ба миёнаи (медианаи) ҳамон моҳ дар солҳои дигар дорад.',
      ],
      [
        '3. Мо мегӯем, ки чӣ қадар боварӣ дорем.',
        'Ҳар рақам қайд карда мешавад: санҷидашуда, баҳо, пешакӣ ё маълумот нест. «Маълумот нест» ҳеҷ гоҳ ҳамчун сифр нишон дода намешавад.',
      ],
    ],
    glossaryTitle: 'Луғат',
    glossary: [
      [
        'Рӯзи сӯхтор',
        'Як чашмаки харита (тақрибан 1 км), ки дар он дар як шабонарӯз оташ дида шудааст. Ченаки фаъолият, на масоҳати сӯхта ва на шумораи сӯхторҳо.',
      ],
      [
        'MODIS / VIIRS',
        'Ду асбоби моҳвораӣ. VIIRS навтар ва дақиқтар аст, бинобар ин сӯхторҳои хурдро бештар мебинад.',
      ],
      [
        'Медиана',
        'Қимати миёна: дар нисфи солҳо бештар, дар нисфи дигар камтар буд. Як соли истисноӣ онро вайрон намекунад.',
      ],
      [
        'Пешакӣ',
        'Маълумоти фаврӣ, ки NASA пас аз чанд моҳ дубора месанҷад; метавонад каме тағйир ёбад.',
      ],
      [
        'Баҳо',
        'Солҳои пеш аз VIIRS: ҳисоби MODIS, ки ба воҳидҳои VIIRS табдил дода шудааст. Камтар дақиқ.',
      ],
      ['P74', 'Персентил: дар ин моҳ фаъолият аз 74% ҳамин моҳҳои солҳои дигар зиёдтар буд.'],
    ],
    method: (m, from, to, sp, nrt) =>
      `Усул: ${m}. Моҳи муқаррарӣ = медианаи ${from}–${to}. Маълумоти санҷидашуда то ${sp}; фаврӣ то ${nrt}.`,
    loadError: 'Тақвимро бор кардан нашуд.',
    retry: 'Такрор кардан',
    noRegions: 'Минтақаҳо ҳанӯз бор нашудаанд.',
    loading: 'Тақвим бор мешавад',
  },
  headline: {
    pick: 'Барои дидани муқоиса моҳро дар тақвим пахш кунед.',
    ratio: (x, n, month, from, to) =>
      `${x} нисбат ба медианаи моҳи ${month} дар ${n} сол (${from}–${to})`,
    prelim: ' (пешакӣ)',
    vsUsual: (h, md) => ` (${h} нисбат ба ${md} рӯзи сӯхтори муқаррарӣ)`,
    percentile: (p) => `Фаъолтар аз ${p}% ҳамин моҳҳо дар солҳои дигар`,
    notYet: 'ҳанӯз мушоҳида нашудааст',
    noData: 'маълумот нест',
    insufficient: (n, need) => `барои муқоиса солҳо кам аст (${n} аз ${need} лозимӣ)`,
    noUsual: 'одатан дар ин моҳ сӯхтор нест',
    partial: (a, b) => `моҳи нопурра: ${a} аз ${b} рӯз мушоҳида шуд`,
    harm: (v) => `${v} рӯзи сӯхтори ҳамоҳангшуда`,
    range: (lo, hi) => ` (диапазон ${lo}–${hi})`,
    raw: (m, v) => ` · хоми MODIS ${m}, VIIRS ${v}`,
    soFar: (a, b) => `то ҳол ${a} аз ${b} рӯз мушоҳида шуд`,
    baselineNote: (e, n) => `дар асоси муқоиса ${e} сол — баҳо танҳо аз рӯи MODIS (аз ${n})`,
  },
  trend: {
    notEnough: (n, need) => `Барои тамоюл солҳои пурра кам аст (${n} аз ${need} лозимӣ).`,
    none: (p, n, from, to) =>
      `Тамоюли аз ҷиҳати оморӣ муҳим вуҷуд надорад (${p}, n = ${n}, ${from}–${to}).`,
    up: (p, n, from, to) =>
      `Тамоюли афзоиш дар рӯзҳои сӯхтори ҳамоҳангшуда (Манн–Кендалл ${p} < 0,05, n = ${n}, ${from}–${to}).`,
    down: (p, n, from, to) =>
      `Тамоюли коҳиш дар рӯзҳои сӯхтори ҳамоҳангшуда (Манн–Кендалл ${p} < 0,05, n = ${n}, ${from}–${to}).`,
    pNone: 'ҳисоб нашудааст',
  },
  calendar: {
    gridAria: (label) =>
      `Тақвими сӯхтор: ${label}. Сатрҳо — солҳо, сутунҳо — моҳҳо. Тирчаҳо — ҳаракат, Enter — интихоби моҳ.`,
    yearTotal: 'дар як сол',
    yearTotalRaw: 'дар як сол (хом)',
    median: 'медиана',
    harmMedian: 'медиана (ҳамоҳ.)',
    cellNotYet: 'ҳанӯз мушоҳида нашудааст',
    cellNoData: 'маълумот нест',
    cellHarm: (v) => `${v} рӯзи сӯхтори ҳамоҳангшуда`,
    cellDays: (a, b) => `${a} аз ${b} рӯз мушоҳида шуд`,
    cellTimes: (v) => `${v} нисбат ба медиана`,
    tipStatus: 'вазъ',
    tipDays: (a, b) => `${a} аз ${b} рӯз`,
    tipHarm: 'ҳамоҳангшуда',
    tipVs: 'ба медиана',
    tipRawModis: 'хоми MODIS',
    tipRawViirs: 'хоми VIIRS',
    tipRawTotal: 'хом, ҳамагӣ',
    tipNotYet: 'Ҳанӯз мушоҳида нашудааст.',
    tipNoObs: 'Мушоҳида нест — ин сифр нест.',
    yearTotalTitle: (y, v, s) => `${y}, ҳамагӣ: ${v}, ${s}`,
    medianTitle: (m, v, n, s) => `${m}, медиана: ${v} (n = ${n}, ${s})`,
  },
  legend: {
    aria: 'Шарҳи шартӣ',
    ratio: 'нисбат ба медианаи ҳамон моҳ',
    harm: 'рӯзҳои сӯхтори ҳамоҳангшуда (синфҳои ҳамин минтақа — минтақаҳоро аз рӯи рақам муқоиса кунед, на аз рӯи ранг)',
    raw: 'ошкоркуниҳои хом, MODIS + VIIRS (синфҳои ҳамин минтақа)',
    noRatio: 'нисбат нест (нигаред ба маслиҳат)',
    rawWarning: (y) =>
      `Ҳисобҳои хом бо оғози VIIRS (${y}) ҷаҳиш мекунанд: асбоб бештар мебинад, на ин ки бештар сӯхтааст. Барои муқоисаи солҳо қиматҳои ҳамоҳангшударо истифода баред.`,
    status: 'вазъи маълумот',
    partial: 'моҳ пурра мушоҳида нашудааст — бе нисбат, бо моҳҳои пурра муқоиса намешавад',
  },
  picker: {
    title: 'Минтақаи мавриди назар',
    tabs: { region: 'Кишвар', coords: 'Координатаҳо', draw: 'Кашидан' },
    search: 'Ҷустуҷӯ аз рӯи ном ё рамз',
    placeholder: 'масалан, Техас',
    noMatch: 'Чизе ёфт нашуд.',
    draw1:
      'Барои гузоштани нуқта харитаро пахш кунед; он дар ҷадвали «Координатаҳо» кушода мешавад.',
    draw2:
      'Кашидани бисёркунҷа ҳанӯз тайёр нест — ҳоло нуқта бо радиус ё росткунҷаро истифода баред.',
    areaType: 'Навъи минтақа',
    point: 'Нуқта + радиус',
    bbox: 'Росткунҷа',
    lat: 'Арз',
    lon: 'Тӯл',
    radius: 'Радиус, км',
    west: 'Ғарб °',
    east: 'Шарқ °',
    south: 'Ҷануб °',
    north: 'Шимол °',
    busy: 'Чашмакҳо ҳисоб мешаванд…',
    submit: 'Нишон додани тақвим',
  },
  export: {
    title: 'Боргирии маълумот',
    summary: 'аз рӯи моҳҳо · бо вазъ',
    meta: 'усул · минтақа · версия',
    detections: 'detections.csv (ZIP)',
    later: 'баъдтар',
    note: 'Ҳар сатр вазъи худро дорад. Моҳҳои бе маълумот — чашмакҳои холӣ, ҳеҷ гоҳ 0 нестанд.',
  },
  forecast: {
    title: 'Дар моҳҳои наздик чӣ интизор аст',
    intro1: 'Диапазони оморӣ аз рӯи он, ки ин ҷой дар солҳои гузашта чӣ гуна буд. Ин ',
    introStrong: 'пешгӯии ягон сӯхтори мушаххас нест',
    intro2:
      ': моҳи воқеӣ метавонад аз диапазон берун бошад. Онро барои фаҳмидани меъёр истифода баред, на барои такя ба як рақам.',
    caption:
      'Диапазони интизории рӯзҳои сӯхтори ҳамоҳангшуда барои моҳҳои наздик ва қимати муқаррарии ҳамон моҳ дар солҳои гузашта',
    colMonth: 'Моҳ',
    colRange: 'Диапазон (торик: эҳтимолӣ · равшан: қариб яқин)',
    colLikely: 'Диапазони эҳтимолӣ',
    colUsual: 'Муқаррарӣ',
    middle: (v) => `баҳои миёна ${v}`,
    usual: (v) => `муқаррарӣ ${v}`,
    foot: 'Аломати пурра — баҳои миёна · хати нуқтадор — моҳи муқаррарӣ (медианаи солҳои гузашта). Диапазонҳо аз модели гурӯҳи маълумот гирифта шудаанд (усул ҳанӯз тавсиф мешавад); долонҳо бояд қимати воқеиро тақрибан 8 аз 10 (торик) ва 19 аз 20 (равшан) маротиба дар бар гиранд — мо инро худамон насанҷидаем. Моҳи ҷорӣ пурра мушоҳида нашудааст.',
  },
  charts: {
    totals: 'Ҷамъи солона ва тамоюл',
    totalsAria:
      'Диаграммаи сутунии рӯзҳои сӯхтори ҳамоҳангшуда аз рӯи солҳо бо хати тамоюли Тейл–Сен; сутунҳои сояафкан — солҳои нопурра',
    anomalies: 'Инҳирофҳо',
    vsMean: (from, to, n) => `аз миёнаи ${from}–${to} (n = ${n})`,
    anomaliesAria:
      'Диаграммаи сутунӣ: ҳар сол манфии миёнаи бисёрсола; норанҷӣ — болотар, кабуд — поёнтар; сояафкан — солҳои нопурра',
    tipNoTotal: (y, s) => `${y}: ҷамъ нест (соли нопурра) · ${s}`,
    tipTotal: (y, v, s, inTrend) =>
      `${y}: ${v} рӯзи сӯхтор<br/>${s}${inTrend ? '' : ' · дар тамоюл нест'}`,
    tipAnomaly: (y, v) => `${y}: ${v === null ? 'соли нопурра' : `${v} рӯзи сӯхтор аз миёна`}`,
  },
  place: {
    point: (r, lat, lon) => `${r} км атрофи ${lat}°, ${lon}°`,
    bbox: (w, e, s, n) => `аз ${w}° то ${e}° т. ш., аз ${s}° то ${n}° а. ш.`,
    eraStart: (p) => `${p}: оғоз`,
    eraEnd: (p) => `${p}: анҷом`,
  },
  map: {
    aria: (label) =>
      `Харитаи 3D бо тасвири моҳвораӣ: ${label}. Барои пешниҳоди нуқта барои минтақаи худ харитаро пахш кунед.`,
    to3d: 'Фаъол кардани 3D',
    toFlat: 'Релефи 3D фаъол аст · ҳамвор кардан',
    controls: {
      'Map.Title': 'Харита',
      'NavigationControl.ZoomIn': 'Калон кардан',
      'NavigationControl.ZoomOut': 'Хурд кардан',
      'NavigationControl.ResetBearing': 'Ба шимол гардондан',
      'AttributionControl.ToggleAttribution': 'Нишон додани манбаъҳо',
    },
  },
  errors: {
    no_coverage:
      'Барои ин ҷой дар ин версия маълумоти сӯхтор нест. Аз рӯйхати кишварҳо Қазоқистон ё Техасро интихоб кунед.',
    not_found: 'Ин ҷой ёфт нашуд.',
    invalid_area:
      'Ин минтақаро ҳисоб кардан ғайриимкон аст. Онро хурдтар кунед ё аз қутбҳо дур гузоред.',
    bad_request: 'Дархост фаҳмида нашуд.',
    unavailable: 'Хидмати маълумот муваққатан дастнорас аст. Такрор кунед.',
    no_active_dataset: 'Маълумот ҳанӯз бор нашудааст.',
    internal: 'Хатогӣ рух дод. Такрор кунед.',
  },
  paletteName: { inferno: 'гарм', cividis: 'кабуд–зард' },
  pageTitle: (place) => `${place} — тақвими сӯхтор`,
};

export const MESSAGES: Record<Locale, Messages> = { en, ru, tg };
