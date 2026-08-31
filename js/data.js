// /js/data.js

// The site is served from the domain root in production but from /boundaries/
// on GitHub Pages, so paths cannot be hard-coded either way. This script lives
// at <base>/js/data.js, so its own URL gives us the base.
const SITE_BASE = (function () {
  const self = document.currentScript
    ? document.currentScript.src
    : document.querySelector('script[src$="js/data.js"]')?.src;
  return self ? new URL("../", self).href : new URL("/", location.href).href;
})();

function dataURL(path) {
  return new URL(path, SITE_BASE).href;
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

async function loadDeaneries() {
  return fetchJSON(dataURL("data/deaneries.json"));
}

async function loadStatuses() {
  return fetchJSON(dataURL("data/statuses.json"));
}

async function loadParish(id) {
  return fetchJSON(dataURL(`parish-data/${encodeURIComponent(id)}.json`));
}

async function loadParishIndex() {
  return fetchJSON(dataURL("data/parish-index.json"));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
