/* =========================================================
   HOME.JS — CLEAN (Leaflet + Stations + Search + Work + Trip)
   - Map init once
   - GeoJSON merge anti-doublons
   - Dots/Icon layers switch by zoom
   - Popup v2 + fake departures (terminus réels)
   - Search UI (grouped by station name, multi-candidates)
   - Work button: flyTo La Défense -> popup -> Itinerary fake
   - Itinerary fake: click "metro1" -> Trip screen + route line 1
========================================================= */

/* =========================
   GLOBALS
========================= */
let mapInited = false;
let map = null;

let stationsDotsLayer = null;
let stationsIconsLayer = null;

// Index "brut" (après merge): points uniques par (nom+coords arrondies)
let stationsIndex = []; // [{ name, norm, latlng:[lat,lng], lines:[{type,id}], key }]

// Index "groupé" par nom: 1 entrée/station, + candidates (plusieurs points) + lines union
let stationsGroupedIndex = []; // [{ name, norm, lines:[...], candidates:[{key,latlng,lines:[...]}] }]

// key -> { dots: Layer, icons: Layer }
const stationLayersByKey = new Map();

// geoloc marker (pour pouvoir l’enlever en mode Trip)
let meMarker = null;

// =========================
// TRIP MODE FLAG (empêche le retour des points blancs)
// =========================
let isTripMode = false;

function setTripMode(on) {
  isTripMode = !!on;
  if (!map) return;

  if (isTripMode) {
    // coupe le switch auto qui ré-ajoute les stations
    map.off("zoomend", toggleStationsLayer);

    // enlève les 2 layers stations immédiatement
    if (stationsDotsLayer && map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
    if (stationsIconsLayer && map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);
  } else {
    // réactive le switch auto + réaffiche stations selon zoom
    map.off("zoomend", toggleStationsLayer);
    map.on("zoomend", toggleStationsLayer);
    toggleStationsLayer();
  }
}

/* =========================
   PAGE NAV (fallback)
========================= */
function goPage(id) {
  if (typeof window.showPage === "function") return window.showPage(id);

  // fallback si showPage n’existe pas
  document.querySelectorAll("main .page").forEach(sec => {
    const isTarget = sec.id === id;
    sec.classList.toggle("hidden", !isTarget);
  });

  setTimeout(() => {
    if (map) map.invalidateSize(true);
  }, 80);
}

/* =========================
   MAP INIT (ONCE)
========================= */
function initHomeMapOnce() {
  if (mapInited) return;
  mapInited = true;

  const paris = [48.8566, 2.3522];

  map = L.map("map", {
    zoomControl: false,
    attributionControl: false,
    minZoom: 11,
    maxZoom: 18
  }).setView(paris, 12);

  // expose for app.js refresh
  window.map = map;

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "" }
  ).addTo(map);

  loadStations();

  // Geoloc
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const me = [pos.coords.latitude, pos.coords.longitude];
        if (meMarker) meMarker.remove();

        meMarker = L.circleMarker(me, {
          radius: 7,
          color: "#3e91ff",
          fillColor: "#3e91ff",
          fillOpacity: 1,
          weight: 2
        }).addTo(map);

        map.setView(me, 14);
      },
      () => { },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  // Search UI needs DOM ready + stationsGroupedIndex ready (stations load async)
  // We init UI on DOMContentLoaded, and render uses stationsGroupedIndex whenever ready.
  setTimeout(() => map.invalidateSize(true), 100);
}
window.initHomeMapOnce = initHomeMapOnce;

/* =========================
   LINE COLORS + NORMALIZATION
========================= */
function stationColor(type, id) {
  const RER = {
    A: "#E2231A",
    B: "#3785d8",
    C: "#f7c82e",
    D: "#0d650a",
    E: "#B7DD00"
  };
  const M = {
    "1": "#FFCD00",
    "2": "#2e63bf",
    "3": "#837902",
    "3B": "#6EC4E8",
    "4": "#BE418D",
    "5": "#FF7E2E",
    "6": "#6ECA97",
    "7": "#FA9ABA",
    "7B": "#6EC4E8",
    "8": "#bc9be1",
    "9": "#B7DD00",
    "10": "#C9910D",
    "11": "#704B1C",
    "12": "#007852",
    "13": "#6EC4E8",
    "14": "#62259D"
  };
  if (type === "RER") return RER[id] || "#111";
  return M[id] || "#111";
}

function normalizeLineId(typeNorm, id) {
  const s = String(id).toUpperCase().replace(/\s+/g, "");
  if (typeNorm === "M" && (s === "3BIS" || s === "3B")) return "3B";
  if (typeNorm === "M" && (s === "7BIS" || s === "7B")) return "7B";
  return s;
}

function normText(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function keyFromFeature(feature) {
  const name = normText(feature?.properties?.name);
  const [lng, lat] = feature.geometry.coordinates;
  const r = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
  return `${name}|${r(lat, 3)}|${r(lng, 3)}`;
}

function lineKey(typeNorm, idNorm) {
  return `${typeNorm}:${idNorm}`;
}

function normalizeLines(lines) {
  const out = [];
  const seen = new Set();
  for (const l of (Array.isArray(lines) ? lines : [])) {
    const t = String(l.type || "").toUpperCase() === "RER" ? "RER" : "M";
    const id = normalizeLineId(t, l.id);
    const lk = lineKey(t, id);
    if (seen.has(lk)) continue;
    seen.add(lk);
    out.push({ type: t, id });
  }
  // RER d’abord
  out.sort(a => (a.type === "RER" ? -1 : 1));
  return out;
}

function hasLine(lines, typeNorm, idNorm) {
  return (lines || []).some(l => {
    const t = String(l.type || "").toUpperCase() === "RER" ? "RER" : "M";
    const id = normalizeLineId(t, l.id);
    return t === typeNorm && id === idNorm;
  });
}

/* =========================
   POPUP v2 + FAKE DEPARTURES (terminus réels)
========================= */
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}
function rand01(seed) {
  const x = (seed * 1664525 + 1013904223) >>> 0;
  return x / 4294967296;
}
function rInt(seed, min, max) {
  return Math.floor(rand01(seed) * (max - min + 1)) + min;
}
function pickFromPool(seed, pool) {
  return pool[Math.floor(rand01(seed) * pool.length)];
}

const TERMINUS = {
  M: {
    "1": ["La Défense (Grande Arche)", "Château de Vincennes"],
    "2": ["Porte Dauphine", "Nation"],
    "3": ["Pont de Levallois – Bécon", "Gallieni"],
    "3B": ["Porte des Lilas", "Gambetta"],
    "4": ["Porte de Clignancourt", "Bagneux – Lucie Aubrac"],
    "5": ["Bobigny – Pablo Picasso", "Place d’Italie"],
    "6": ["Charles de Gaulle – Étoile", "Nation"],
    "7": ["La Courneuve – 8 Mai 1945", "Villejuif – Louis Aragon", "Mairie d’Ivry"],
    "7B": ["Louis Blanc", "Pré Saint-Gervais"],
    "8": ["Balard", "Créteil – Pointe du Lac"],
    "9": ["Pont de Sèvres", "Mairie de Montreuil"],
    "10": ["Boulogne – Pont de Saint-Cloud", "Gare d’Austerlitz"],
    "11": ["Châtelet", "Rosny – Bois-Perrier"],
    "12": ["Mairie d’Issy", "Mairie d’Aubervilliers"],
    "13": ["Saint-Denis – Université", "Châtillon – Montrouge"],
    "14": ["Saint-Denis Pleyel", "Aéroport d’Orly"]
  },
  RER: {
    A: ["Cergy – Le Haut", "Poissy", "Saint-Germain-en-Laye", "Boissy-Saint-Léger", "Marne-la-Vallée – Chessy"],
    B: ["Aéroport Charles de Gaulle 2", "Mitry–Claye", "Robinson", "Saint-Rémy-lès-Chevreuse"],
    C: ["Pontoise", "Versailles Château Rive Gauche", "Saint-Quentin-en-Yvelines", "Massy – Palaiseau", "Dourdan", "Étampes"],
    D: ["Creil", "Orry-la-Ville – Coye", "Melun", "Malesherbes", "Corbeil-Essonnes"],
    E: ["Nanterre–La Folie", "Chelles–Gournay", "Tournan"]
  }
};

function buildDeparturesHTML(stationName, mainLineArr) {
  if (!mainLineArr.length) return "";

  const l = mainLineArr[0];
  const isRer = String(l.type || "").toUpperCase() === "RER";
  const typeNorm = isRer ? "RER" : "M";
  const id = normalizeLineId(typeNorm, l.id);
  const color = stationColor(typeNorm, id);

  const seedBase = hashStr(`${stationName}|${typeNorm}|${id}`);

  const pool =
    (isRer ? TERMINUS.RER[id] : TERMINUS.M[id]) ||
    (isRer ? TERMINUS.RER.A : TERMINUS.M["1"]);

  let term1, term2;

  if (pool.length === 2) {
    term1 = pool[0];
    term2 = pool[1];
  } else {
    term1 = pickFromPool(seedBase + 11, pool);
    term2 = term1;
    for (let i = 0; i < 6 && term2 === term1; i++) {
      term2 = pickFromPool(seedBase + 22 + i * 7, pool);
    }
    if (term2 === term1 && pool.length > 1) {
      term2 = pool.find(t => t !== term1) || term1;
    }
  }

  const a1 = isRer ? rInt(seedBase + 44, 6, 18) : rInt(seedBase + 44, 1, 8);
  const a2 = isRer ? rInt(seedBase + 55, 10, 28) : rInt(seedBase + 55, 4, 14);

  const b1base = isRer ? rInt(seedBase + 144, 6, 18) : rInt(seedBase + 144, 1, 8);
  const b2base = isRer ? rInt(seedBase + 155, 10, 28) : rInt(seedBase + 155, 4, 14);

  const b1 = Math.max(1, b1base + (isRer ? 1 : 0));
  const b2 = Math.max(b1 + 2, b2base + (isRer ? 2 : 1));

  return `
    <div class="pop-list v2">
      <div class="pop-row v2">
        <div class="pop-left v2">
          <span class="pop-dot v2 pop-line line-${id}" style="background:${color}">${id}</span>
          <span class="pop-dir v2">Vers ${term1}</span>
        </div>
        <div class="pop-right v2">
          <span class="min-ico v2 blink" aria-hidden="true"></span>
          <span class="pop-time v2">${a1}, ${a2} min</span>
        </div>
      </div>

      <div class="pop-row v2">
        <div class="pop-left v2">
          <span class="pop-dot v2 pop-line line-${id}" style="background:${color}">${id}</span>
          <span class="pop-dir v2">Vers ${term2}</span>
        </div>
        <div class="pop-right v2">
          <span class="min-ico v2 blink" aria-hidden="true"></span>
          <span class="pop-time v2">${b1}, ${b2} min</span>
        </div>
      </div>
    </div>
  `;
}

function buildPopupHTML(props) {
  const name = props?.name || "Station";
  const lines = normalizeLines(props?.lines);
  const main = lines[0] ? [lines[0]] : [];

  const badges = main
    .map(l => {
      const typeNorm = l.type === "RER" ? "RER" : "M";
      const id = normalizeLineId(typeNorm, l.id);
      const label = typeNorm === "RER" ? `RER ${id}` : id;
      const color = stationColor(typeNorm, id);
      const cls = typeNorm === "RER" ? `line-badge rer line-${id}` : `line-badge metro line-${id}`;
      return `<span class="${cls}" style="background:${color}">${label}</span>`;
    })
    .join("");

  const isMetro = main[0] && String(main[0].type || "").toUpperCase() !== "RER";
  const modeLogo = isMetro ? `<span class="pop-mode">M</span>` : ``;

  const rows = buildDeparturesHTML(name, main);

  return `
    <div class="station-popup v2">
      <button class="pop-go" type="button" data-station="${name}">
        Y aller <span class="chev">›</span>
      </button>

      <div class="station-title">${name}</div>
      <div class="pop-sub">
        ${modeLogo}
        ${badges}
      </div>

      ${rows ? `<div class="pop-panel v2">${rows}</div>` : ``}
    </div>
  `;
}

/* =========================
   MARKERS (LOGOS)
========================= */
function buildMarkerHTML(linesRaw) {
  const sorted = normalizeLines(linesRaw);
  const main = sorted[0];
  if (!main) return `<div class="st-pin"></div>`;

  const rest = Math.max(0, sorted.length - 1);

  const typeNorm = main.type === "RER" ? "RER" : "M";
  const id = normalizeLineId(typeNorm, main.id);
  const color = stationColor(typeNorm, id);

  const cls = typeNorm === "RER" ? `st-badge rer line-${id}` : `st-badge metro line-${id}`;

  return `
    <div class="st-pin">
      <span class="${cls}" style="background:${color}">${id}</span>
      ${rest ? `<span class="st-more">+${rest}</span>` : ``}
    </div>
  `;
}

/* =========================
   LAYERS SWITCH (ZOOM)
========================= */
function toggleStationsLayer() {
  if (isTripMode) return;
  if (!map) return;

  const z = map.getZoom();
  const showIcons = z >= 14;

  if (showIcons) {
    if (stationsDotsLayer && map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
    if (stationsIconsLayer && !map.hasLayer(stationsIconsLayer)) stationsIconsLayer.addTo(map);
  } else {
    if (stationsIconsLayer && map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);
    if (stationsDotsLayer && !map.hasLayer(stationsDotsLayer)) stationsDotsLayer.addTo(map);
  }
}

/* =========================
   GEOJSON MERGE (anti doublons coords proches)
========================= */
function mergeStationsGeoJSON(geojson) {
  const groups = new Map();

  const round = (n, d = 3) => {
    const p = Math.pow(10, d);
    return Math.round(n * p) / p;
  };

  function normName(s) {
    return (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function keyOf(f) {
    const name = normName(f.properties?.name);
    const [lng, lat] = f.geometry.coordinates;
    return `${name}|${round(lat, 3)}|${round(lng, 3)}`;
  }

  for (const f of (geojson.features || [])) {
    if (!f?.geometry?.coordinates) continue;

    const k = keyOf(f);
    if (!groups.has(k)) {
      groups.set(k, {
        type: "Feature",
        geometry: { type: "Point", coordinates: [...f.geometry.coordinates] },
        properties: { name: f.properties?.name || "Station", lines: [] }
      });
    }

    const g = groups.get(k);
    const mergedLines = normalizeLines([...(g.properties.lines || []), ...(f.properties?.lines || [])]);
    g.properties.lines = mergedLines;
  }

  return { type: "FeatureCollection", features: [...groups.values()] };
}

/* =========================
   LOAD STATIONS + BUILD INDEXES + BUILD LAYERS
========================= */
function buildIndexesFromMerged(merged) {
  stationsIndex = (merged.features || []).map(f => {
    const name = f.properties?.name || "Station";
    const [lng, lat] = f.geometry.coordinates;
    const lines = normalizeLines(f.properties?.lines);
    return {
      name,
      norm: normText(name),
      latlng: [lat, lng],
      lines,
      key: keyFromFeature(f)
    };
  });

  // group by station norm name
  const groups = new Map(); // norm -> group

  for (const s of stationsIndex) {
    const k = s.norm;
    if (!groups.has(k)) {
      groups.set(k, { name: s.name, norm: s.norm, lines: [], candidates: [] });
    }
    const g = groups.get(k);

    // candidates keep their own lines (important for route building)
    g.candidates.push({ key: s.key, latlng: s.latlng, lines: s.lines });

    // merge lines union
    const union = normalizeLines([...(g.lines || []), ...(s.lines || [])]);
    g.lines = union;
  }

  stationsGroupedIndex = [...groups.values()].map(g => ({
    ...g,
    lines: normalizeLines(g.lines)
  }));
}

function loadStations() {
  fetch("data/stations_metro_rer.geojson")
    .then(res => res.json())
    .then(geojson => {
      const merged = mergeStationsGeoJSON(geojson);
      console.log("before/after:", geojson.features.length, merged.features.length);

      buildIndexesFromMerged(merged);
      console.log("✅ stationsIndex:", stationsIndex.length);
      console.log("✅ stationsGroupedIndex:", stationsGroupedIndex.length);

      // cleanup if reloaded
      if (stationsDotsLayer && map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
      if (stationsIconsLayer && map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);
      map.off("zoomend", toggleStationsLayer);

      // DOTS
      stationsDotsLayer = L.geoJSON(merged, {
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 4,
            color: "#111",
            weight: 2,
            fillColor: "#fff",
            fillOpacity: 1
          }),
        onEachFeature: (feature, layer) => {
          const k = keyFromFeature(feature);
          const prev = stationLayersByKey.get(k) || {};
          stationLayersByKey.set(k, { ...prev, dots: layer });

          layer.bindPopup(buildPopupHTML(feature.properties), {
            closeButton: false,
            offset: [0, -8]
          });
        }
      });

      // ICONS
      stationsIconsLayer = L.geoJSON(merged, {
        pointToLayer: (feature, latlng) => {
          const lines = normalizeLines(feature.properties?.lines);
          const html = lines.length ? buildMarkerHTML(lines) : `<div class="st-pin"></div>`;

          const icon = L.divIcon({
            className: "station-marker",
            html,
            iconSize: [1, 1],
            iconAnchor: [0, 0]
          });

          return L.marker(latlng, { icon, interactive: true });
        },
        onEachFeature: (feature, layer) => {
          const k = keyFromFeature(feature);
          const prev = stationLayersByKey.get(k) || {};
          stationLayersByKey.set(k, { ...prev, icons: layer });

          layer.bindPopup(buildPopupHTML(feature.properties), {
            closeButton: false,
            offset: [0, -10]
          });
        }
      });

      // start
      toggleStationsLayer();
      map.on("zoomend", toggleStationsLayer);
    })
    .catch(err => console.error("Stations load error:", err));
}

/* =========================
   BOTTOM SHEET
========================= */
/* =========================
   BOTTOM SHEET (ROBUSTE)
========================= */

function initBottomSheet() {
  const sheet = document.querySelector(".sheet");
  const handle = document.querySelector(".sheet-handle");
  const grabZone = document.querySelector(".sheet-grab-zone");
  const content = document.querySelector(".sheet-content"); // IMPORTANT
  const mapEl = document.getElementById("map");

  if (!sheet || !handle || !grabZone) return;

  const searchBar = document.querySelector(".home-search");
  const searchBottom = searchBar ? Math.round(searchBar.getBoundingClientRect().bottom + 12) : 150;


  // --- Snap points (en px) ---
  // open: presque tout en haut
  // mid : position “normal”
  // peek: position “presque fermé”
  const SNAP = {
    open: 150,
    mid: () => Math.round(window.innerHeight * 0.38),
    peek: () => Math.round(window.innerHeight * 0.70),
  };

  let currentY = SNAP.mid();
  let isDragging = false;
  let startY = 0;
  let startSheetY = 0;
  let raf = null;

  // Applique translate (clamp)
  function setSheetY(y, withTransition = false) {
    window.sheetTo = function (pos = "peek") {
      const y =
        pos === "open" ? SNAP.open :
          pos === "mid" ? SNAP.mid() :
            SNAP.peek(); // default peek

      setSheetY(y, true);
    };

    const minY = SNAP.open;
    const maxY = SNAP.peek();
    currentY = Math.max(minY, Math.min(maxY, y));

    sheet.style.transition = withTransition ? "transform .35s cubic-bezier(.2,.8,.2,1)" : "none";
    sheet.style.transform = `translateY(${currentY}px)`;

    // Map interaction: quand sheet est assez ouverte, on désactive les interactions map (évite bugs)
    const isMostlyOpen = currentY <= SNAP.mid();
    if (mapEl) mapEl.style.pointerEvents = isMostlyOpen ? "none" : "auto";
  }



  function nearestSnap(y) {
    const points = [SNAP.open, SNAP.mid(), SNAP.peek()];
    let best = points[0];
    let bestD = Math.abs(y - best);
    for (const p of points) {
      const d = Math.abs(y - p);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function onResize() {
    // Re-clamp sans animation
    setSheetY(currentY, false);

    // Leaflet refresh
    setTimeout(() => {
      if (typeof map !== "undefined" && map) map.invalidateSize(true);
    }, 80);
  }

  function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  // IMPORTANT: si on commence le geste dans le contenu scrollable
  // et que le contenu peut scroller (scrollTop > 0), on laisse scroller, pas dragger.
  function shouldStartDrag(e) {
    const t = e.target;
    const fromHandle = t.closest?.(".sheet-handle") || t.closest?.(".sheet-grab-zone");
    if (fromHandle) return true;

    // Si tu touches dans le contenu: drag autorisé UNIQUEMENT si content est en haut (scrollTop == 0)
    if (content && t.closest?.(".sheet-content")) {
      return content.scrollTop <= 0;
    }
    return false;
  }

  function startDrag(e) {
    if (!shouldStartDrag(e)) return;

    isDragging = true;
    startY = getClientY(e);
    startSheetY = currentY;

    sheet.classList.add("is-dragging");
    sheet.style.transition = "none";

    // stop scroll pendant drag depuis handle
    if (e.cancelable) e.preventDefault();
  }

  function moveDrag(e) {
    if (!isDragging) return;

    const y = getClientY(e);
    const dy = y - startY;
    const next = startSheetY + dy;

    // throttle avec RAF (plus smooth)
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      setSheetY(next, false);
    });

    if (e.cancelable) e.preventDefault();
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;

    sheet.classList.remove("is-dragging");

    // snap
    const snapTo = nearestSnap(currentY);
    setSheetY(snapTo, true);

    // Leaflet refresh (sinon map “cassée”)
    setTimeout(() => {
      if (typeof map !== "undefined" && map) map.invalidateSize(true);
    }, 80);
  }

  // Init position
  setSheetY(SNAP.mid(), false);

  // Events
  [handle, grabZone].forEach(el => {
    el.addEventListener("mousedown", startDrag);
    el.addEventListener("touchstart", startDrag, { passive: false });
  });

  window.addEventListener("mousemove", moveDrag);
  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchmove", moveDrag, { passive: false });
  window.addEventListener("touchend", endDrag);

  window.addEventListener("resize", onResize);
}

document.addEventListener("DOMContentLoaded", initBottomSheet);



/* =========================
   SEARCH UI (V2)
========================= */
function initSearchUI() {
  const input = document.getElementById("stationSearch");
  const results = document.getElementById("searchResults");
  const clearBtn = document.getElementById("searchClear");
  if (!input || !results) return;

  function hideResults() {
    results.classList.add("hidden");
    results.innerHTML = "";
  }

  function render(items) {
    results.innerHTML = items
      .map(s => {
        const lines = normalizeLines(s.lines);

        const hasRer = lines.some(l => l.type === "RER");
        const modeLabel = hasRer ? "RER" : "M";
        const modeClass = hasRer ? "rer" : "metro";

        const maxShow = 6;
        const show = lines.slice(0, maxShow);
        const rest = Math.max(0, lines.length - show.length);

        const badgesRow = show
          .map(l => {
            const t = l.type === "RER" ? "RER" : "M";
            const id = normalizeLineId(t, l.id);
            const bg = stationColor(t, id);
            return `<span class="sr-badge ${t === "RER" ? "rer" : "metro"} line-${id}" style="background:${bg}">${id}</span>`;
          })
          .join("");

        const moreHTML = rest ? `<span class="sr-more">+${rest}</span>` : "";

        return `
          <button class="search-item v2" type="button" role="option" data-key="${s.norm}">
            <div class="search-icon">
              <span class="si-mode ${modeClass}">${modeLabel}</span>
            </div>

            <div class="search-content">
              <div class="search-title">${s.name}</div>
              <div class="search-lines">
                ${badgesRow}
                ${moreHTML}
              </div>
            </div>
          </button>
        `;
      })
      .join("");

    results.classList.toggle("hidden", items.length === 0);
  }

  function doSearch(qRaw) {
    const q = normText(qRaw);
    if (!q) return hideResults();

    const starts = [];
    const contains = [];

    for (const s of stationsGroupedIndex) {
      if (s.norm.startsWith(q)) starts.push(s);
      else if (s.norm.includes(q)) contains.push(s);
      if (starts.length >= 8) break;
    }

    const out = starts.length ? starts.slice(0, 8) : contains.slice(0, 8);
    render(out);
  }

  input.addEventListener("input", e => doSearch(e.target.value));
  input.addEventListener("focus", () => {
    if (input.value.trim()) doSearch(input.value);
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    hideResults();
    input.focus();
  });

  results.addEventListener("click", (e) => {
  const btn = e.target.closest(".search-item");
  if (!btn) return;

  window.sheetTo?.("peek"); // ✅ ferme/descend le volet pour voir la map


    const key = btn.getAttribute("data-key");
    const match = stationsGroupedIndex.find(s => s.norm === key);
    if (!match || !match.candidates?.length) return;

    // choisit le point le plus proche du centre
    const center = map.getCenter();
    const centerLL = [center.lat, center.lng];

    const dist2 = (a, b) => {
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      return dx * dx + dy * dy;
    };

    let best = match.candidates[0];
    let bestD = Infinity;
    for (const c of match.candidates) {
      const d = dist2(c.latlng, centerLL);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }

    hideResults();
    input.blur();

    map.setView(best.latlng, 15, { animate: true });

    setTimeout(() => {
      toggleStationsLayer();

      const layers = stationLayersByKey.get(best.key);
      const targetLayer =
        (map.getZoom() >= 14 ? layers?.icons : layers?.dots) || layers?.icons || layers?.dots;

      if (targetLayer && typeof targetLayer.openPopup === "function") {
        targetLayer.openPopup();
      }
    }, 180);
  });
}

/* =========================
   WORK FLOW (La Défense)
========================= */
let workBusy = false;

function findLaDefenseGroup() {
  return stationsGroupedIndex.find(s => s.norm.includes("la defense"));
}

function goToWork() {
  window.sheetTo?.("peek"); // ✅ ferme/descend le volet

  if (!map || workBusy) return;
  workBusy = true;

  const def = findLaDefenseGroup();
  if (!def || !def.candidates?.length) {
    workBusy = false;
    return;
  }

  const picked = def.candidates[0];
  const pickedKey = picked.key;
  const pickedLatLng = picked.latlng;

  console.log("💼 WORK: flyTo -> popup -> itinerary");

  const onMoveEnd = () => {
    map.off("moveend", onMoveEnd);

    toggleStationsLayer();
    const layers = stationLayersByKey.get(pickedKey);
    const target =
      (map.getZoom() >= 14 ? layers?.icons : layers?.dots) || layers?.icons || layers?.dots;

    if (target && typeof target.openPopup === "function") target.openPopup();

    setTimeout(() => {
      openItineraryFake("Châtelet", "La Défense");
      workBusy = false;
    }, 320);
  };

  map.on("moveend", onMoveEnd);
  map.flyTo(pickedLatLng, 15, { animate: true, duration: 1.0 });

  // fallback si moveend ne part pas
  setTimeout(() => {
    if (workBusy) onMoveEnd();
  }, 1400);
}

/* =========================
   ITINERARY (FAKE)
========================= */
function renderItineraryFake(fromName, toName) {
  const fromTxt = document.getElementById("itFromTxt");
  const toTxt = document.getElementById("itToTxt");
  const list = document.getElementById("itList");
  if (!list) return;

  if (fromTxt) fromTxt.textContent = fromName;
  if (toTxt) toTxt.textContent = toName;

  const trajets = [
    {
      tripId: "rerA",
      duration: "18 min",
      badges: [
        `<span class="it-mode">RER</span>`,
        `<span class="it-line line-A" style="background:${stationColor("RER", "A")}">A</span>`
      ],
      waits: "0, 5, 11 min"
    },
    {
      tripId: "metro1",
      duration: "21 min",
      badges: [
        `<span class="it-mode">M</span>`,
        `<span class="it-line line-1" style="background:${stationColor("M", "1")}">1</span>`
      ],
      waits: "2, 4, 6 min"
    }
  ];

  list.innerHTML = trajets
    .map(t => `
      <div class="it-card" data-trip="${t.tripId}">
        <div class="it-row-top">
          <div class="it-badges">${t.badges.join("")}</div>
          <div class="it-duration">${t.duration}</div>
        </div>
        <div class="it-meta">
          <span class="min-ico v2 blink" aria-hidden="true"></span>
          <span>${t.waits}</span>
          <span class="muted">de ${fromName}</span>
        </div>
      </div>
    `)
    .join("");
}

function openItineraryFake(fromName, toName) {
  renderItineraryFake(fromName, toName);
  goPage("itinerary");
}

/* =========================
   POPUP CTA "Y aller"
   (pour l’instant: seulement La Défense -> itinéraire fake)
========================= */
document.addEventListener("click", e => {
  const btn = e.target.closest(".pop-go");
  if (!btn) return;

  const toName = btn.dataset.station || "";
  if (!normText(toName).includes("la defense")) return;

  openItineraryFake("Châtelet les Halles", "La Défense");
});

/* =========================
   TRIP SCREEN (route sur la map)
========================= */
let tripRouteLayer = null;

const METRO1_STATIONS = [
  "Châtelet",
  "Louvre - Rivoli",
  "Palais Royal - Musée du Louvre",
  "Tuileries",
  "Concorde",
  "Champs-Élysées - Clemenceau",
  "Franklin D. Roosevelt",
  "George V",
  "Charles de Gaulle - Étoile",
  "Argentine",
  "Porte Maillot",
  "Les Sablons",
  "Pont de Neuilly",
  "Esplanade de la Défense",
  "La Défense (Grande Arche)"
];

function findStationLatLngForLine(stName, typeNorm, idNorm) {
  const target = normText(stName);

  // 1) group exact
  const gExact = stationsGroupedIndex.find(g => g.norm === target);
  if (gExact) {
    const cand = gExact.candidates.find(c => hasLine(c.lines, typeNorm, idNorm)) || gExact.candidates[0];
    return cand?.latlng || null;
  }

  // 2) group includes
  const gInc = stationsGroupedIndex.find(g => g.norm.includes(target) || target.includes(g.norm));
  if (gInc) {
    const cand = gInc.candidates.find(c => hasLine(c.lines, typeNorm, idNorm)) || gInc.candidates[0];
    return cand?.latlng || null;
  }

  // 3) fallback brute index
  const brute = stationsIndex.find(s => s.norm === target && hasLine(s.lines, typeNorm, idNorm));
  return brute?.latlng || null;
}

function buildMetro1RoutePoints() {
  if (!stationsGroupedIndex.length) return null;

  const pts = [];
  for (const st of METRO1_STATIONS) {
    const ll = findStationLatLngForLine(st, "M", "1");
    if (ll) pts.push(ll);
  }

  if (pts.length < 6) {
    // fallback propre
    return [
      [48.8583, 2.3470],
      [48.8655, 2.3212],
      [48.8722, 2.3046],
      [48.8771, 2.2939],
      [48.8881, 2.2476]
    ];
  }

  return pts;
}

function clearTripRoute() {
  if (map && tripRouteLayer) {
    map.removeLayer(tripRouteLayer);
    tripRouteLayer = null;
  }
}

function hideStationsLayers() {
  if (!map) return;

  if (stationsDotsLayer && map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
  if (stationsIconsLayer && map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);

  // enlève geoloc en mode trip
  if (meMarker && map.hasLayer(meMarker)) map.removeLayer(meMarker);
}

function showStationsLayers() {
  if (!map) return;

  // remet geoloc si on l’avait
  if (meMarker && !map.hasLayer(meMarker)) meMarker.addTo(map);

  toggleStationsLayer();
}

function drawTripRoute(points, color) {
  if (!map || !Array.isArray(points) || points.length === 0) return;

  hideStationsLayers();
  clearTripRoute();

  tripRouteLayer = L.layerGroup().addTo(map);

  // Ligne principale
  const line = L.polyline(points, {
    color,
    weight: 8,
    opacity: 1,
    lineJoin: "round",
    lineCap: "round"
  }).addTo(tripRouteLayer);

  // Stops (blanc) + blink (jaune) avec décalage "tlatlatla"
  points.forEach((p, idx) => {
    // cercle blanc (stop)
    L.circleMarker(p, {
      radius: (idx === 0 || idx === points.length - 1) ? 7 : 6,
      weight: 2,
      color: "rgba(0,0,0,.35)",
      fillColor: "#fff",
      fillOpacity: 1
    }).addTo(tripRouteLayer);

    // petit point jaune (blink)
    const blink = L.circleMarker(p, {
      radius: 3,
      weight: 0,
      fillColor: color,
      fillOpacity: 1,
      className: "ng-stop-pulse"
    }).addTo(tripRouteLayer);

    // ✅ décale l'animation point par point
    const delay = idx * 0.12; // ajuste: 0.08 rapide / 0.15 plus lent
    setTimeout(() => {
      const el = blink.getElement();
      if (el) el.style.animationDelay = `${delay}s`;
    }, 0);
  });

  // Zoom cadré
  map.fitBounds(line.getBounds(), { padding: [22, 120] });

  // Décale la map vers le bas (pour laisser place à la sheet)
  setTimeout(() => {
    map.panBy([0, 500], { animate: true, duration: 0.4 });
  }, 120);
}

function openTripScreen(payload) {
  setTripMode(true);
  goPage("trip");

  // Refresh Leaflet après switch d’écran
  setTimeout(() => {
    if (map) map.invalidateSize(true);
  }, 80);

  // Remplissage UI
  document.getElementById("tripFrom").textContent = payload.fromLabel;
  document.getElementById("tripTo").textContent = payload.toLabel;
  document.getElementById("tripDir").textContent = payload.direction;
  document.getElementById("tripMin").textContent = payload.duration;
  document.getElementById("tripRange").textContent = payload.range;
  document.getElementById("tripStops").textContent = payload.stops;

  // Badges ligne
  const b1 = document.getElementById("tripLineBadge");
  const b2 = document.getElementById("tripLineBadge2");

  if (b1) {
    b1.textContent = payload.lineId;
    b1.style.background = payload.lineColor;
  }
  if (b2) {
    b2.textContent = payload.lineId;
    b2.style.background = payload.lineColor;
  }

  // Route sur la map
  drawTripRoute(payload.points, payload.lineColor);
}



function closeTripScreen() {
  setTripMode(false);
  clearTripRoute();
  showStationsLayers();
  goPage("itinerary");
  setTimeout(() => {
    if (map) map.invalidateSize(true);
  }, 80);
}

/* =========================
   EVENTS (single handlers)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initBottomSheet();
  initSearchUI();

  // WORK button (capture) — unique handler
  const btn = document.getElementById("btn-work");
  if (btn) {
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        goToWork();
      },
      true
    );
  }
});

// Back trip
document.addEventListener("click", e => {
  if (e.target.closest("#tripBack")) closeTripScreen();
});

// Click sur une card itinéraire => ouvre Trip (metro1)
document.addEventListener("click", e => {
  const card = e.target.closest(".it-card");
  if (!card) return;

  if (card.dataset.trip !== "metro1") return;

  const points = buildMetro1RoutePoints();
  const yellow = stationColor("M", "1");

  openTripScreen({
    fromLabel: "Station Châtelet",
    toLabel: "Station La Défense",
    direction: "Vers La Défense (Grande Arche)",
    duration: "20 min",
    range: "13:38 → 13:58",
    stops: `▼ ${Math.max(0, (points?.length || 0) - 1)} arrêts | 20 min`,
    lineId: "1",
    lineColor: yellow,
    points
  });
});

function handleItineraryBack() {
  console.log("⬅️ itBack clicked");

  // 1) Ferme écran itinerary -> home
  if (typeof window.showPage === "function") {
    window.showPage("home");
  } else if (typeof setPage === "function") {
    setPage("home");
  } else if (typeof goPage === "function") {
    goPage("home");
  } else {
    // fallback brutal
    document.querySelectorAll("section.page").forEach(sec => {
      const isHome = sec.id === "home";
      sec.classList.toggle("hidden", !isHome);
      sec.style.display = isHome ? "block" : "none";
    });
  }

  // 2) Refresh Leaflet
  setTimeout(() => {
    if (typeof map !== "undefined" && map) map.invalidateSize(true);
  }, 80);

  // 3) Optionnel: remove route si tu veux
  if (typeof clearTripRoute === "function") clearTripRoute();
  if (typeof clearRoute === "function") clearRoute();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#itBack");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  handleItineraryBack();
}, true); // capture pour passer avant d’autres handlers
