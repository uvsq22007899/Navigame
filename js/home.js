/* =========================
   HOME MAP – INIT (ICONS + ANTI CRASH)
========================= */

let mapInited = false;
let map;

// 2 couches: dots (léger) + icons (logos)
let stationsDotsLayer;
let stationsIconsLayer;

function initHomeMapOnce() {
  if (mapInited) return;
  mapInited = true;

  const paris = [48.8566, 2.3522];

  map = L.map("map", {
    zoomControl: false,
    minZoom: 11,
    maxZoom: 18
  }).setView(paris, 12);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "© OpenStreetMap © CARTO" }
  ).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Stations
  loadStations();

  // Geoloc
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(pos => {
      const me = [pos.coords.latitude, pos.coords.longitude];
      L.circleMarker(me, {
        radius: 7,
        color: "#3e91ff",
        fillColor: "#3e91ff",
        fillOpacity: 1
      }).addTo(map);
      map.setView(me, 14);
    });
  }

  setTimeout(() => map.invalidateSize(true), 100);
}

window.initHomeMapOnce = initHomeMapOnce;

/* =========================
   STATIONS (GeoJSON) + ICONS (zoom)
========================= */

function stationColor(type, id) {
  const RER = { A: "#E2231A", B: "#003CA6", C: "#FCD000", D: "#00A88F", E: "#B7DD00" };
  const M = {
    "1": "#FFCD00", "2": "#003CA6", "3": "#837902", "3B": "#6EC4E8", "4": "#BE418D", "5": "#FF7E2E",
    "6": "#6ECA97", "7": "#FA9ABA", "7B": "#6EC4E8", "8": "#E19BDF", "9": "#B7DD00",
    "10": "#C9910D", "11": "#704B1C", "12": "#007852", "13": "#6EC4E8", "14": "#62259D"
  };
  if (type === "RER") return RER[id] || "#111";
  return M[id] || "#111";
}

function normalizeLineId(type, id) {
  const s = String(id).toUpperCase().replace(/\s+/g, "");
  if (type === "M" && (s === "3BIS" || s === "3B")) return "3B";
  if (type === "M" && (s === "7BIS" || s === "7B")) return "7B";
  return s;
}

function buildPopupHTML(props) {
  const name = props?.name || "Station";
  const lines = Array.isArray(props?.lines) ? props.lines : [];

  const badges = lines.map(l => {
    const id = normalizeLineId(l.type, l.id);
    const label = l.type === "RER" ? `RER ${id}` : id;
    const color = stationColor(l.type, id);
    const cls = l.type === "RER" ? "line-badge rer" : "line-badge metro";
    return `<span class="${cls}" style="background:${color}">${label}</span>`;
  }).join("");

  return `
    <div class="station-popup">
      <div class="station-title">${name}</div>
      <div class="station-lines">${badges || "<span class='muted'>Aucune ligne</span>"}</div>
    </div>
  `;
}

function buildMarkerHTML(lines) {
  const sorted = [...lines].sort((a, b) => (a.type === "RER" ? -1 : 1));
  const main = sorted[0];
  const rest = Math.max(0, sorted.length - 1);

  const id = normalizeLineId(main.type, main.id);
  const color = stationColor(main.type, id);
  const label = main.type === "RER" ? `RER ${id}` : id;
  const cls = main.type === "RER" ? "st-badge rer" : "st-badge metro";

  return `
    <div class="st-pin">
      <span class="${cls}" style="background:${color}">${label}</span>
      ${rest ? `<span class="st-more">+${rest}</span>` : ``}
    </div>
  `;
}

function toggleStationsLayer() {
  const z = map.getZoom();
  const showIcons = z >= 14; // change à 15 si tu veux encore + proche

  if (showIcons) {
    if (map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
    if (!map.hasLayer(stationsIconsLayer)) stationsIconsLayer.addTo(map);
  } else {
    if (map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);
    if (!map.hasLayer(stationsDotsLayer)) stationsDotsLayer.addTo(map);
  }
}

function loadStations() {
  fetch("data/stations_metro_rer.geojson")
    .then(res => res.json())
    .then(geojson => {

      // DOTS (léger)
      stationsDotsLayer = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 4,
            color: "#111",
            weight: 2,
            fillColor: "#fff",
            fillOpacity: 1
          }),
        chFeature: (feature, layer) => {
          layer.bindPopup(buildPopupHTML(feature.properties), {
            closeButton: false,
            offset: [0, -8]
          });
        }
      });

      // ICONS (logos)
      stationsIconsLayer = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
          const lines = feature.properties?.lines || [];
          const html = lines.length ? buildMarkerHTML(lines) : `<div class="st-pin"></div>`;

          const icon = L.divIcon({
            className: "station-marker",
            html,
            iconSize: [1, 1],
            iconAnchor: [0, 0]
          });

          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(buildPopupHTML(feature.properties), {
            closeButton: false,
            offset: [0, -10]
          });
        }
      });

      // Start (safe)
      stationsDotsLayer.addTo(map);
      toggleStationsLayer();
      map.on("zoomend", toggleStationsLayer);
    })
    .catch(err => console.error("Stations load error:", err));
}


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
