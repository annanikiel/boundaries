# Diocese of Salford parish boundaries

A static site presenting the current, proposed and former parish boundaries of
the Diocese of Salford. It has no server side: every page is HTML that reads
JSON from this repository.

    index.html            home
    html/                 deaneries, deanery, parish, what-parish, map, contact
    css/                  compiled Bootstrap build, flexnav, parish page styles
    js/data.js            loaders for the JSON data
    js/parish.js          the parish page
    data/                 deaneries, statuses, and the parish index
    parish-data/          one record per parish, generated (see below)
    assets/               banners, deanery maps, and the CSV database extracts
    tools/                the generator and its supporting data

## Where the data comes from

`assets/parish_overview.csv` and `assets/parish_audit_trail.csv` are extracts
from the database behind the original site. They are the source of truth for
everything except the public parish name, status and deanery, which are curated
in `data/parish-index.json`.

`parish-data/*.json` is **generated**. Edit the CSVs or the index, then run:

    python3 tools/build_parish_data.py

Do not hand-edit files in `parish-data/` — the next build overwrites them.

Each record carries the parish's outline boundary description, the descriptions
of the internal boundaries between the parishes an amalgamation was formed
from, any note the board attached, the A3 and A4 maps, and one entry per
version in the audit trail.

## tools/s3-keys.json

The database records map filenames that do not always match the objects in the
`dos-boundaries` bucket — mostly `_a3.pdf` where the object is `_A3.pdf`, and a
couple of typos. This file maps each recorded filename onto the object that
actually exists, verified by request. 209 of the 722 recorded names needed
correcting.

Eight files are recorded but absent from the bucket and still need locating:

    a3/B023_20171215_a3.pdf     a3/H017_20170415_A3.pdf
    a3/G011_20170415_a3.pdf     a3/H018_20170415_A3.pdf
    a3/G016_20170415_a3.pdf     a3/H021_20170415_A3.pdf
    a4/F028_A4.pdf              geojson/A010.geojson

`geojson/A010.geojson` matters most: English Martyrs, Whalley Range is a
current parish, so its map cannot be drawn.

## Running it locally

    python3 -m http.server 8000

Then open <http://localhost:8000/>. The data loaders use root-relative paths,
so the server must be rooted at the repository root.

## Still to do

The maps, boundary polygons and PDFs are still served from S3. See the
migration review for the plan to bring them into the repository.
