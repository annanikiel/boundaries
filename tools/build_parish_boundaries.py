#!/usr/bin/env python3
"""Build data/parish-boundaries.geojson: the current parish boundaries, keyed
by the ids this site uses.

The diocese maintains one combined layer in S3, geojson/parishes20220715.geojson.
It is authoritative geometry, but it predates some approvals, so 15 of its
features are keyed to the ids the parishes held before they were approved
(H026 for what is now H039, B027 for B037, and so on), and a few parishes are
split across two features. This script resolves both, reprojects from EPSG:3857
to WGS84, drops the unused Z ordinate and trims the coordinate precision to
about a metre.

Run from the repository root:  python3 tools/build_parish_boundaries.py
"""

import json
import math
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = "https://dos-boundaries.s3.eu-west-2.amazonaws.com/geojson/parishes20220715.geojson"
OUT = os.path.join(ROOT, "data", "parish-boundaries.geojson")

# Features whose id predates the parish's approval, or which are one of several
# polygons making up a single parish. Source feature id -> this site's id.
# Established by matching the dedication and place against the parish index.
RENAMES = {
    "B017": "B024",  # St Luke and Ss Peter and Paul -> The Three Martyrs
    "B027": "B037",  # Our Lady of Hope, Salford
    "C021": "C022",
    "D005": "D026",  # St James the Lees, Rawtenstall  -> Holy Apostles
    "D009": "D026",  # St Joseph and St Peter, Newchurch -> Holy Apostles
    "D022": "D025",
    "E017": "E022",
    "E018": "E023",
    "F021": "F026",  # Corpus Christi, Bromley Cross
    "F022": "F002",  # Holy Infant — the site reuses F022 for the Bolton
                     # staged-restructuring page, so this must be remapped
    "F023": "F028",
    "F025": "F027",
    "G006": "G024",
    "H026": "H039",
    "H027": "H037",
    "H029": "H038",
    "H030": "H035",  # Sacred Heart, Darwen — a second polygon of the same parish
}


def to_wgs84(x, y):
    lon = x / 20037508.34 * 180
    lat = y / 20037508.34 * 180
    lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180)) - math.pi / 2)
    return [round(lon, 5), round(lat, 5)]


def convert(coords):
    if isinstance(coords[0], (int, float)):
        return to_wgs84(coords[0], coords[1])
    return [convert(part) for part in coords]


def polygons(geometry):
    """Every feature reduced to a list of polygons."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return list(geometry["coordinates"])
    raise ValueError(f"unexpected geometry {geometry['type']}")


def build():
    with open(os.path.join(ROOT, "data", "parish-index.json"), encoding="utf-8") as fh:
        index = {p["id"]: p for p in json.load(fh)}

    print(f"Fetching {SOURCE}")
    with urllib.request.urlopen(SOURCE, timeout=120) as resp:
        source = json.load(resp)
    print(f"  {len(source['features'])} features")

    merged = {}
    for feature in source["features"]:
        props = feature["properties"]
        source_id = props["id"]
        site_id = RENAMES.get(source_id, source_id)
        entry = merged.setdefault(
            site_id,
            {"polygons": [], "sources": [], "name": props.get("name"), "dean": props.get("dean")},
        )
        entry["polygons"].extend(convert(p) for p in polygons(feature["geometry"]))
        entry["sources"].append(source_id)

    features, gaps = [], []
    for site_id, entry in sorted(merged.items()):
        listing = index.get(site_id)
        if not listing:
            gaps.append(f"{site_id}: geometry present but not in the parish index")
            continue
        if listing["status"] != "current":
            gaps.append(f"{site_id}: geometry present but listed as {listing['status']}")
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": site_id,
                    "name": listing["name"],
                    "deaneryId": listing["deaneryId"],
                },
                "geometry": {"type": "MultiPolygon", "coordinates": entry["polygons"]},
            }
        )

    covered = {f["properties"]["id"] for f in features}
    for pid, listing in sorted(index.items()):
        if listing["status"] == "current" and pid not in covered:
            gaps.append(f"{pid}: current parish with no geometry ({listing['name']})")

    out = {"type": "FeatureCollection", "features": features}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
        fh.write("\n")

    size = os.path.getsize(OUT)
    print(f"Wrote {len(features)} parishes to data/parish-boundaries.geojson ({size/1e6:.2f} MB)")
    if gaps:
        print(f"\n{len(gaps)} gaps:")
        for gap in gaps:
            print(f"  {gap}")
    return 0


if __name__ == "__main__":
    sys.exit(build())
