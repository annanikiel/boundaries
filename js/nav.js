// Responsive navigation, replacing the jQuery flexNav plugin.
//
// The stylesheet does the work; this only sets the classes it keys off:
//   .flexnav              collapsed (max-height 0)
//   .flexnav.flexnav-show open
//   .flexnav.opacity      faded out until we decide which state applies
//   .menu-button.active   the button while the menu is open
//
// Above the breakpoint the menu bar is always open and the button is hidden by
// the stylesheet; below it the button toggles the menu.
(function () {
  var nav = document.querySelector(".flexnav");
  var button = document.querySelector(".menu-button");
  if (!nav) return;

  var breakpoint = parseInt(nav.getAttribute("data-breakpoint"), 10) || 1080;
  var wide = window.matchMedia("(min-width: " + breakpoint + "px)");

  function open(isOpen) {
    nav.classList.toggle("flexnav-show", isOpen);
    if (button) {
      button.classList.toggle("active", isOpen);
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function apply() {
    open(wide.matches);
  }

  nav.classList.add("opacity");
  apply();

  // matchMedia rather than a resize listener: it fires only when the state
  // actually changes.
  if (wide.addEventListener) {
    wide.addEventListener("change", apply);
  } else if (wide.addListener) {
    wide.addListener(apply); // Safari before 14
  }

  if (button) {
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-controls", nav.id || "");
    button.addEventListener("click", function () {
      open(!nav.classList.contains("flexnav-show"));
    });
    button.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(!nav.classList.contains("flexnav-show"));
      }
    });
  }
})();
