# FIRE TRACE — спецификация MVP (Phase 1: «основа без лагов»)

Аудитория: службы ЧС, лесники, учёные. Язык UI: English (глобальное судейство) + RU позже.
Каждая фича — ID, критерии приёмки (проверяются тестами), граничные случаи.

## F01. Выбор области (AOI)
Три способа, все дают одинаковый результат — набор ячеек H3 r6 + `aoiId` (хэш) + площадь км².
- Страна: поиск с автодополнением (≥ 1 символ, ≤ 50 мс локально), выбор → мгновенно `region_month`.
- Рисование на карте: полигон и прямоугольник (terra-draw), редактирование вершин, сброс.
- Координаты: точка (lat, lon) + радиус 5–200 км, или bbox; валидация диапазонов, понятные ошибки.
- URL отражает AOI: `/r/TJK` для страны, `/a/<aoiId>` для произвольной области (сохраняется в БД).
Приёмка: любой из трёх способов показывает календарь ≤ 1 с (страна) / ≤ 1.5 с (полигон ≤ 5 000 ячеек).
Граница: AOI в море/без ячеек → «нет наблюдений огня в этой области», не пустой экран.
Граница: AOI > 50 000 ячеек → автоматически r4, пометка «coarse resolution».

## F02. Календарь пожарной активности — главный экран
- Строки 2000–2026, столбцы Jan–Dec, 324 ячейки.
- Цвет = harmonized fire-days (по умолчанию) | raw detections (переключатель) | ratio to median.
- Шкала inferno/cividis, 7 классов, легенда с числами; безопасна для дальтоников.
- Справа — сумма за год, снизу — медиана месяца: худшие годы и пиковые месяцы видны сразу.
- Статусы ячеек: final / estimate (< 2012) / preliminary (после SP-даты) / no_data (2000-01…10) / future.
Приёмка: 2000 Jan–Oct отображаются как no_data (штриховка), не 0. Все тултипы показывают статус.

## F03. Сравнение с нормой (главная метрика)
Шапка: «November 2026 — ×1.8 vs median of 24 Novembers (2003–2025) · P94 · preliminary».
Правила — skill honest-labels. Выбранный месяц — по клику в календаре, по умолчанию последний полный месяц.
Приёмка: юнит-тесты на медиану после агрегации, n < 10, median = 0, исключение целевого года.

## F04. Графики
- Ряд по годам (сумма за год) + линия тренда Theil–Sen, p-value Mann–Kendall, только полные годы.
- Аномалии: столбцы год − среднее многолетнее (сине-оранжевые), с подписью «vs mean 2003–2025».
- Оба графика подсвечивают выбранный год; estimate/preliminary видны штриховкой.
Приёмка: тренд считается одной чистой функцией с юнит-тестами на известных рядах.

## F05. Выгрузка
ZIP: `summary.csv` (year, month, harmonized, harm_lo, harm_hi, raw_modis, raw_viirs, median_same_month,
ratio_to_median, percentile, status), `detections.csv` (поля из контракта + status), `metadata.json`
(AOI geojson, площадь, dataset_version, метод, фильтры, дата выгрузки, текст благодарности FIRMS).
UTF-8, разделитель запятая, ISO-даты. Детекции стримятся (не держим всё в памяти).
Приёмка: e2e открывает CSV, проверяет колонки и что no_data не превращён в 0.

## F06. Честные пометки (сквозная)
Годы < 2012 — «estimate», месяцы после SP — «preliminary», баннер версии данных, «MOCK DATA» для фикстур.

## F07. Производительность и надёжность
Бюджеты — skill perf-budget. /api/health. Ошибки API → понятное сообщение и повтор.

---
## Phase 2 (после того как Phase 1 стабильна)
F10 Raw ↔ Harmonized slider (главный wow) · F11 Sensor Lab · F12 Fire Stripes PNG/SVG + share card ·
F13 Live 24h NRT слой (через серверный прокси) · F14 Observation coverage (swath outlines FIRMS) ·
F15 «Sensor or reality?» мини-игра · F16 RU-локализация · F17 Климатологический альманах.

## API (Phase 1)
| Метод | Путь | Назначение |
|---|---|---|
| GET | /api/meta | dataset_version, покрытие, SP/NRT даты |
| GET | /api/regions?q= | поиск стран |
| GET | /api/regions/:iso3/calendar | календарь страны (кэш CDN) |
| POST | /api/aoi | {polygon|bbox|point+radius} → {aoiId, cellsCount, areaKm2, resolution} |
| GET | /api/aoi/:aoiId/calendar | календарь AOI (кэш по aoiId+version) |
| GET | /api/aoi/:aoiId/series | годовой ряд, тренд, аномалии |
| GET | /api/export/:aoiId.zip | ZIP с CSV (стрим) |
| GET | /api/health | состояние |
Календарь, ряд и метрики считает сервер; клиент только рисует.

## Модель данных (Postgres)
- `dataset_version(id, created_at, meta jsonb, is_active)`
- `cell_month(h3 bigint, year smallint, month smallint, harm real, harm_lo real, harm_hi real,
   raw_modis int, raw_viirs int, frp real, processing char(3), version_id)` PK(version_id, h3, year, month)
- `cell_month_r4` — то же для родительских ячеек r4.
- `region(iso3, name_en, name_ru, bbox, geom_blob_url)`, `region_cell(iso3, h3)`,
  `region_month(iso3, year, month, harm, harm_lo, harm_hi, raw_modis, raw_viirs, version_id)`
- `aoi(id text pk, kind, geojson jsonb, cells_compact bigint[], resolution, area_km2, created_at)`
Детекции: Parquet в Vercel Blob (решение — ADR 0002 после спайка).
