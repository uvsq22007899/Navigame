/* =========================================================
   QUIZ.JS — GAME HOME + MATCH FLOW (CLEAN)
   - Trip -> Quiz via .trip-start--second
   - Menu hamburger <-> croix + menu dropdown
   - Click outside closes
   - Base map: normal (home/trip) <-> dark (quiz)
   - Match button -> matchmaking -> match found
   - Reveal circle (iris-like)
========================================================= */

const CHATELET = [48.8586, 2.3470];
const QUIZ_ZOOM = 15;

/* =========================
   PAGE SWITCH + REVEAL FX
========================= */
function revealTo(pageId) {
  // Switch page
  if (typeof window.showPage === "function") window.showPage(pageId);
  else {
    document.querySelectorAll("main .page").forEach(sec => {
      sec.classList.toggle("hidden", sec.id !== pageId);
    });
  }

  // Play reveal anim on target page
  const page = document.getElementById(pageId);
  if (!page) return;

  page.classList.remove("reveal-circle"); // reset if replayed
  void page.offsetWidth;                 // force reflow
  page.classList.add("reveal-circle");

  page.addEventListener(
    "animationend",
    () => page.classList.remove("reveal-circle"),
    { once: true }
  );
}

/* =========================
   QUIZ OPEN / CLOSE
========================= */
function openGameHome() {
  // 1) exit trip mode + clear route
  if (typeof setTripMode === "function") setTripMode(false);
  if (typeof clearTripRoute === "function") clearTripRoute();

  // 2) dark basemap (quiz only)
  if (typeof window.setBaseMap === "function") {
    window.setBaseMap(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20 }
    );
  }

  // 3) show quiz page
  revealTo("quiz");

  // 4) enable quiz styles + keep map draggable
  document.body.classList.add("is-quiz");
  const mapEl = document.getElementById("map");
  if (mapEl) mapEl.style.pointerEvents = "auto";

  // 5) focus + leaflet refresh
  setTimeout(() => {
    if (!window.map) return;
    window.map.setView(CHATELET, QUIZ_ZOOM, { animate: true });
    if (typeof window.map.invalidateSize === "function") window.map.invalidateSize(true);
  }, 120);
}

function leaveGame(toPage = "trip") {
  document.body.classList.remove("is-quiz");

  // back to normal basemap
  if (typeof window.setBaseMap === "function") {
    window.setBaseMap(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19 }
    );
  }

  // switch page
  revealTo(toPage);

  // leaflet refresh
  setTimeout(() => {
    if (window.map && typeof window.map.invalidateSize === "function") {
      window.map.invalidateSize(true);
    }
  }, 80);
}

/* =========================
   MAIN
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("gameMenuBtn");
  const menu = document.getElementById("gameMenu");

  function setMenuOpen(open) {
    if (!menuBtn || !menu) return;
    menuBtn.classList.toggle("is-open", open);
    menu.classList.toggle("hidden", !open);
  }

  // Trip -> Quiz
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".trip-start--second");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);
      openGameHome();
    },
    true
  );

  // Quiz -> Trip (if you keep a #quizBack)
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("#quizBack");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);
      leaveGame("trip");
    },
    true
  );

  // Toggle menu
  menuBtn?.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = menu?.classList.contains("hidden");
      setMenuOpen(!!willOpen);
    },
    true
  );

  // Click outside => close
  document.addEventListener(
    "click",
    (e) => {
      if (!menu || menu.classList.contains("hidden")) return;
      if (e.target.closest("#gameMenu") || e.target.closest("#gameMenuBtn")) return;
      setMenuOpen(false);
    },
    true
  );

  // Navbar (items inside #quiz bottom nav)
  document.addEventListener(
    "click",
    (e) => {
      const item = e.target.closest("#quiz .bottom-nav .nav-item");
      if (!item) return;

      // ✅ Match has its own handler
      if (item.id === "btnMatch") return;

      const dest = item.dataset.nav;
      if (!dest) return;

      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);

      if (dest === "quiz") openGameHome();
      else leaveGame(dest);
    },
    true
  );

  /* =========================
   MATCH -> match.html (IRIS)
   ✅ À GARDER (supprime le reste matchmaking/matchfound)
========================= */

function goToMatch() {
  const iris = document.getElementById("iris");

  // fallback si pas d'overlay
  if (!iris) {
    window.location.href = "match.html";
    return;
  }

  // reset propre (au cas où tu recliques)
  iris.classList.add("is-on");
  iris.classList.remove("is-open", "is-close");
  void iris.offsetWidth; // force reflow

  // fermeture
  iris.classList.add("is-close");

  // durée = CSS (0.85s) + marge
  setTimeout(() => {
    window.location.href = "match.html";
  }, 900);
}

// handler robuste (capture + delegation)
document.addEventListener(
  "click",
  (e) => {
    const hit = e.target.closest("#btnMatch");
    if (!hit) return;

    e.preventDefault();
    e.stopPropagation();
    goToMatch();
  },
  true
);

});
