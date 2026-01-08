import json
from collections import defaultdict

IN_PATH = "data/stations_idf.geojson"
OUT_PATH = "data/stations_metro_rer.geojson"

KEEP_MODES = {"Metro", "RapidTransit"}  # Metro + RER (chez IDFM c'est souvent RapidTransit)

def norm(s):
  return (s or "").strip()

def key_for(p):
  # stop_id est le meilleur identifiant unique quand il existe
  sid = norm(p.get("stop_id"))
  if sid:
    return sid
  # fallback : nom + coords (rare)
  return norm(p.get("stop_name")) + "|" + norm(p.get("stop_lon")) + "|" + norm(p.get("stop_lat"))

def line_id(p):
  # pour Metro : "1", "2"... ; pour RER : "A", "B"...
  return norm(p.get("shortname")) or norm(p.get("route_long_name"))

def line_type(p):
  # Metro vs RER
  return "RER" if p.get("mode") == "RapidTransit" else "METRO"

with open(IN_PATH, "r", encoding="utf-8") as f:
  data = json.load(f)

groups = defaultdict(lambda: {
  "name": None,
  "lon": None,
  "lat": None,
  "lines": {}
})

for feat in data.get("features", []):
  p = feat.get("properties", {})
  mode = p.get("mode")
  if mode not in KEEP_MODES:
    continue

  k = key_for(p)
  g = groups[k]

  g["name"] = g["name"] or norm(p.get("stop_name")) or "Station"
  g["lon"] = g["lon"] or float(p.get("stop_lon"))
  g["lat"] = g["lat"] or float(p.get("stop_lat"))

  lid = line_id(p)
  if not lid:
    continue

  ltype = line_type(p)
  # lines dict pour éviter doublons
  g["lines"][f"{ltype}:{lid}"] = {"type": ltype, "id": lid}

features = []
for g in groups.values():
  if g["lon"] is None or g["lat"] is None:
    continue
  lines = list(g["lines"].values())
  if not lines:
    continue

  features.append({
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [g["lon"], g["lat"]]},
    "properties": {
      "name": g["name"],
      "lines": lines
    }
  })

out = {"type": "FeatureCollection", "features": features}

with open(OUT_PATH, "w", encoding="utf-8") as f:
  json.dump(out, f, ensure_ascii=False)

print(f"OK -> {OUT_PATH} ({len(features)} stations)")
