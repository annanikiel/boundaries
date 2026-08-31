#!/usr/bin/env python3
"""Regenerate parish-data/*.json from the CSV extracts of the old database.

Sources
    assets/parish_overview.csv     one row per parish: name, location, type,
                                   A4 map, GeoJSON, map centre and zoom
    assets/parish_audit_trail.csv  one row per parish per version: the written
                                   boundary description, the descriptions of
                                   the internal boundaries between constituent
                                   former parishes, and the A3 map
    data/parish-index.json         the curated public name, status and deanery
    data/bespoke/<id>.json         hand-written overrides for parishes the
                                   database cannot describe (see README)
    tools/s3-keys.json             CSV filename -> the object that actually
                                   exists in the bucket (see README)

Run from the repository root:  python3 tools/build_parish_data.py
"""

import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S3 = "https://dos-boundaries.s3.eu-west-2.amazonaws.com/"

# The site renumbered one parish when it was approved; the CSVs still use the
# database id. Keyed by site id.
ID_ALIASES = {"B037": "B027"}

# A handful of objects were filed under a different prefix than the database
# records. Keyed by the filename as recorded.
PREFIX_FIXES = {"a4/F028_A4.pdf": "adhoc/F028_A4.pdf"}

TYPE_TO_STATUS = {"LP": "current", "PA": "proposed", "CP": "closed", "AA": "amalgamating"}


def read_csv(name):
    with open(os.path.join(ROOT, "assets", name), newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def clean(text):
    """Undo the SQL export's doubled apostrophes and tidy whitespace."""
    if not text:
        return None
    text = text.replace("''", "'")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip() or None


def fmt_date(stamp):
    """20170415 -> 15/04/2017"""
    stamp = (stamp or "").strip()
    if len(stamp) != 8 or not stamp.isdigit():
        return None
    return f"{stamp[6:8]}/{stamp[4:6]}/{stamp[0:4]}"


def url_for(key, keymap):
    """Map a filename recorded in the CSV onto the object that really exists."""
    key = (key or "").strip()
    if not key:
        return None
    if key in PREFIX_FIXES:
        return S3 + PREFIX_FIXES[key]
    resolved = keymap.get(key, key)
    return S3 + resolved if resolved else None


def internal_boundaries(row):
    """The named boundaries between the parishes an amalgamation was formed from.

    A name with no description is kept: the board needs to see that the
    boundary is known but its description is outstanding.
    """
    slots = []
    for i in (1, 2, 3):
        name = clean(row.get(f"p_form_{i}_name"))
        desc = clean(row.get(f"p_form_{i}_desc"))
        if name or desc:
            slots.append({"name": name, "description": desc})

    # D020 and D024 were entered with the description in a later name column
    # rather than in the matching description column. Pair an unmatched name
    # with the prose that follows it.
    orphan = next((s for s in slots if s["name"] and not s["description"]), None)
    if orphan:
        stray = next(
            (
                s
                for s in slots
                if s is not orphan and s["name"] and not s["description"] and len(s["name"]) > 120
            ),
            None,
        )
        if stray:
            orphan["description"] = stray["name"]
            slots.remove(stray)

    return slots


def supplementary_note(row):
    """A titled note the board attached to the description.

    Used for things the outline boundary cannot express: areas served from a
    neighbouring diocese, a civil-parish boundary, a standing agreement, or a
    boundary that is known but not yet described.
    """
    title = clean(row.get("p_comm_name"))
    text = clean(row.get("p_comments"))
    if not title and not text:
        return None
    return {"title": title, "text": text}


def build():
    overview = {r["pid"]: r for r in read_csv("parish_overview.csv")}

    versions = {}
    for row in read_csv("parish_audit_trail.csv"):
        versions.setdefault(row["pid"], []).append(row)
    for rows in versions.values():
        rows.sort(key=lambda r: r["p_date"])

    with open(os.path.join(ROOT, "data", "parish-index.json"), encoding="utf-8") as fh:
        index = json.load(fh)
    with open(os.path.join(ROOT, "tools", "s3-keys.json"), encoding="utf-8") as fh:
        keymap = json.load(fh)["resolved"]

    outdir = os.path.join(ROOT, "parish-data")
    os.makedirs(outdir, exist_ok=True)
    for stale in os.listdir(outdir):
        if stale.endswith(".json"):
            os.remove(os.path.join(outdir, stale))

    written, gaps = 0, []

    for entry in index:
        site_id = entry["id"]
        db_id = ID_ALIASES.get(site_id, site_id)
        ov = overview.get(db_id)
        rows = versions.get(db_id, [])
        if not ov or not rows:
            gaps.append(f"{site_id}: no row in the CSV extracts")
            continue

        latest = rows[-1]

        centre = [
            float(part)
            for part in (ov.get("p_map_gj_cent") or "").split(",")
            if part.strip()
        ]
        zoom = ov.get("p_map_zoom")

        parish = {
            "id": site_id,
            "name": entry["name"],
            "shortName": clean(ov.get("p_name")),
            "location": clean(ov.get("p_loc")),
            "deaneryId": entry["deaneryId"],
            "status": entry["status"],
            "parishNumber": int(latest["p_num"]) if latest["p_num"].strip().isdigit() else None,
            "note": clean(ov.get("p_comm")),
            "maps": {
                "updated": fmt_date(ov.get("p_map_date")),
                "approval": clean(latest.get("p_status")),
                "links": {
                    "a3": url_for(latest.get("p_map_a3"), keymap),
                    "a4": url_for(ov.get("p_map_a4_file"), keymap),
                },
            },
            "boundary": {
                "description": clean(latest.get("p_main_desc")),
                "internalBoundaries": internal_boundaries(latest),
                "supplementaryNote": supplementary_note(latest),
            },
            "auditTrail": [
                {
                    "date": fmt_date(row["p_date"]),
                    "status": clean(row.get("p_status")),
                    "a3": url_for(row.get("p_map_a3"), keymap),
                    "description": clean(row.get("p_main_desc")),
                    "internalBoundaries": internal_boundaries(row),
                    "supplementaryNote": supplementary_note(row),
                }
                for row in rows
            ],
            "map": {
                "geojsonUrl": url_for(ov.get("p_map_gj_file"), keymap),
                "center": centre or None,
                "zoom": int(zoom) if str(zoom).strip().isdigit() else None,
            },
        }

        if not parish["boundary"]["description"]:
            gaps.append(f"{site_id}: no boundary description")
        if not parish["map"]["geojsonUrl"]:
            gaps.append(f"{site_id}: no GeoJSON in the bucket")
        if not parish["maps"]["links"]["a3"]:
            gaps.append(f"{site_id}: no A3 map in the bucket")
        if not parish["maps"]["links"]["a4"]:
            gaps.append(f"{site_id}: no A4 map in the bucket")

        bespoke_path = os.path.join(ROOT, "data", "bespoke", f"{site_id}.json")
        if os.path.exists(bespoke_path):
            with open(bespoke_path, encoding="utf-8") as fh:
                parish.update(json.load(fh))

        path = os.path.join(outdir, f"{site_id}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(parish, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        written += 1

    print(f"Wrote {written} parish records to parish-data/")
    if gaps:
        print(f"\n{len(gaps)} gaps to chase up:")
        for gap in gaps:
            print(f"  {gap}")
    return 0


if __name__ == "__main__":
    sys.exit(build())
