# Diocese of Salford parish boundaries

A static site presenting the current, proposed and former parish boundaries of
the Diocese of Salford. It has no server side: every page is HTML that reads
JSON from this repository.

    index.html            home
    html/                 deaneries, deanery, parish, what-parish, map, contact
    css/                  compiled Bootstrap build, flexnav, parish page styles
    js/data.js            loaders for the JSON data
    js/parish.js          the parish page
    js/boundaries.js      the boundary layer and the point-in-parish test
    js/map.js             the interactive map
    js/what-parish.js     the postcode lookup
    data/                 deaneries, statuses, the parish index, and the
                          combined boundary layer (generated)
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

Seven files are recorded but absent from the bucket and still need locating.
The live site links these too, so they are already broken in production:

    a3/B023_20171215_a3.pdf     a3/H017_20170415_A3.pdf
    a3/G011_20170415_a3.pdf     a3/H018_20170415_A3.pdf
    a3/G016_20170415_a3.pdf     a3/H021_20170415_A3.pdf
    geojson/A010.geojson

`geojson/A010.geojson` matters most: English Martyrs, Whalley Range is a
current parish, so its map cannot be drawn.

F028's A4 turned out to be filed under `adhoc/` rather than `a4/`, and is
remapped in the generator.

## data/bespoke/

Anything the database cannot express is kept as a hand-written override,
merged over the generated record by the build:

`F022.json` — the Bolton parishes were restructured in two stages, each with
its own maps and its own descriptions in PDF and Word. The live site gives
this parish a bespoke page rather than the standard one, and so do we, via
`"template": "stages"`.

## data/parish-boundaries.geojson

Generated. Rebuild with:

    python3 tools/build_parish_boundaries.py

The diocese maintains one combined layer in S3, `geojson/parishes20220715.geojson`.
It is authoritative geometry, but it predates some approvals: 17 of its features
are keyed to the ids parishes held before they were approved (H026 for what is
now H039, B027 for B037), and Holy Apostles and Sacred Heart, Darwen are each
split across two features. The build resolves the ids, merges the split
parishes, reprojects to WGS84 and trims the precision to about a metre. The
result is all 108 current parishes in 240 KB — 57 KB gzipped — which is what
makes the postcode lookup a static file rather than a server.

One id needs care: the source file uses `F022` for Holy Infant, but this site
uses `F022` for the Bolton staged-restructuring page, so it is remapped to F002.

The result was checked against the live site's own lookup over 138 real
postcodes spread across all eight deaneries: 132 agreed, and the six that did
not are all cases where the live site returns a parish that has since been
amalgamated (St Patrick, Rochdale and St James the Lees are both closed). No
point fell inside two parishes.

## Assets outside the database

The bucket holds an `adhoc/` prefix that the CSV extracts never reference:
21 files supporting the Bolton staged restructuring, including the only Word
documents on the site. Two combined layers also exist and are not referenced
by any parish record:

    geojson/parishes20220715.geojson    110 current parishes, one file, 0.65 MB
    geojson/deaneries20181209.geojson   the 8 deanery boundaries, 0.22 MB

`parishes20220715.geojson` is the natural basis for the interactive map and
the postcode lookup, but 15 of its features are keyed to pre-approval parish
ids (H026 for H039, B027 for B037, and so on) and need remapping first.

## Running it locally

    python3 -m http.server 8000

Then open <http://localhost:8000/>.

The site works both at a domain root and under a subpath such as
`/boundaries/` on GitHub Pages: `js/data.js` derives the base from its own
script URL, and every other path is relative. Nothing should hard-code a
leading `/`.

## Still to do

The maps, boundary polygons and PDFs are still served from S3. See the
migration review for the plan to bring them into the repository.
