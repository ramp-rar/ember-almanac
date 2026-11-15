# Contract validation — mock-2026-11-15a

Result: **PASS** · contract v1 · 2026-11-15T05:25:10.938Z

Delivery folder: `delivery/mock-2026-11-15a`

cell_month rows: 73764 · distinct cells: 382 · detection rows: 585555

| Check | Result | Detail |
|---|---|---|
| meta.json matches contract v1 | PASS | dataset_version mock-2026-11-15a |
| folder name equals dataset_version | PASS | folder mock-2026-11-15a, dataset_version mock-2026-11-15a |
| cell_month: columns and types | PASS | ok |
| cell_month: no NULLs | PASS | 0 rows with NULL |
| cell_month: key (h3, year, month) unique | PASS | 0 duplicate keys |
| cell_month: value ranges | PASS | 0 rows out of range |
| cell_month: no rows after nrt_through | PASS | 0 rows after 2026-11-14 |
| cell_month: lo ≤ harm ≤ hi | PASS | 0 rows violate the bounds |
| cell_month: sparse (no all-zero rows) | PASS | 0 all-zero rows |
| cell_month: enums | PASS | 0 rows with unknown source_mode/processing |
| cell_month: h3 valid at resolution 6 | PASS | 382 distinct cells |
| cell_month: nothing before coverage.MODIS.start | PASS | 0 months before 2000-11-01 |
| cell_month: rows after standard_processing_through are NRT | PASS | ok |
| detections: columns | PASS | ok |
| detections: value ranges and enums | PASS | 0 rows out of range |
| detections: monthly counts equal sum of det_*_raw (±0) | PASS | 0 months differ (by local_solar_date) |
