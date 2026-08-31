// Postcode to parish. The geometry is loaded in the browser, so the only
// network call per search is the geocode.

function showResult(html) {
  const el = document.getElementById("result");
  el.innerHTML = html;
  el.hidden = false;
}

function outsideDiocese(postcode) {
  return `
    <h3>${escapeHTML(postcode)}</h3>
    <p>This postcode is outside the boundary of the Diocese of Salford.</p>
    <p>
      If you believe this is incorrect, please contact the
      <a href="https://www.dioceseofsalford.org.uk" target="_blank" rel="noopener">diocese</a>.
    </p>`;
}

async function search(rawInput) {
  const postcode = normalisePostcode(rawInput);
  if (!postcode) {
    showResult(`<p class="lookup-error">Please enter a full UK postcode, for example M20 2WQ.</p>`);
    return;
  }

  showResult(`<p>Looking up ${escapeHTML(postcode)}&hellip;</p>`);

  let point;
  try {
    point = await geocodePostcode(postcode);
  } catch (err) {
    console.error(err);
    showResult(`<p class="lookup-error">
      The postcode service is not responding at the moment. Please try again shortly.
    </p>`);
    return;
  }

  if (!point) {
    showResult(`<p class="lookup-error">
      ${escapeHTML(postcode)} was not recognised as a UK postcode. Please check and try again.
    </p>`);
    return;
  }

  const [collection, deaneries] = await Promise.all([loadParishBoundaries(), loadDeaneries()]);
  const parish = findParishAt(point.lon, point.lat, collection);

  if (!parish) {
    showResult(outsideDiocese(postcode));
    return;
  }

  const deanery = deaneries.find(d => d.id === parish.deaneryId);
  showResult(`
    <h3>${escapeHTML(postcode)}</h3>
    <dl class="lookup-result">
      <dt>Parish</dt><dd>${escapeHTML(parish.name)}</dd>
      <dt>Deanery</dt><dd>${escapeHTML(deanery ? deanery.name : parish.deaneryId)}</dd>
    </dl>
    <p><a href="parish?id=${encodeURIComponent(parish.id)}">View the full parish page</a></p>
    <p class="lookup-caveat">
      A postcode covers an area, so this answer is indicative. The written
      description on the parish page is the official record of the boundary.
    </p>`);
}

document.getElementById("postcodeForm").addEventListener("submit", function (event) {
  event.preventDefault();
  search(document.getElementById("postcode").value).catch(err => {
    console.error(err);
    showResult(`<p class="lookup-error">Something went wrong with the search. Please try again.</p>`);
  });
});

// Warm the boundary file while the visitor is typing.
loadParishBoundaries().catch(() => {});
