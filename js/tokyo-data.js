/**
 * Load real Tokyo (Shibuya) building footprints from OpenStreetMap Overpass API.
 * Falls back to curated sample footprints if network fails.
 *
 * Coordinate system:
 *   world X = east (meters from origin)
 *   world Z = south (meters from origin)  — matches Three.js Y-up
 *   origin  = Shibuya Scramble Crossing approx
 */
import { applyLandmarkHeight } from './landmarks.js';

export const TOKYO_ORIGIN = {
  lat: 35.6595,
  lon: 139.7006,
  name: '渋谷スクランブル交差点',
  nameEn: 'Shibuya Scramble Crossing',
};

const M_PER_DEG_LAT = 111320;
function mPerDegLon(lat) {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

export function latLonToWorld(lat, lon, origin = TOKYO_ORIGIN) {
  const x = (lon - origin.lon) * mPerDegLon(origin.lat);
  const z = -(lat - origin.lat) * M_PER_DEG_LAT;
  return { x, z };
}

export function worldToLatLon(x, z, origin = TOKYO_ORIGIN) {
  const lon = origin.lon + x / mPerDegLon(origin.lat);
  const lat = origin.lat - z / M_PER_DEG_LAT;
  return { lat, lon };
}

function parseHeight(tags = {}) {
  if (tags.height) {
    const h = parseFloat(String(tags.height).replace(/m$/i, ''));
    if (!Number.isNaN(h) && h > 2) return Math.min(h, 280);
  }
  if (tags['building:levels']) {
    const lv = parseFloat(tags['building:levels']);
    if (!Number.isNaN(lv) && lv > 0) return Math.min(lv * 3.2, 280);
  }
  if (tags.levels) {
    const lv = parseFloat(tags.levels);
    if (!Number.isNaN(lv) && lv > 0) return Math.min(lv * 3.2, 280);
  }
  // Tokyo commercial default by type
  const b = (tags.building || '').toLowerCase();
  if (b === 'skyscraper' || b === 'tower') return 120 + Math.random() * 80;
  if (b === 'apartments' || b === 'residential') return 18 + Math.random() * 25;
  if (b === 'retail' || b === 'commercial') return 15 + Math.random() * 30;
  if (b === 'yes' || b === 'building') return 12 + Math.random() * 28;
  return 10 + Math.random() * 20;
}

function ringFromNodes(nodes, nodeMap, origin) {
  const ring = [];
  for (const id of nodes) {
    const n = nodeMap.get(id);
    if (!n) continue;
    const p = latLonToWorld(n.lat, n.lon, origin);
    ring.push([p.x, p.z]);
  }
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    ring.push([...ring[0]]);
  }
  return ring;
}

function areaOfRing(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a) * 0.5;
}

/**
 * Fetch buildings + major roads around origin.
 * radiusM ~ 450 keeps mobile FPS healthy.
 */
export async function loadTokyoOSM(origin = TOKYO_ORIGIN, radiusM = 450, onProgress) {
  onProgress?.(0.15, '載入渋谷真實 OSM 資料…');

  let data = null;
  let lastErr = null;

  // 1) Local cache (pre-exported OpenStreetMap dump for Shibuya)
  try {
    const res = await fetch('assets/shibuya-osm.json', { cache: 'force-cache' });
    if (res.ok) {
      data = await res.json();
      onProgress?.(0.45, '本機 OSM 快取已載入…');
    }
  } catch (e) {
    lastErr = e;
  }

  // 2) Live Overpass if cache missing
  if (!data?.elements?.length) {
    const dLat = radiusM / M_PER_DEG_LAT;
    const dLon = radiusM / mPerDegLon(origin.lat);
    const south = origin.lat - dLat;
    const north = origin.lat + dLat;
    const west = origin.lon - dLon;
    const east = origin.lon + dLon;

    const query = `
[out:json][timeout:45];
(
  way["building"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
  way["highway"~"primary|secondary|tertiary|residential|unclassified|pedestrian|footway|living_street|trunk"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim();

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
    const encoded = encodeURIComponent(query);

    for (const base of endpoints) {
      try {
        onProgress?.(0.25, '下載渋谷地圖資料…');
        const res = await fetch(`${base}?data=${encoded}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        if (data?.elements?.length) break;
      } catch (e) {
        lastErr = e;
      }
    }
  }

  if (!data?.elements?.length) {
    console.warn('OSM fetch failed, using fallback', lastErr);
    onProgress?.(0.5, '使用內建渋谷樣本資料…');
    return buildFallback(origin);
  }

  onProgress?.(0.55, '解析建築輪廓…');
  return parseOSM(data, origin);
}

function parseOSM(data, origin) {
  const nodeMap = new Map();
  const ways = [];
  const relations = [];

  for (const el of data.elements) {
    if (el.type === 'node') nodeMap.set(el.id, el);
    else if (el.type === 'way') ways.push(el);
    else if (el.type === 'relation') relations.push(el);
  }

  const wayMap = new Map(ways.map((w) => [w.id, w]));
  const buildings = [];
  const roads = [];
  const usedWays = new Set();

  for (const rel of relations) {
    if (!rel.tags?.building) continue;
    const outer = (rel.members || []).filter((m) => m.type === 'way' && m.role === 'outer');
    for (const m of outer) {
      const w = wayMap.get(m.ref);
      if (!w?.nodes) continue;
      usedWays.add(w.id);
      const ring = ringFromNodes(w.nodes, nodeMap, origin);
      if (ring.length < 4) continue;
      const area = areaOfRing(ring);
      if (area < 8 || area > 80000) continue;
      buildings.push({
        id: `r${rel.id}-${w.id}`,
        ring,
        height: parseHeight({ ...w.tags, ...rel.tags }),
        name: rel.tags?.name || rel.tags?.['name:en'] || w.tags?.name || '',
        tags: { ...w.tags, ...rel.tags },
      });
    }
  }

  for (const w of ways) {
    if (usedWays.has(w.id)) continue;
    if (w.tags?.building && w.nodes) {
      const ring = ringFromNodes(w.nodes, nodeMap, origin);
      if (ring.length < 4) continue;
      const area = areaOfRing(ring);
      if (area < 8 || area > 80000) continue;
      buildings.push({
        id: `w${w.id}`,
        ring,
        height: parseHeight(w.tags),
        name: w.tags?.name || w.tags?.['name:en'] || '',
        tags: w.tags || {},
      });
    } else if (w.tags?.highway && w.nodes) {
      const pts = [];
      for (const id of w.nodes) {
        const n = nodeMap.get(id);
        if (!n) continue;
        const p = latLonToWorld(n.lat, n.lon, origin);
        pts.push([p.x, p.z]);
      }
      if (pts.length >= 2) {
        const hw = w.tags.highway;
        let width = 6;
        if (hw === 'primary' || hw === 'trunk') width = 14;
        else if (hw === 'secondary') width = 11;
        else if (hw === 'tertiary') width = 9;
        else if (hw === 'residential' || hw === 'unclassified') width = 7;
        else if (hw === 'pedestrian' || hw === 'footway') width = 5;
        roads.push({ id: w.id, points: pts, width, highway: hw });
      }
    }
  }

  // Apply known landmark heights (Scramble Square, Hikarie, etc.)
  const withLandmarks = buildings.map(applyLandmarkHeight);

  // Cap for mobile performance — keep tall + landmark buildings first
  withLandmarks.sort((a, b) => {
    const la = a.isLandmark ? 1000 : 0;
    const lb = b.isLandmark ? 1000 : 0;
    return lb + b.height - (la + a.height);
  });
  // Mobile Safari freezes on ~950 extruded buildings + unique canvas textures.
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const forceLight = params?.get('light') === '1' || params?.get('lite') === '1';
  const isMobile =
    forceLight ||
    (typeof navigator !== 'undefined' &&
      (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && typeof window !== 'undefined' && window.innerWidth < 1100)));
  const maxBuildings = forceLight ? 120 : isMobile ? 220 : 550;
  const capped = withLandmarks.slice(0, maxBuildings);

  return {
    origin,
    buildings: capped,
    roads,
    source: 'openstreetmap',
    count: capped.length,
    mobileLite: !!isMobile,
  };
}

/** Curated approximate Shibuya block layout if OSM is unreachable */
function buildFallback(origin) {
  const buildings = [];
  const roads = [];

  // Main scramble cross roads
  roads.push({
    id: 'r1',
    points: [[-180, 0], [180, 0]],
    width: 16,
    highway: 'primary',
  });
  roads.push({
    id: 'r2',
    points: [[0, -180], [0, 180]],
    width: 14,
    highway: 'primary',
  });
  roads.push({
    id: 'r3',
    points: [[-120, -80], [140, 100]],
    width: 12,
    highway: 'secondary',
  });

  const blocks = [
    // name, cx, cz, w, d, h
    ['SHIBUYA 109', -55, 45, 42, 38, 55],
    ['MAGNET by SHIBUYA109', 48, 52, 36, 32, 48],
    ['QFRONT / TSUTAYA', 38, -42, 40, 35, 42],
    ['Starbucks Crossing', 22, -28, 18, 16, 28],
    ['Center-Gai Block A', -35, -70, 28, 50, 22],
    ['Center-Gai Block B', -70, -55, 24, 40, 18],
    ['Hachiko Exit Tower', 70, -20, 30, 28, 95],
    ['JR Shibuya Station', 0, 95, 120, 45, 38],
    ['MARK CITY', -90, 20, 50, 40, 72],
    ['Hikarie', 110, 60, 55, 48, 180],
    ['Scramble Square', 95, -5, 48, 45, 230],
    ['Parco', -100, -90, 40, 35, 45],
    ['Tokyu Plaza', 55, 90, 45, 40, 52],
    ['CYBERT', -40, 100, 35, 30, 40],
    ['MODI', -120, 70, 38, 32, 48],
  ];

  // Procedural denser fabric around scramble
  let id = 0;
  for (const [name, cx, cz, w, d, h] of blocks) {
    const hw = w / 2;
    const hd = d / 2;
    buildings.push({
      id: `fb${id++}`,
      ring: [
        [cx - hw, cz - hd],
        [cx + hw, cz - hd],
        [cx + hw, cz + hd],
        [cx - hw, cz + hd],
        [cx - hw, cz - hd],
      ],
      height: h,
      name,
      tags: { building: 'commercial', name },
    });
  }

  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 320;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    if (Math.hypot(cx, cz) < 45) continue;
    const w = 12 + Math.random() * 28;
    const d = 12 + Math.random() * 28;
    const h = 8 + Math.random() * 55 + (Math.random() < 0.08 ? 80 : 0);
    const hw = w / 2;
    const hd = d / 2;
    const rot = Math.random() * 0.4;
    const corners = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ].map(([x, z]) => {
      const xr = x * Math.cos(rot) - z * Math.sin(rot);
      const zr = x * Math.sin(rot) + z * Math.cos(rot);
      return [cx + xr, cz + zr];
    });
    corners.push([...corners[0]]);
    buildings.push({
      id: `fp${id++}`,
      ring: corners,
      height: h,
      name: '',
      tags: { building: 'yes' },
    });
  }

  // Grid side streets
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    roads.push({
      id: `gx${i}`,
      points: [[-200, i * 50], [200, i * 50]],
      width: 7,
      highway: 'residential',
    });
    roads.push({
      id: `gz${i}`,
      points: [[i * 50, -200], [i * 50, 200]],
      width: 7,
      highway: 'residential',
    });
  }

  return {
    origin,
    buildings,
    roads,
    source: 'fallback-shibuya',
    count: buildings.length,
  };
}
