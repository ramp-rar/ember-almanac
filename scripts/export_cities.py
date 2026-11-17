"""Add city areas (a circle around the centre) to the snapshot: calendar + fire-map layers.

Usage (after `pnpm snapshot`, same venv as export_geo.py):
    .venv-fire-api/Scripts/python.exe scripts/export_cities.py D:/00_Inbox/fire-calendar-api-v2/data/serving

For each city: the H3 res-5 cells of its country whose centre lies within RADIUS_KM of the city
centre; monthly values are summed over those cells. Months, statuses and partial flags are the
country's own (data/snapshot/regions/<country>.json), so a month with no fire in the circle is a
real 0 only where the country was observed. FIRMS data is clipped to the country, so a city near a
border counts only the part inside its country — the region note says so.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import h3
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_geo import CAP_MONTH, CAP_TYPICAL, MIN_VALUE, RECENT_MONTHS, TYPICAL_YEARS, centroid  # noqa: E402

RADIUS_KM = 50
ROOT = Path(__file__).resolve().parents[1]
SNAP = ROOT / "data" / "snapshot"
GEO = ROOT / "public" / "geo"

# id, country id, lat, lon, names (en, ru, tg). Tajik names follow standard Tajik Cyrillic spelling.
CITIES = [
    ("dushanbe", "tajikistan", 38.5598, 68.7870, ("Dushanbe", "Душанбе", "Душанбе")),
    ("khujand", "tajikistan", 40.2826, 69.6222, ("Khujand", "Худжанд", "Хуҷанд")),
    ("bokhtar", "tajikistan", 37.8364, 68.7804, ("Bokhtar", "Бохтар", "Бохтар")),
    ("kulob", "tajikistan", 37.9146, 69.7845, ("Kulob", "Куляб", "Кӯлоб")),
    ("istaravshan", "tajikistan", 39.9108, 69.0064, ("Istaravshan", "Истаравшан", "Истаравшан")),
    ("panjakent", "tajikistan", 39.4950, 67.6093, ("Panjakent", "Пенджикент", "Панҷакент")),
    ("khorog", "tajikistan", 37.4897, 71.5530, ("Khorog", "Хорог", "Хоруғ")),
    ("tursunzoda", "tajikistan", 38.5100, 68.2300, ("Tursunzoda", "Турсунзаде", "Турсунзода")),
    ("almaty", "kazakhstan", 43.2389, 76.8897, ("Almaty", "Алматы", "Алмаато")),
    ("astana", "kazakhstan", 51.1694, 71.4491, ("Astana", "Астана", "Остона")),
    ("shymkent", "kazakhstan", 42.3417, 69.5901, ("Shymkent", "Шымкент", "Шимкент")),
    ("tashkent", "uzbekistan", 41.2995, 69.2401, ("Tashkent", "Ташкент", "Тошканд")),
    ("samarkand", "uzbekistan", 39.6542, 66.9597, ("Samarkand", "Самарканд", "Самарқанд")),
    ("bishkek", "kyrgyzstan", 42.8746, 74.5698, ("Bishkek", "Бишкек", "Бишкек")),
    ("osh", "kyrgyzstan", 40.5283, 72.7985, ("Osh", "Ош", "Ӯш")),
    ("houston", "texas", 29.7604, -95.3698, ("Houston", "Хьюстон", "Хюстон")),
    ("dallas", "texas", 32.7767, -96.7970, ("Dallas", "Даллас", "Даллас")),
    ("austin", "texas", 30.2672, -97.7431, ("Austin", "Остин", "Остин")),
    ("san_antonio", "texas", 29.4241, -98.4936, ("San Antonio", "Сан-Антонио", "Сан-Антонио")),
]


def all_cities() -> list:
    """The curated list above, then capitals and towns from scripts/data/cities_world.json
    (build_city_list.py), skipping any within 20 km of a city already listed."""
    out = list(CITIES)
    extra = ROOT / "scripts" / "data" / "cities_world.json"
    if extra.exists():
        for c in json.loads(extra.read_text(encoding="utf-8")):
            if any(o[0] == c["id"] or km(o[2], o[3], c["lat"], c["lon"]) < 20 for o in out):
                continue
            out.append((c["id"], c["country"], c["lat"], c["lon"], tuple(c["names"])))
    return out


def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(d))


def bbox(lat: float, lon: float, r: float) -> list[float]:
    dlat = r / 111.32
    dlon = r / (111.32 * math.cos(math.radians(lat)))
    return [round(lon - dlon, 4), round(lat - dlat, 4), round(lon + dlon, 4), round(lat + dlat, 4)]


def layer(series: pd.Series, cap: int) -> dict:
    s = series[series >= MIN_VALUE].sort_values(ascending=False)
    return {
        "pts": [[*centroid(c), round(float(v), 1)] for c, v in s.head(cap).items()],
        "truncated": len(s) > cap,
    }


def main() -> None:
    serving = Path(sys.argv[1])
    index = json.loads((SNAP / "index.json").read_text(encoding="utf-8"))
    regions = [r for r in index["regions"] if not r["id"].startswith("city_")]
    by_id = {r["id"]: r for r in regions}
    added = []
    for cid, country, lat, lon, (en, ru, tg) in all_cities():
        if country not in by_id:
            print(f"skip {cid}: country {country} not in snapshot")
            continue
        hx = pd.read_parquet(serving / country / "hex.parquet", columns=["h3_r5", "month", "value"])
        hx["month"] = pd.to_datetime(hx["month"])
        cells = [c for c in hx["h3_r5"].unique() if km(lat, lon, *h3.cell_to_latlng(c)) <= RADIUS_KM]
        # Cells of the circle that never had fire are not in the table; count every cell in reach.
        reach = h3.grid_disk(h3.latlng_to_cell(lat, lon, 5), 6)
        in_circle = [c for c in reach if km(lat, lon, *h3.cell_to_latlng(c)) <= RADIUS_KM]
        sub = hx[hx["h3_r5"].isin(cells)]
        monthly = sub.groupby(sub["month"].dt.strftime("%Y-%m"))["value"].sum()

        base = json.loads((SNAP / "regions" / f"{country}.json").read_text(encoding="utf-8"))
        calendar = [
            {**row, "value": round(float(monthly.get(row["month"], 0.0)), 1)}
            for row in base["calendar"]
        ]
        rid = f"city_{cid}"
        (SNAP / "regions" / f"{rid}.json").write_text(
            json.dumps({"calendar": calendar, "forecast": None, "anomalies": None}), encoding="utf-8"
        )

        # Fire-map layers for the circle, same format as export_geo.py.
        years = sub["month"].dt.year
        y0, y1 = TYPICAL_YEARS
        typical = sub[(years >= y0) & (years <= y1)].groupby("h3_r5")["value"].sum() / (y1 - y0 + 1)
        folder = GEO / rid
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.json"):
            old.unlink()
        last = pd.Timestamp(by_id[country]["last_month"] + "-01") if "last_month" in by_id[country] else sub["month"].max()
        first = last - pd.DateOffset(months=RECENT_MONTHS - 1)
        months = []
        for month, grp in sub[(sub["month"] >= first) & (sub["month"] <= last)].groupby("month"):
            key = month.strftime("%Y-%m")
            months.append(key)
            (folder / f"{key}.json").write_text(
                json.dumps(layer(grp.set_index("h3_r5")["value"], CAP_MONTH), separators=(",", ":")),
                encoding="utf-8",
            )
        partial = by_id[country]["last_full_month"] < calendar[-1]["month"] and calendar[-1]["partial"]
        (folder / "index.json").write_text(
            json.dumps(
                {
                    "v": 1,
                    "id": rid,
                    "unit": "harmonized cell-days per H3 res-5 cell (~250 km2)",
                    "min_value": MIN_VALUE,
                    "typical": {"from": y0, "to": y1, "per": "year", **layer(typical, CAP_TYPICAL)},
                    "months": sorted(months),
                    "partial_month": calendar[-1]["month"] if partial else None,
                },
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        added.append(
            {
                "id": rid,
                "name": f"{en} ({RADIUS_KM} km)",
                "data_end": by_id[country]["data_end"],
                "last_full_month": by_id[country]["last_full_month"],
                "first_month": by_id[country]["first_month"],
                "bbox": bbox(lat, lon, RADIUS_KM),
                "hexes_r5": len(in_circle),
                "group": "city",
                "country": country,
                "names": {
                    "en": f"{en} · {RADIUS_KM} km",
                    "ru": f"{ru} · {RADIUS_KM} км",
                    "tg": f"{tg} · {RADIUS_KM} км",
                },
            }
        )
        print(f"{rid}: {len(cells)} cells with fire of {len(in_circle)} in the circle")

    index["regions"] = regions + added
    (SNAP / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"cities: {len(added)}")


if __name__ == "__main__":
    main()
