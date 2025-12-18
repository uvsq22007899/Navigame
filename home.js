/* =========================
   MAP (Leaflet)
========================= */
let mapInited = false;
let map;

function initHomeMapOnce() {
  if (mapInited) return;
  mapInited = true;

  const fallback = [48.8566, 2.3522]; // Paris

  map = L.map("map", { zoomControl: false }).setView(fallback, 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = [pos.coords.latitude, pos.coords.longitude];
        map.setView(me, 14);
        L.circleMarker(me, { radius: 7 }).addTo(map);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }
}

window.initHomeMapOnce = initHomeMapOnce;

/* =========================
   BOTTOM SHEET (drag mobile)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const sheet = document.querySelector(".sheet");
  const handle = document.querySelector(".sheet-handle");
  const grabZone = document.querySelector(".sheet-grab-zone");
  const mapEl = document.getElementById("map");

  if (!sheet || !handle) return;

  // Positions en % écran
  const positions = {
    open: 0,    // plein écran
    mid: 25,    // position normale
    peek: 65    // presque fermé
  };

  let state = "mid";
  let isDragging = false;
  let startY = 0;
  let startTranslate = positions[state];

  sheet.style.transform = `translateY(${positions[state]}%)`;

  function getY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function getCurrentTranslate() {
    const transform = window.getComputedStyle(sheet).transform;
    if (transform === "none") return positions[state];
    const matrix = transform.match(/matrix.*\((.+)\)/)[1].split(", ");
    const translatePx = parseFloat(matrix[5]);
    return (translatePx / window.innerHeight) * 100;
  }

  function onStart(e) {
    isDragging = true;
    startY = getY(e);
    startTranslate = getCurrentTranslate();
    sheet.style.transition = "none";
  }

  function onMove(e) {
    if (!isDragging) return;

    const delta = getY(e) - startY;
    let next = startTranslate + (delta / window.innerHeight) * 100;

    next = Math.max(positions.open, Math.min(positions.peek, next));
    sheet.style.transform = `translateY(${next}%)`;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;

    sheet.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
    const current = getCurrentTranslate();

    if (current < 10) state = "open";
    else if (current < 45) state = "mid";
    else state = "peek";

    sheet.style.transform = `translateY(${positions[state]}%)`;

    if (state === "open") {
      mapEl.classList.add("hidden");
      sheet.style.borderRadius = "0";
    } else {
      mapEl.classList.remove("hidden");
      sheet.style.borderRadius = "26px 26px 0 0";
    }
  }

  // zone large de drag (UX)
  [handle, grabZone].forEach(el => {
    if (!el) return;
    el.addEventListener("mousedown", onStart);
    el.addEventListener("touchstart", onStart, { passive: true });
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);

  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onEnd);
});
