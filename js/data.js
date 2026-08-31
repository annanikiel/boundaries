// /js/data.js
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

async function loadDeaneries() {
  return fetchJSON("/data/deaneries.json");
}

async function loadStatuses() {
  return fetchJSON("/data/statuses.json");
}

async function loadParish(id) {
  return fetchJSON(`/parish-data/${id}.json`);
}

async function loadParishIndex() {
  return fetchJSON("/data/parish-index.json");
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