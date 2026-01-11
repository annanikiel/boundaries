function formatUpdated(maps) {
  if (!maps?.updated) {
    return "Unavailable";
  }
  return maps.approval ? `${maps.updated} - ${maps.approval}` : maps.updated;
}

function renderMapLinks(links) {
  const output = [];
  if (links?.a3) output.push(`<a href="${links.a3}" target="_blank" rel="noopener">A3</a>`);
  if (links?.a4) output.push(`<a href="${links.a4}" target="_blank" rel="noopener">A4</a>`);
  return output.length ? output.join(" | ") : "No maps available";
}

function renderAuditTrail(trail) {
  if (!trail?.length) {
    return null;
  }

  return trail.map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }

    const parts = [];
    if (entry.date) {
      parts.push(entry.date);
    }
    if (entry.status) {
      parts.push(entry.status);
    }
    if (entry.note) {
      parts.push(entry.note);
    }
    return parts.filter(Boolean).join(" - ");
  }).filter(Boolean);
}

function initParishMap(parish) {
  if (!window.ol || !parish.map?.geojsonUrl) {
    return;
  }

  const style = new ol.style.Style({
    fill: new ol.style.Fill({
      color: "rgba(255, 255, 255, 0.7)"
    }),
    stroke: new ol.style.Stroke({
      color: "#5F3C53",
      width: 3
    }),
    text: new ol.style.Text({
      font: "12px Calibri,sans-serif",
      fill: new ol.style.Fill({
        color: "#000"
      }),
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 3
      })
    })
  });

  const vectorLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: parish.map.geojsonUrl,
      format: new ol.format.GeoJSON()
    }),
    style: function(feature, resolution) {
      style.getText().setText(resolution < 50 ? feature.get("Name") : "");
      return style;
    }
  });

  const map = new ol.Map({
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
        maxZoom: 16,
        maxResolution: 500
      }),
      vectorLayer
    ],
    target: "map",
    view: new ol.View({
      center: parish.map.center,
      zoom: parish.map.zoom
    })
  });

  const highlightStyleCache = {};
  const featureOverlay = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: function(feature, resolution) {
      const text = resolution < 5000 ? feature.get("Name") : "";
      if (!highlightStyleCache[text]) {
        highlightStyleCache[text] = new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: "#5F3C53",
            width: 1
          }),
          fill: new ol.style.Fill({
            color: "rgba(95,60,83,0.5)"
          }),
          text: new ol.style.Text({
            font: "12px Calibri,sans-serif",
            text: text,
            fill: new ol.style.Fill({
              color: "#fff"
            }),
            stroke: new ol.style.Stroke({
              color: "#835975",
              width: 3
            })
          })
        });
      }
      return highlightStyleCache[text];
    }
  });

  let highlight;
  const displayFeatureInfo = function(pixel) {
    const feature = map.forEachFeatureAtPixel(pixel, function(featureAtPixel) {
      return featureAtPixel;
    });

    if (feature !== highlight) {
      if (highlight) {
        featureOverlay.getSource().removeFeature(highlight);
      }
      if (feature) {
        featureOverlay.getSource().addFeature(feature);
      }
      highlight = feature;
    }
  };

  map.on("pointermove", function(evt) {
    if (evt.dragging) {
      return;
    }
    const pixel = map.getEventPixel(evt.originalEvent);
    displayFeatureInfo(pixel);
  });

  map.on("click", function(evt) {
    displayFeatureInfo(evt.pixel);
  });
}

(async function () {
  const parishId = qs("id");
  if (!parishId) {
    throw new Error("Missing parish id");
  }

  const [parish, deaneries, statuses] = await Promise.all([
    loadParish(parishId),
    loadDeaneries(),
    loadStatuses()
  ]);

  const deanery = deaneries.find(d => d.id === parish.deaneryId);
  const statusLabel = statuses?.[parish.status]?.label || parish.status || "Parish";

  document.title = `${parish.name} | Diocese of Salford Parish Boundaries`;
  document.getElementById("parishName").textContent = parish.name;
  document.getElementById("parishStatus").textContent = statusLabel;

  const deaneryLink = document.getElementById("deaneryLink");
  deaneryLink.textContent = deanery ? deanery.name : "Deanery";
  deaneryLink.href = deanery ? `deanery?id=${encodeURIComponent(deanery.id)}` : "deaneries";

  document.getElementById("parishUpdated").textContent = formatUpdated(parish.maps);
  document.getElementById("parishMaps").innerHTML = renderMapLinks(parish.maps?.links);

  const descriptionEl = document.getElementById("parishDescription");
  if (parish.description?.available === false) {
    descriptionEl.textContent = "Not available";
  } else {
    descriptionEl.innerHTML = `<a href="parish-description?id=${encodeURIComponent(parish.id)}">View description</a>`;
  }

  const auditTrailBlock = document.getElementById("parishAuditTrailBlock");
  const auditTrailLines = renderAuditTrail(parish.auditTrail);
  if (!auditTrailLines) {
    auditTrailBlock.style.display = "none";
  } else {
    document.getElementById("parishAuditTrail").innerHTML = auditTrailLines.join("<br />");
  }

  initParishMap(parish);
})().catch(err => {
  console.error(err);
  document.getElementById("parishName").textContent = "Parish";
  document.getElementById("parishStatus").textContent = "Unavailable";
  document.getElementById("deaneryLink").textContent = "Deaneries";
  document.getElementById("deaneryLink").href = "deaneries";
  document.getElementById("parishUpdated").textContent = "Unavailable";
  document.getElementById("parishMaps").textContent = "No maps available";
  document.getElementById("parishDescription").textContent = "Not available";
  document.getElementById("parishAuditTrailBlock").style.display = "none";
});

$(".flexnav").flexNav({
  animationSpeed: 250, // default for drop down animation speed
  transitionOpacity: true, // default for opacity animation
  buttonSelector: ".menu-button", // default menu button class name
  hoverIntent: false, // Change to true for use with hoverIntent plugin
  hoverIntentTimeout: 150, // hoverIntent default timeout
  calcItemWidths: true, // dynamically calcs top level nav item widths
  hover: true // would you like hover support?
});
