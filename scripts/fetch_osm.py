#!/usr/bin/env python3
"""Download Shibuya OSM extract with correct UTF-8."""
import json
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "shibuya-osm.json"

QUERY = """
[out:json][timeout:60];
(
  way["building"](35.6555,139.6965,35.6635,139.7045);
  relation["building"](35.6555,139.6965,35.6635,139.7045);
  way["highway"~"primary|secondary|tertiary|residential|unclassified|pedestrian|footway|living_street|trunk"](35.6555,139.6965,35.6635,139.7045);
);
out body;
>;
out skel qt;
""".strip()


def main() -> None:
    url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(QUERY)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Tokyo3DWalker/1.0",
            "Accept": "application/json",
        },
    )
    print("Downloading Shibuya OSM…")
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(raw)
    data = json.loads(raw.decode("utf-8"))
    names = []
    for e in data["elements"]:
        t = e.get("tags") or {}
        if t.get("building") and t.get("name"):
            names.append(t["name"])
        if len(names) >= 8:
            break
    bcount = sum(
        1
        for e in data["elements"]
        if e["type"] == "way" and (e.get("tags") or {}).get("building")
    )
    print(f"Wrote {OUT} ({len(raw)} bytes, {len(data['elements'])} elements, {bcount} buildings)")
    print("Sample names:", names)


if __name__ == "__main__":
    main()
