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
  const RER = { A: "#E2231A", B: "#3785d8ff", C: "#f7c82eff", D: "#0d650aff", E: "#B7DD00" };
  const M = {
    "1": "#FFCD00", "2": "#2e63bfff", "3": "#837902", "3B": "#6EC4E8", "4": "#BE418D", "5": "#FF7E2E",
    "6": "#6ECA97", "7": "#FA9ABA", "7B": "#6EC4E8", "8": "#bc9be1ff", "9": "#B7DD00",
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

  // ✅ on garde UNE seule ligne (la "main", comme l’icône)
  const sorted = [...lines].sort((a) => (a.type === "RER" ? -1 : 1));
  const main = sorted[0] ? [sorted[0]] : [];

  const badges = main.map(l => {
    const id = normalizeLineId(l.type, l.id);
    const label = l.type === "RER" ? `RER ${id}` : id;
    const color = stationColor(l.type, id);
    const cls = l.type === "RER" ? "line-badge rer" : "line-badge metro";
    return `<span class="${cls}" style="background:${color}">${label}</span>`;
  }).join("");

  // ✅ rond M seulement si c'est métro
  const isMetro = main[0] && String(main[0].type || "").toUpperCase() !== "RER";
  const modeLogo = isMetro ? `<span class="pop-mode">M</span>` : ``;

  const rows = buildDeparturesHTML(name, main);

  return `
    <div class="station-popup v2">
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
   FAKE DEPARTURES (popup)
========================= */

// petite random "stable" (même station => mêmes temps) pour pas que ça change à chaque clic
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}
function rand01(seed) {
  // LCG
  let x = (seed * 1664525 + 1013904223) >>> 0;
  return x / 4294967296;
}
function pick(seed, arr) {
  return arr[Math.floor(rand01(seed) * arr.length)];
}
function rInt(seed, min, max) {
  return Math.floor(rand01(seed) * (max - min + 1)) + min;
}
function pickFromPool(seed, pool) {
  return pick(seed, pool);
}

// génère 1 bloc “ligne” => 2 directions + 2 temps
/* =========================
   TERMINUS (vrais terminus)
========================= */

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
    "A": ["Cergy – Le Haut", "Poissy", "Saint-Germain-en-Laye", "Boissy-Saint-Léger", "Marne-la-Vallée – Chessy"],
    "B": ["Aéroport Charles de Gaulle 2", "Mitry–Claye", "Robinson", "Saint-Rémy-lès-Chevreuse"],
    "C": ["Pontoise", "Versailles Château Rive Gauche", "Saint-Quentin-en-Yvelines", "Massy – Palaiseau", "Dourdan", "Étampes"],
    "D": ["Creil", "Orry-la-Ville – Coye", "Melun", "Malesherbes", "Corbeil-Essonnes"],
    "E": ["Nanterre–La Folie", "Chelles–Gournay", "Tournan"]
  }
};

// petit helper (au cas où)
function pickFromPool(seed, pool) {
  return pool[Math.floor(rand01(seed) * pool.length)];
}

function buildDeparturesHTML(stationName, lines) {
  if (!lines.length) return "";

  const l = lines[0];

  const rawType = (l.type || "").toUpperCase();
  const isRer = rawType === "RER";
  const typeNorm = isRer ? "RER" : "M";
  const id = normalizeLineId(typeNorm, l.id);

  const seedBase = hashStr(`${stationName}|${typeNorm}|${id}`);
  const color = stationColor(typeNorm, id);

  // ✅ pool terminus selon ligne
  const pool =
    (isRer ? TERMINUS.RER[id] : TERMINUS.M[id]) ||
    (isRer ? TERMINUS.RER["A"] : TERMINUS.M["1"]); // fallback

  let term1, term2;

if (pool.length === 2) {
  // métro standard
  term1 = pool[0];
  term2 = pool[1];
} else {
  // ✅ RER / branches : on force 2 différents
  term1 = pickFromPool(seedBase + 11, pool);

  // boucle courte pour garantir différent
  term2 = term1;
  for (let i = 0; i < 6 && term2 === term1; i++) {
    term2 = pickFromPool(seedBase + 22 + i * 7, pool);
  }

  // fallback ultime si jamais
  if (term2 === term1 && pool.length > 1) {
    term2 = pool.find(t => t !== term1) || term1;
  }
}



  // ✅ 2 prochains passages PAR direction => format "1, 6 min"
  // METRO: courts, RER: plus long + léger décalage entre les 2 directions
const a1 = isRer ? rInt(seedBase + 44, 6, 18) : rInt(seedBase + 44, 1, 8);
const a2 = isRer ? rInt(seedBase + 55, 10, 28) : rInt(seedBase + 55, 4, 14);

// ✅ seeds différentes + petit offset réaliste
const b1base = isRer ? rInt(seedBase + 144, 6, 18) : rInt(seedBase + 144, 1, 8);
const b2base = isRer ? rInt(seedBase + 155, 10, 28) : rInt(seedBase + 155, 4, 14);

const b1 = Math.max(1, b1base + (isRer ? 1 : 0));   // +1 min RER parfois
const b2 = Math.max(b1 + 2, b2base + (isRer ? 2 : 1)); // garantit un écart


  return `
  <div class="pop-list v2">
    <div class="pop-row v2">
      <div class="pop-left v2">
        <span class="pop-dot v2 pop-line" style="background:${color}">${id}</span>
        <span class="pop-dir v2">Vers ${term1}</span>
      </div>
      <div class="pop-right v2">
        <span class="min-ico v2 blink" aria-hidden="true"></span>
        <span class="pop-time v2">${a1}, ${a2} min</span>
      </div>
    </div>

    <div class="pop-row v2">
      <div class="pop-left v2">
        <span class="pop-dot v2 pop-line" style="background:${color}">${id}</span>
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




function buildMarkerHTML(lines) {
  const sorted = [...lines].sort((a) => (a.type === "RER" ? -1 : 1));
  const main = sorted[0];
  if (!main) return `<div class="st-pin"></div>`;

  const rest = Math.max(0, sorted.length - 1);

  const id = normalizeLineId(main.type, main.id);
  const color = stationColor(main.type, id);

  // ✅ RER = juste la lettre (A/B/C...), pas "RER C"
  const isRer = main.type === "RER";
  const label = isRer ? id : id;

  const cls = isRer
    ? "st-badge rer"
    : `st-badge metro line-${id}`;

  return `
    <div class="st-pin">
      <span class="${cls}" style="background:${color}">${label}</span>
      ${rest ? `<span class="st-more">+${rest}</span>` : ``}
    </div>
  `;
}


function toggleStationsLayer() {
  if (!map) return;

  const z = map.getZoom();
  const showIcons = z >= 14; // mets 15 si tu veux + proche

  if (showIcons) {
    if (stationsDotsLayer && map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
    if (stationsIconsLayer && !map.hasLayer(stationsIconsLayer)) stationsIconsLayer.addTo(map);
  } else {
    if (stationsIconsLayer && map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);
    if (stationsDotsLayer && !map.hasLayer(stationsDotsLayer)) stationsDotsLayer.addTo(map);
  }
}
function mergeStationsGeoJSON(geojson) {
  const groups = new Map();

  function round(n, d = 2) {
    const p = Math.pow(10, d);
    return Math.round(n * p) / p;
  }

  function normName(s) {
    return (s || "")
      .toString()
      .normalize("NFD")                 // sépare accents
      .replace(/[\u0300-\u036f]/g, "")  // supprime accents
      .replace(/[\u2010-\u2015]/g, "-") // tirets “bizarres” -> "-"
      .replace(/\u00A0/g, " ")          // espace insécable -> espace
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function keyOf(f) {
    const name = normName(f.properties?.name);
    const [lng, lat] = f.geometry.coordinates;
    return `${name}|${round(lat, 3)}|${round(lng, 3)}`;
  }

  function lineKey(l) {
    const t = (l.type || "").toUpperCase();
    const typeNorm = (t === "RER") ? "RER" : "M";
    const idNorm = normalizeLineId(typeNorm, l.id);
    return `${typeNorm}:${idNorm}`;
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
    const lines = Array.isArray(f.properties?.lines) ? f.properties.lines : [];

    const seen = new Set(g.properties.lines.map(lineKey));
    for (const l of lines) {
      const lk = lineKey(l);
      if (!seen.has(lk)) {
        seen.add(lk);
        const t = (l.type || "").toUpperCase();
        const typeNorm = (t === "RER") ? "RER" : "M";
        g.properties.lines.push({
          type: typeNorm,
          id: normalizeLineId(typeNorm, l.id)
        });
      }
    }
  }

  return { type: "FeatureCollection", features: [...groups.values()] };
}


function loadStations() {
  fetch("data/stations_metro_rer.geojson")
    .then(res => res.json())
    .then(geojson => {

      const merged = mergeStationsGeoJSON(geojson);
      console.log("before/after:", geojson.features.length, merged.features.length);


      // ✅ CLEAN (évite doublons si loadStations est relancé)
      if (stationsDotsLayer && map.hasLayer(stationsDotsLayer)) map.removeLayer(stationsDotsLayer);
      if (stationsIconsLayer && map.hasLayer(stationsIconsLayer)) map.removeLayer(stationsIconsLayer);
      map.off("zoomend", toggleStationsLayer);

      // DOTS (léger)
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
          layer.bindPopup(buildPopupHTML(feature.properties), {
            closeButton: false,
            offset: [0, -8]
          });
        }

      });


      // ICONS (logos)
      stationsIconsLayer = L.geoJSON(merged, {
        pointToLayer: (feature, latlng) => {
          const lines = feature.properties?.lines || [];
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
          layer.bindPopup(buildPopupHTML(feature.properties), {
            closeButton: false,
            offset: [0, -10]
          });
        }
      });

      // ✅ Start propre
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
