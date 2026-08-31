// Whole-diocese interactive map. Deanery outlines when zoomed out, parish
// boundaries once you zoom in, and a click takes you to the parish page.

const DEANERY_BOUNDARIES_URL =
  "https://dos-boundaries.s3.eu-west-2.amazonaws.com/geojson/deaneries20181209.geojson";

// Below this resolution the parish layer takes over from the deanery layer.
const PARISH_RESOLUTION = 110;

function deaneryStyle(feature, resolution) {
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(255, 255, 255, 0.5)" }),
    stroke: new ol.style.Stroke({ color: "#3F2C39", width: resolution > PARISH_RESOLUTION ? 4 : 6 }),
    text: new ol.style.Text({
      font: "13px Calibri,sans-serif",
      text: resolution > PARISH_RESOLUTION ? feature.get("name") || "" : "",
      fill: new ol.style.Fill({ color: "#241B20" }),
      stroke: new ol.style.Stroke({ color: "#fff", width: 3 })
    })
  });
}

function initMap() {
  // Built here, not at load time: if the OpenLayers CDN is unavailable the
  // page must fall back to the message below rather than throwing.
  const parishStyle = new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(255,255,255,0.01)" }),
    stroke: new ol.style.Stroke({ color: "#5F3C53", width: 2 })
  });

  const deaneryLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: DEANERY_BOUNDARIES_URL,
      format: new ol.format.GeoJSON()
    }),
    style: deaneryStyle
  });

  const parishLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: dataURL(PARISH_BOUNDARIES_URL),
      // The file is WGS84; the map is web mercator.
      format: new ol.format.GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })
    }),
    maxResolution: PARISH_RESOLUTION,
    style: () => parishStyle
  });

  const map = new ol.Map({
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM(), maxZoom: 18, maxResolution: 700 }),
      parishLayer,
      deaneryLayer
    ],
    target: "map",
    view: new ol.View({ center: [-260745, 7125175], zoom: 9.5 })
  });

  // Frame the whole diocese whatever the screen size, rather than trusting a
  // centre and zoom tuned for one layout.
  const deanerySource = deaneryLayer.getSource();
  deanerySource.once("featuresloadend", function () {
    const extent = deanerySource.getExtent();
    if (extent.every(Number.isFinite)) {
      map.getView().fit(extent, { padding: [20, 20, 20, 20], duration: 0 });
    }
  });

  const highlight = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: feature =>
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: "#1D6A7C", width: 4 }),
        fill: new ol.style.Fill({ color: "rgba(29,106,124,0.15)" }),
        text: new ol.style.Text({
          font: "12px Calibri,sans-serif",
          text: feature.get("name") || "",
          fill: new ol.style.Fill({ color: "#241B20" }),
          stroke: new ol.style.Stroke({ color: "#fff", width: 4 })
        })
      })
  });

  const info = document.getElementById("info");
  let current;

  // Only parishes are selectable; the deanery layer is a backdrop.
  function parishAt(pixel) {
    return map.forEachFeatureAtPixel(pixel, (feature, layer) =>
      layer === parishLayer ? feature : undefined
    );
  }

  function highlightAt(pixel) {
    const feature = parishAt(pixel);
    if (feature !== current) {
      if (current) highlight.getSource().removeFeature(current);
      if (feature) highlight.getSource().addFeature(feature);
      current = feature;
    }
    if (info) {
      info.innerHTML = feature
        ? `<a href="parish?id=${encodeURIComponent(feature.get("id"))}">${escapeHTML(
            feature.get("name")
          )}</a>`
        : "Zoom in to see parish boundaries. Click a parish for its page.";
    }
    map.getTargetElement().style.cursor = feature ? "pointer" : "";
  }

  map.on("pointermove", function (evt) {
    if (evt.dragging) return;
    highlightAt(map.getEventPixel(evt.originalEvent));
  });

  map.on("click", function (evt) {
    const feature = parishAt(evt.pixel);
    if (feature) {
      location.href = `parish?id=${encodeURIComponent(feature.get("id"))}`;
    }
  });

  if (info) {
    info.textContent = "Zoom in to see parish boundaries. Click a parish for its page.";
  }
}

if (window.ol) {
  initMap();
} else {
  const info = document.getElementById("info");
  if (info) info.textContent = "The map could not be loaded.";
}
