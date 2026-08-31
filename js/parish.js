// Parish page. Renders one record from parish-data/{id}.json.

function setText(id, value, fallback) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || fallback || "";
}

function formatUpdated(maps) {
  if (!maps?.updated) return "Unavailable";
  return maps.approval ? `${maps.updated} – ${maps.approval}` : maps.updated;
}

function renderMapLinks(links) {
  const parts = [];
  if (links?.a3) parts.push(`<a href="${escapeHTML(links.a3)}" target="_blank" rel="noopener">A3</a>`);
  if (links?.a4) parts.push(`<a href="${escapeHTML(links.a4)}" target="_blank" rel="noopener">A4</a>`);
  return parts.length ? parts.join("") : `<span class="unavailable">No maps available</span>`;
}

// A parish formed by amalgamation carries a description of each boundary
// between the parishes it was formed from, and sometimes a titled note for
// something the outline boundary cannot express.
function renderBoundaryExtras(boundary) {
  const blocks = [];

  (boundary?.internalBoundaries || []).forEach(entry => {
    const body = entry.description
      ? `<div class="boundary-text">${escapeHTML(entry.description)}</div>`
      : `<p class="boundary-missing">No description is currently available for this boundary.</p>`;
    blocks.push(`
      <div class="boundary-subsection">
        <h4>${escapeHTML(entry.name || "Internal boundary")}</h4>
        ${body}
      </div>`);
  });

  const note = boundary?.supplementaryNote;
  if (note && (note.title || note.text)) {
    const body = note.text
      ? `<div class="boundary-text">${escapeHTML(note.text)}</div>`
      : "";
    blocks.push(`
      <div class="boundary-subsection">
        <h4>${escapeHTML(note.title || "Note")}</h4>
        ${body}
      </div>`);
  }

  return blocks.join("");
}

// F022 (Bolton parishes) is not a single boundary but a staged restructuring,
// each stage with its own maps and descriptions in several formats.
function renderStages(stages) {
  return (stages || []).map(stage => {
    const state = stage.state ? ` <span class="stage-state">(${escapeHTML(stage.state)})</span>` : "";
    const groups = (stage.groups || []).map(group => {
      const items = (group.items || []).map(item => {
        const links = (item.links || [])
          .map(l => `<a href="${escapeHTML(l.url)}" target="_blank" rel="noopener">${escapeHTML(l.label)}</a>`)
          .join("");
        return `<li><span class="stage-item">${escapeHTML(item.label)}:</span> <span class="map-links">${links}</span></li>`;
      }).join("");
      return `<h5>${escapeHTML(group.heading)}</h5><ul class="stage-list">${items}</ul>`;
    }).join("");
    return `
      <section class="stage">
        <h4>${escapeHTML(stage.title)}${state}</h4>
        <p class="stage-summary">${escapeHTML(stage.summary || "")}</p>
        ${groups}
      </section>`;
  }).join("");
}

// Every version except the current one, newest first.
function renderAuditTrail(trail) {
  const superseded = (trail || []).slice(0, -1).reverse();
  if (!superseded.length) return "";

  return superseded.map(entry => {
    const status = entry.status ? ` <span class="audit-status">(${escapeHTML(entry.status)})</span>` : "";
    const map = entry.a3
      ? `<p><a href="${escapeHTML(entry.a3)}" target="_blank" rel="noopener">A3 map as at this date</a></p>`
      : `<p class="unavailable">The map for this version is not available.</p>`;
    const description = entry.description
      ? `<div class="boundary-text">${escapeHTML(entry.description)}</div>`
      : "";
    return `
      <details class="audit-entry">
        <summary>${escapeHTML(entry.date || "Undated")}${status}</summary>
        <div class="audit-body">
          ${map}
          ${description}
          ${renderBoundaryExtras(entry)}
        </div>
      </details>`;
  }).join("");
}

function initParishMap(parish) {
  if (!window.ol || !parish.map?.geojsonUrl || !parish.map?.center) return;

  const style = new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(255, 255, 255, 0.7)" }),
    stroke: new ol.style.Stroke({ color: "#5F3C53", width: 3 }),
    text: new ol.style.Text({
      font: "12px Calibri,sans-serif",
      fill: new ol.style.Fill({ color: "#000" }),
      stroke: new ol.style.Stroke({ color: "#fff", width: 3 })
    })
  });

  const vectorLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: parish.map.geojsonUrl,
      format: new ol.format.GeoJSON()
    }),
    style: function (feature, resolution) {
      style.getText().setText(resolution < 50 ? feature.get("Name") : "");
      return style;
    }
  });

  const map = new ol.Map({
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM(), maxZoom: 16, maxResolution: 500 }),
      vectorLayer
    ],
    target: "map",
    view: new ol.View({ center: parish.map.center, zoom: parish.map.zoom || 12 })
  });

  const highlightStyleCache = {};
  const featureOverlay = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: function (feature, resolution) {
      const text = resolution < 5000 ? feature.get("Name") : "";
      if (!highlightStyleCache[text]) {
        highlightStyleCache[text] = new ol.style.Style({
          stroke: new ol.style.Stroke({ color: "#5F3C53", width: 1 }),
          fill: new ol.style.Fill({ color: "rgba(95,60,83,0.5)" }),
          text: new ol.style.Text({
            font: "12px Calibri,sans-serif",
            text: text,
            fill: new ol.style.Fill({ color: "#fff" }),
            stroke: new ol.style.Stroke({ color: "#835975", width: 3 })
          })
        });
      }
      return highlightStyleCache[text];
    }
  });

  let highlight;
  function displayFeatureInfo(pixel) {
    const feature = map.forEachFeatureAtPixel(pixel, f => f);
    if (feature !== highlight) {
      if (highlight) featureOverlay.getSource().removeFeature(highlight);
      if (feature) featureOverlay.getSource().addFeature(feature);
      highlight = feature;
    }
  }

  map.on("pointermove", function (evt) {
    if (evt.dragging) return;
    displayFeatureInfo(map.getEventPixel(evt.originalEvent));
  });
  map.on("click", function (evt) {
    displayFeatureInfo(evt.pixel);
  });
}

(async function () {
  const parishId = qs("id");
  if (!parishId) throw new Error("Missing parish id");

  const [parish, deaneries, statuses] = await Promise.all([
    loadParish(parishId),
    loadDeaneries(),
    loadStatuses()
  ]);

  const deanery = deaneries.find(d => d.id === parish.deaneryId);
  const statusLabel = statuses?.[parish.status]?.label || parish.status || "Parish";

  document.title = `${parish.name} | Diocese of Salford Parish Boundaries`;
  setText("parishName", parish.name, "Parish");
  setText("parishStatus", statusLabel);

  const deaneryLink = document.getElementById("deaneryLink");
  deaneryLink.textContent = deanery ? deanery.name : "Deaneries";
  deaneryLink.href = deanery ? `deanery?id=${encodeURIComponent(deanery.id)}` : "deaneries";

  if (parish.note) {
    setText("parishNoteText", parish.note);
    document.getElementById("parishNote").hidden = false;
  }

  setText("parishUpdated", formatUpdated(parish.maps), "Unavailable");
  document.getElementById("parishMaps").innerHTML = renderMapLinks(parish.maps?.links);

  const description = document.getElementById("boundaryDescription");
  if (parish.template === "stages") {
    description.classList.remove("boundary-text");
    description.innerHTML =
      (parish.intro ? `<p>${escapeHTML(parish.intro)}</p>` : "") + renderStages(parish.stages);
  } else if (parish.boundary?.description) {
    description.textContent = parish.boundary.description;
  } else {
    description.innerHTML = `<p class="boundary-missing">The written description for this parish is not yet available.</p>`;
  }
  document.getElementById("boundaryExtras").innerHTML = renderBoundaryExtras(parish.boundary);

  const auditTrail = renderAuditTrail(parish.auditTrail);
  if (auditTrail) {
    document.getElementById("parishAuditTrail").innerHTML = auditTrail;
    document.getElementById("parishAuditTrailBlock").hidden = false;
  }

  initParishMap(parish);
})().catch(err => {
  console.error(err);
  setText("parishName", "Parish not found");
  setText("parishStatus", "Unavailable");
  setText("parishUpdated", "Unavailable");
  document.getElementById("parishMaps").innerHTML = `<span class="unavailable">No maps available</span>`;
  document.getElementById("boundaryDescription").innerHTML =
    `<p class="boundary-missing">This parish could not be loaded. Please return to the <a href="deaneries">list of deaneries</a>.</p>`;
});
