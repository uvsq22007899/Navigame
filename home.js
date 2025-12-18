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
