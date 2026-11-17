"""Build scripts/data/cities_world.json: capitals of the countries in data/snapshot + extra towns.

Usage:
    python scripts/build_city_list.py path/to/ne_110m_populated_places.geojson

Capital coordinates and English/Russian names come from Natural Earth (public domain,
https://www.naturalearthdata.com/, file ne_110m_populated_places, v5.1.2). Natural Earth has no
Tajik names: TG holds verified Tajik spellings for the region's capitals and falls back to the
Russian spelling elsewhere (for foreign capitals Tajik usually writes them the same way).
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TG = {
    "Kabul": "Кобул",
    "Tehran": "Теҳрон",
    "Islamabad": "Исломобод",
    "Ashgabat": "Ашқобод",
    "Baku": "Боку",
    "Ankara": "Анқара",
    "New Delhi": "Деҳлии Нав",
    "Beijing": "Пекин",
    "Riyadh": "Риёз",
    "Baghdad": "Бағдод",
    "Damascus": "Димишқ",
    "Cairo": "Қоҳира",
    "Abu Dhabi": "Абузабӣ",
    "Doha": "Доҳа",
    "Kuwait City": "Кувайт",
    "Muscat": "Масқат",
    "Sanaa": "Санъо",
}

# Tajikistan towns not among capitals (id, lat, lon, en, ru, tg).
TAJIK_TOWNS = [
    ("vahdat", 38.556, 69.019, "Vahdat", "Вахдат", "Ваҳдат"),
    ("hisor", 38.526, 68.551, "Hisor", "Гиссар", "Ҳисор"),
    ("konibodom", 40.294, 70.426, "Konibodom", "Канибадам", "Конибодом"),
    ("isfara", 40.126, 70.625, "Isfara", "Исфара", "Исфара"),
    ("danghara", 38.098, 69.332, "Danghara", "Дангара", "Данғара"),
    ("rasht", 39.040, 70.380, "Rasht", "Рашт", "Рашт"),
    ("murghob", 38.170, 73.964, "Murghob", "Мургаб", "Мурғоб"),
    ("shahritus", 37.261, 68.138, "Shahritus", "Шаартуз", "Шаҳритус"),
]


def slug(name: str) -> str:
    s = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def main() -> None:
    places = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["features"]
    index = json.loads((ROOT / "data/snapshot/index.json").read_text(encoding="utf-8"))
    by_iso2 = {
        r["names"]["iso2"]: r["id"]
        for r in index["regions"]
        if not r["id"].startswith("city_") and r["names"].get("iso2")
    }
    out = []
    for f in places:
        p = f["properties"]
        if p.get("ADM0CAP") != 1 or p.get("ISO_A2") not in by_iso2:
            continue
        en, ru = p["NAME_EN"], p["NAME_RU"]
        out.append(
            {
                "id": slug(en),
                "country": by_iso2[p["ISO_A2"]],
                "lat": round(p["LATITUDE"], 4),
                "lon": round(p["LONGITUDE"], 4),
                "names": [en, ru, TG.get(en, ru)],
            }
        )
    for cid, lat, lon, en, ru, tg in TAJIK_TOWNS:
        out.append({"id": cid, "country": "tajikistan", "lat": lat, "lon": lon, "names": [en, ru, tg]})
    target = ROOT / "scripts/data/cities_world.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)} cities -> {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
