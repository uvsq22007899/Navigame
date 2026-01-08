/* =========================================================
   ROUTEUR SIMPLE (pages en <section>) + navigation
   - Onboarding -> Home
   - Home -> Itinerary (bouton Travail)
   - Itinerary -> Home (bouton back)
========================================================= */

function showPage(pageId) {
  const pages = document.querySelectorAll("main .page");
  pages.forEach(p => p.classList.add("hidden"));

  const target = document.getElementById(pageId);
  if (!target) return;
  target.classList.remove("hidden");
}

/** Appelé à la fin de l'onboarding */
function finishOnboarding() {
  showPage("home");

  // ta map Leaflet ne doit s'init qu'une fois
  if (typeof window.initHomeMapOnce === "function") {
    window.initHomeMapOnce();
  }
}
window.finishOnboarding = finishOnboarding;

document.addEventListener("DOMContentLoaded", () => {
  // Par défaut : onboarding visible (comme ton HTML)
  // Si tu veux forcer home en dev : showPage("home");

  const btnWork = document.getElementById("btn-work");
  const btnBackHome = document.getElementById("btn-back-home");

  if (btnWork) {
    btnWork.addEventListener("click", () => {
      showPage("itinerary");
    });
  }

  if (btnBackHome) {
    btnBackHome.addEventListener("click", () => {
      showPage("home");

      // petit fix Leaflet au retour (sinon carte parfois “cassée” en size)
      if (typeof window.map !== "undefined" && window.map && typeof window.map.invalidateSize === "function") {
        setTimeout(() => window.map.invalidateSize(true), 50);
      }
    });
  }
});
