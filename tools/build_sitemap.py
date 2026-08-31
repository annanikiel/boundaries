#!/usr/bin/env python3
"""Write sitemap.xml: the fixed pages, the eight deaneries, and every parish.

The site URL is read from the CNAME file when there is one, so this keeps
working when the custom domain is set up. Run from the repository root:

    python3 tools/build_sitemap.py
"""

import datetime
import json
import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FALLBACK_SITE = "https://annanikiel.github.io/boundaries"


def site_url():
    cname = os.path.join(ROOT, "CNAME")
    if os.path.exists(cname):
        with open(cname, encoding="utf-8") as fh:
            host = fh.read().strip()
        if host:
            return f"https://{host}"
    return FALLBACK_SITE


def build():
    base = site_url().rstrip("/")
    today = datetime.date.today().isoformat()

    with open(os.path.join(ROOT, "data", "deaneries.json"), encoding="utf-8") as fh:
        deaneries = json.load(fh)
    with open(os.path.join(ROOT, "data", "parish-index.json"), encoding="utf-8") as fh:
        parishes = json.load(fh)

    # Extensionless, matching the links the site itself uses.
    urls = [
        (f"{base}/", "0.9"),
        (f"{base}/html/deaneries", "0.8"),
        (f"{base}/html/map", "0.8"),
        (f"{base}/html/what-parish", "0.8"),
        (f"{base}/html/contact", "0.4"),
    ]
    urls += [
        (f"{base}/html/deanery?id={d['id']}", "0.7")
        for d in sorted(deaneries, key=lambda d: d.get("order", 999))
    ]
    # Current parishes first: they are what people are usually looking for.
    rank = {"current": 0, "proposed": 1, "closed": 2}
    for parish in sorted(parishes, key=lambda p: (rank.get(p["status"], 3), p["id"])):
        priority = "0.6" if parish["status"] == "current" else "0.3"
        urls.append((f"{base}/html/parish?id={parish['id']}", priority))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, priority in urls:
        lines += [
            "  <url>",
            f"    <loc>{escape(loc)}</loc>",
            f"    <lastmod>{today}</lastmod>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")

    out = os.path.join(ROOT, "sitemap.xml")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"Wrote sitemap.xml: {len(urls)} URLs under {base}")
    return 0


if __name__ == "__main__":
    sys.exit(build())
