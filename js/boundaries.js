// Which parish contains a point, answered in the browser from
// data/parish-boundaries.geojson (about 60 KB gzipped).

const PARISH_BOUNDARIES_URL = "data/parish-boundaries.geojson";

let boundariesPromise = null;

function loadParishBoundaries() {
  if (!boundariesPromise) {
    boundariesPromise = fetchJSON(dataURL(PARISH_BOUNDARIES_URL));
  }
  return boundariesPromise;
}

// Ray casting. A ring after the first is a hole, so a point inside one is
// outside the polygon.
function pointInPolygon(lon, lat, rings) {
  let inside = false;
  rings.forEach((ring, index) => {
    let crossings = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % n];
      if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
        crossings++;
      }
    }
    if (crossings % 2) {
      inside = index === 0;
    }
  });
  return inside;
}

function findParishAt(lon, lat, collection) {
  for (const feature of collection.features) {
    for (const polygon of feature.geometry.coordinates) {
      if (pointInPolygon(lon, lat, polygon)) {
        return feature.properties;
      }
    }
  }
  return null;
}

// Accepts the way people actually type postcodes: "m202wq", "M20  2WQ".
function normalisePostcode(input) {
  const cleaned = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 5 || cleaned.length > 7) return null;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}

// postcodes.io is free, keyless and Open Government Licence.
async function geocodePostcode(postcode) {
  const res = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
    { cache: "no-cache" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Postcode lookup failed: ${res.status}`);
  const body = await res.json();
  return { lon: body.result.longitude, lat: body.result.latitude };
}
