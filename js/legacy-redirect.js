// The old site put every page in a query string on "/", so a bookmark or a
// search result looks like /?page=H&id=H031. Nothing here is served by a
// server any more, but because those URLs all land on the home page we can
// forward them from the browser.
//
//   /?page=diocese            -> the deanery list
//   /?page=H                  -> that deanery
//   /?page=H&id=H031          -> that parish
//   /?page=X&id=maps          -> the interactive map
//   /?page=parish_postcode    -> the postcode lookup
//   /?page=contact            -> contact
//
// Runs in <head> so it forwards before anything paints.
(function () {
  var params = new URLSearchParams(location.search);
  var page = params.get("page");
  if (!page) return;

  var id = params.get("id");
  var script = document.currentScript;
  var base = script ? new URL("../", script.src).href : new URL("./", location.href).href;

  function go(path) {
    location.replace(new URL(path, base).href);
  }

  if (page === "diocese") return go("html/deaneries");
  if (page === "parish_postcode") return go("html/what-parish");
  if (page === "contact") return go("html/contact");
  if (page === "X") return go("html/map");

  if (/^[A-H]$/.test(page)) {
    return id && /^[A-H]\d{3}$/.test(id)
      ? go("html/parish?id=" + encodeURIComponent(id))
      : go("html/deanery?id=" + encodeURIComponent(page));
  }
})();
