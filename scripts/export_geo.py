"""Export "where it burns" map layers from the data team's serving set into public/geo/<id>.json.

Usage (Python 3.12 venv with pandas, pyarrow, h3):
    .venv-fire-api/Scripts/python.exe scripts/export_geo.py D:/00_Inbox/fire-calendar-api-v2/data/serving

Per region, two layers of H3 res-5 cells (~250 km2), as [lon, lat, value] centroids:
  typical  - average harmonized cell-days per year over full VIIRS years (TYPICAL_YEARS);
             the team notes res-5 values before 2012 are noisy, so MODIS-only years are excluded.
  recent   - each of the last RECENT_MONTHS months: cells with value >= MIN_VALUE.
Each layer keeps the strongest cells only (caps below) and says so (`truncated`), so the file
stays small enough for a CDN and nothing is silently presented as complete.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import h3
import pandas as pd

TYPICAL_YEARS = (2013, 2025)
RECENT_MONTHS = 12
MIN_VALUE = 0.5
CAP_TYPICAL = 3000
CAP_MONTH = 1500
OUT = Path(__file__).resolve().parents[1] / "public" / "geo"


def centroid(cell: str) -> tuple[float, float]:
    lat, lon = h3.cell_to_latlng(cell)
    return round(lon, 3), round(lat, 3)


def points(series: pd.Series, cap: int) -> tuple[list[list[float]], bool]:
    s = series[series >= MIN_VALUE].sort_values(ascending=False)
    truncated = len(s) > cap
    s = s.head(cap)
    return [[*centroid(c), round(float(v), 1)] for c, v in s.items()], truncated


def export(region_dir: Path, meta: dict) -> dict:
    hx = pd.read_parquet(region_dir / "hex.parquet", columns=["h3_r5", "month", "value"])
    hx["month"] = pd.to_datetime(hx["month"])
    years = hx["month"].dt.year
    y0, y1 = TYPICAL_YEARS
    full = hx[(years >= y0) & (years <= y1)]
    typical, t_trunc = points(full.groupby("h3_r5")["value"].sum() / (y1 - y0 + 1), CAP_TYPICAL)

    last = pd.Timestamp(meta["last_month"] + "-01")
    first = last - pd.DateOffset(months=RECENT_MONTHS - 1)
    recent: dict[str, dict] = {}
    for month, grp in hx[(hx["month"] >= first) & (hx["month"] <= last)].groupby("month"):
        pts, trunc = points(grp.set_index("h3_r5")["value"], CAP_MONTH)
        recent[month.strftime("%Y-%m")] = {"pts": pts, "truncated": trunc}

    return {
        "v": 1,
        "id": meta["id"],
        "unit": "harmonized cell-days per H3 res-5 cell (~250 km2)",
        "min_value": MIN_VALUE,
        "typical": {"from": y0, "to": y1, "per": "year", "pts": typical, "truncated": t_trunc},
        "recent": recent,
        "partial_month": meta["last_month"] if meta["last_month"] > meta["last_full_month"] else None,
    }


def main() -> None:
    serving = Path(sys.argv[1])
    regions = json.loads((serving / "regions.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for meta in regions:
        d = serving / meta["id"]
        if not (d / "hex.parquet").exists():
            print(f"skip {meta['id']}: no hex.parquet")
            continue
        data = export(d, meta)
        path = OUT / f"{meta['id']}.json"
        path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        total += path.stat().st_size
    print(f"wrote {len(regions)} regions, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
