function renderChurch(church) {
  const lines = [church.name];
  if (church.address) lines.push(church.address);
  if (church.postcode) lines.push(church.postcode);
  if (church.website) lines.push(`<a href="${church.website}" target="_blank" rel="noopener">Website</a>`);
  return `<li>${lines.filter(Boolean).join("<br>")}</li>`;
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

  const churches = Array.isArray(parish.churches) ? parish.churches : [];
  document.getElementById("churchCount").textContent = `(${churches.length})`;
  const churchList = document.getElementById("churchList");
  churchList.innerHTML = churches.length
    ? churches.map(renderChurch).join("")
    : "<li>Church details will be added soon.</li>";

  const details = parish.details || "Details will be added soon.";
  document.getElementById("parishDetails").textContent = details;

  const img = document.getElementById("parishMapImg");
  const caption = document.getElementById("parishMapCaption");
  const base = location.href;
  const fallback = new URL("../assets/diocese.png", base).href;
  img.src = parish.mapImage
    ? new URL(parish.mapImage, base).href
    : (deanery?.mapImage ? new URL(deanery.mapImage, base).href : fallback);
  img.alt = parish.mapAlt || deanery?.mapAlt || `${parish.name} highlighted on the diocesan map`;

  if (caption) caption.textContent = img.alt;
})().catch(err => {
  console.error(err);
  document.getElementById("parishName").textContent = "Parish";
  document.getElementById("parishStatus").textContent = "Unavailable";
  document.getElementById("deaneryLink").textContent = "Deaneries";
  document.getElementById("deaneryLink").href = "deaneries";
  document.getElementById("churchList").innerHTML = "<li>Failed to load parish details.</li>";
  document.getElementById("parishDetails").textContent = "Details will be added soon.";
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
