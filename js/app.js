/* =========================================================
   ROUTEUR SIMPLE (sections .page) + Leaflet safe refresh
========================================================= */

function showPage(pageId) {
  // on ne touche qu'aux sections "page"
  const pages = document.querySelectorAll("main .page");
  pages.forEach(p => {
    const isTarget = p.id === pageId;
    p.classList.toggle("hidden", !isTarget);
  });

  // Refresh Leaflet à chaque switch
  setTimeout(() => {
    if (typeof window.map !== "undefined" && window.map && typeof window.map.invalidateSize === "function") {
      window.map.invalidateSize(true);
    }
  }, 80);
}
window.showPage = showPage;

/** Appelé à la fin de l'onboarding */
function finishOnboarding() {
  showPage("home");

  // init map une seule fois
  if (typeof window.initHomeMapOnce === "function") {
    window.initHomeMapOnce();
  }
}
window.finishOnboarding = finishOnboarding;

document.addEventListener("DOMContentLoaded", () => {
  // défaut: onboarding (comme ton HTML)
  // showPage("home"); // dev si besoin

  // Work (optionnel): si tu veux juste ouvrir itinerary direct
  const btnWork = document.getElementById("btn-work");
  if (btnWork) {
    btnWork.addEventListener("click", (e) => {
      // laisse home.js gérer goToWork() si tu l'utilises
      // sinon fallback:
      // e.preventDefault();
      // showPage("itinerary");
    }, true);
  }
});

