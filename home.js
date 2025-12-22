/* =========================
   MAP (Leaflet) – GARES + RER
========================= */
let mapInited = false;
let map;
let stationsLayer;

function initHomeMapOnce() {
  if (mapInited) return;
  mapInited = true;

  const paris = [48.8566, 2.3522];

  map = L.map("map", {
    zoomControl: false,
    minZoom: 10,
    maxZoom: 18
  }).setView(paris, 12);

  /* =========================
     FOND DE CARTE (DA transport)
  ========================= */
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "© OpenStreetMap © CARTO"
    }
  ).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  /* =========================
     COUCHE GARES
  ========================= */
  stationsLayer = L.layerGroup().addTo(map);
  loadStations();

  /* =========================
     GEOLOCALISATION
  ========================= */
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = [pos.coords.latitude, pos.coords.longitude];
        map.setView(me, 14);
        L.circleMarker(me, {
          radius: 7,
          color: "#3e91ff",
          fillColor: "#3e91ff",
          fillOpacity: 1
        }).addTo(map);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  }

  setTimeout(() => {
    map.invalidateSize(true);
  }, 100);
}

/* =========================
   LOAD STATIONS (GARES + LIGNES)
========================= */
async function loadStations() {
  try {
    const res = await fetch("data/liste-des-gares.geojson");
    const data = await res.json();

    L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 4,
          color: "#111",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2
        }),

      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};

        // Nom de la gare
        const name =
          props.nom ||
          props.name ||
          "Gare";

        // Récupération des lignes (selon structure IDFM)
        let lines = [];

        if (Array.isArray(props.reseaux)) {
          lines = props.reseaux;
        } else if (Array.isArray(props.lignes)) {
          lines = props.lignes;
        } else if (typeof props.reseau === "string") {
          lines = [props.reseau];
        }

        // Nettoyage pour afficher seulement RER / Métro
        const formattedLines = lines
          .filter(l => l.includes("RER") || l.includes("METRO"))
          .join(" · ");

        const popupContent = `
          <strong>${name}</strong>
          ${formattedLines ? `<br><small>${formattedLines}</small>` : ""}
        `;

        layer.bindPopup(popupContent);
      }
    }).addTo(stationsLayer);
  } catch (e) {
    console.warn("Stations IDFM non chargées");
  }
}

window.initHomeMapOnce = initHomeMapOnce;

/* =========================
   BOTTOM SHEET (inchangé)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const sheet = document.querySelector(".sheet");
  const handle = document.querySelector(".sheet-handle");
  const grabZone = document.querySelector(".sheet-grab-zone");
  const mapEl = document.getElementById("map");

  if (!sheet || !handle) return;

  const positions = { open: 0, mid: 25, peek: 65 };
  let state = "mid";
  let isDragging = false;
  let startY = 0;
  let startTranslate = positions[state];

  sheet.style.transform = `translateY(${positions[state]}%)`;

  function getY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function getCurrentTranslate() {
    const matrix = window.getComputedStyle(sheet).transform;
    if (matrix === "none") return positions[state];
    return (parseFloat(matrix.split(",")[5]) / window.innerHeight) * 100;
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
      mapEl.style.visibility = "hidden";
      sheet.style.borderRadius = "0";
    } else {
      mapEl.style.visibility = "visible";
      sheet.style.borderRadius = "26px 26px 0 0";
      map.invalidateSize(true);
    }
  }

  [handle, grabZone].forEach(el => {
    el.addEventListener("mousedown", onStart);
    el.addEventListener("touchstart", onStart, { passive: true });
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onEnd);
});
