# Data contract: science team → full-stack

Версия контракта: **v1**. Любое изменение — только с повышением версии и записью в `docs/adr/`.
Скрипт `pnpm contract:validate <dir>` проверяет поставку ДО загрузки в базу. Невалидная поставка не грузится.

## Поставка (папка `delivery/<dataset_version>/`)

### 1. `meta.json` (обязательно)
```json
{
  "contract_version": "1",
  "dataset_version": "2026-11-15a",
  "harmonization": {
    "method": "log-linear per month, chain Aqua→S-NPP→NOAA-20",
    "unit": "harmonized fire-days, VIIRS(NOAA-20)-equivalent",
    "h3_resolution": 6,
    "baseline_years": [2003, 2025]
  },
  "coverage": {
    "MODIS":        { "start": "2000-11-01", "end": null },
    "VIIRS_SNPP":   { "start": "2012-01-20", "end": "2026-11-02" },
    "VIIRS_NOAA20": { "start": "2018-04-01", "end": null },
    "VIIRS_NOAA21": { "start": "2023-03-01", "end": null }
  },
  "standard_processing_through": "2026-06-30",
  "nrt_through": "2026-11-14",
  "estimate_before_year": 2012,
  "missing_days": [{ "date": "2016-02-11", "platform": "VIIRS_SNPP" }],
  "region_bbox": [46.0, 35.0, 88.0, 56.0]
}
```
Даты покрытия сверять со страницей FIRMS Archive Download на дату поставки.

### 2. `cell_month.parquet` (обязательно)
| колонка | тип | правило |
|---|---|---|
| h3 | string (hex H3) | разрешение = `meta.harmonization.h3_resolution` |
| year | int16 | 2000–2026 |
| month | int8 | 1–12 |
| fire_days_harm | float32 | ≥ 0, гармонизированное значение |
| fire_days_harm_lo / _hi | float32 | lo ≤ harm ≤ hi |
| det_modis_raw / det_viirs_raw | int32 | ≥ 0, сырые детекции после фильтров |
| frp_sum_mw | float32 | ≥ 0 |
| source_mode | enum | `modis_only` / `overlap` / `viirs_only` |
| processing | enum | `SP` / `NRT` |

Ключ: (h3, year, month) уникален. Строк с нулями НЕ присылать (разреженный формат);
отсутствие строки = 0, если месяц покрыт наблюдениями, иначе статус решает `meta`.

### 3. `detections/year=YYYY/*.parquet` (обязательно для выгрузки CSV)
`lat, lon, acq_date_utc, acq_time_utc, local_solar_date, satellite, instrument, confidence_raw,
confidence_norm(low|nominal|high), frp_mw, daynight(D|N), type(0..3), processing(SP|NRT), h3`
Только записи, прошедшие фильтры команды. Фильтры описать в `meta.harmonization`.

### 4. `regions.geojson` (опционально; иначе берём geoBoundaries ADM0)
Страны (и по желанию ADM1) с `iso3`, `name_en`, `name_ru`.

## Проверки валидатора
- схема и типы; уникальность ключа; диапазоны; `lo ≤ harm ≤ hi`;
- `h3` валиден и нужного разрешения;
- нет данных раньше `coverage.MODIS.start`;
- все строки после `standard_processing_through` имеют `processing = NRT`;
- суммы `det_*_raw` по (year, month) совпадают с числом строк в `detections/` (±0);
- отчёт: `docs/reviews/contract-<dataset_version>.md`.
