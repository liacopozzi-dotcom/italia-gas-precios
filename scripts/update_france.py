!/usr/bin/env python3
"""
Downloads all French gas station data from the French government API
and saves it as a compact JSON for AppViaje.
Run daily via GitHub Actions — result goes to france_gasolineras.json in the repo root.
"""
import requests
import json

EXPORT_URL = (
    "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"
    "/prix-des-carburants-en-france-flux-instantane-v2/exports/json"
)
OUTPUT_FILE = "france_gasolineras.json"


def parse_price(value):
    if value is None:
        return None
    try:
        return round(float(value), 4)
    except (TypeError, ValueError):
        return None


def main():
    print("Fetching France gas stations from government API...")
    response = requests.get(EXPORT_URL, timeout=120)
    response.raise_for_status()

    raw_data = response.json()
    print(f"Downloaded {len(raw_data)} raw records")

    stations = []
    for row in raw_data:
        # Coordinates from geom object (decimal degrees, reliable)
        geom = row.get("geom") or {}
        lat = geom.get("lat")
        lon = geom.get("lon")

        # Fallback: integer fields are degrees x100000
        if not lat and row.get("latitude"):
            try:
                lat = int(row["latitude"]) / 100000
            except (TypeError, ValueError):
                pass
        if not lon and row.get("longitude"):
            try:
                lon = int(row["longitude"]) / 100000
            except (TypeError, ValueError):
                pass

        if not lat or not lon:
            continue

        stations.append({
            "id": str(row.get("id", "")),
            "lat": round(float(lat), 6),
            "lon": round(float(lon), 6),
            "ville": (row.get("ville") or "").strip(),
            "adresse": (row.get("adresse") or "").strip(),
            "pop": row.get("pop") or "R",
            "dep": str(row.get("code_departement") or ""),
            "gazole_prix": parse_price(row.get("gazole_prix")),
            "sp95_prix":   parse_price(row.get("sp95_prix")),
            "sp98_prix":   parse_price(row.get("sp98_prix")),
            "gplc_prix":   parse_price(row.get("gplc_prix")),
            "e10_prix":    parse_price(row.get("e10_prix")),
        })

    print(f"Processed {len(stations)} valid stations")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(stations, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
