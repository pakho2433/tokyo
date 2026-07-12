/**
 * Procedural Japanese urban textures — denser, Yakuza-like street clutter.
 * Canvas-only (no external assets). FamilyMart / 7-Eleven inspired branding
 * is original recreation for ambience, not official trademarks.
 */
import * as THREE from 'three';

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isMobileClient =
  typeof navigator !== 'undefined' &&
  (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && typeof window !== 'undefined' && window.innerWidth < 1100));

function noiseFill(ctx, W, H, seed, amount = 10) {
  // Skip expensive full-buffer noise on mobile — main freeze culprit with hundreds of facades
  if (isMobileClient) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const step = 8;
  for (let i = 0; i < d.length; i += step) {
    const n = ((seed * 1103515245 + i * 12345) >>> 0) % (amount * 2) - amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Dense Japanese commercial mid-rise facade (人中之龍-style clutter) */
export function facadeTexture(seed = 0, opts = {}) {
  const night = opts.tone === 'night';
  // Reuse a small pool of facades instead of one unique huge texture per building
  const bucket = ((seed % 28) + 28) % 28;
  const key = `f-yakuza-b${bucket}-${night ? 'n' : 'd'}-v5`;
  if (cache.has(key)) return cache.get(key);

  const W = isMobileClient ? 128 : 256;
  const H = isMobileClient ? 256 : 512;
  seed = bucket;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(seed * 9973 + 17);

  const bases = [
    [218, 204, 182],
    [186, 192, 200],
    [228, 216, 196],
    [164, 172, 184],
    [236, 226, 208],
    [148, 156, 166],
    [206, 192, 178],
    [174, 180, 190],
    [240, 232, 214],
    [158, 146, 138],
    [200, 196, 188],
    [170, 178, 172],
  ];
  const base = bases[seed % bases.length];
  const r = Math.min(255, Math.max(70, base[0] + ((seed * 13) % 20) - 10));
  const g = Math.min(255, Math.max(70, base[1] + ((seed * 7) % 18) - 9));
  const b = Math.min(255, Math.max(60, base[2] + ((seed * 3) % 16) - 8));

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, W, H);

  // Tile / panel cladding (finer grain for Yakuza density)
  const panelH = 10 + (seed % 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += panelH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const panelW = 22 + (seed % 16);
  for (let x = 0; x < W; x += panelW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Weathered streaks / rain trails
  ctx.strokeStyle = 'rgba(40,45,50,0.08)';
  for (let i = 0; i < 18; i++) {
    const sx = (rnd() * W) | 0;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + (rnd() - 0.5) * 8, H);
    ctx.stroke();
  }

  // Subtle vertical seams / expansion joints
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  for (let x = 40; x < W; x += 70 + (seed % 28)) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Pipe / conduit runs (classic JP mid-rise detail)
  ctx.strokeStyle = 'rgba(90,98,108,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const px = 20 + ((seed + i * 41) % (W - 40));
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
    // pipe clamps
    ctx.fillStyle = 'rgba(60,66,74,0.7)';
    for (let y = 40; y < H; y += 90) ctx.fillRect(px - 4, y, 8, 6);
  }

  noiseFill(ctx, W, H, seed, 10);

  const floors = 16 + (seed % 12);
  const cols = 7 + (seed % 5);
  const marginX = 14;
  const marginY = 22;
  const floorH = (H - marginY * 2) / floors;
  const colW = (W - marginX * 2) / cols;
  const winPadX = 2 + (seed % 3);
  const winPadY = 2 + (seed % 2);
  const litChance = night ? 72 : 42;

  for (let fy = 0; fy < floors; fy++) {
    // Floor ledge
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, marginY + fy * floorH, W, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, marginY + fy * floorH + 2, W, 1);

    // AC units on some floors (dense like Kamurocho)
    if ((seed + fy) % 3 === 0) {
      const acX = marginX + ((seed + fy * 3) % cols) * colW + 4;
      ctx.fillStyle = '#6a7078';
      ctx.fillRect(acX, marginY + fy * floorH + 3, 22, 12);
      ctx.fillStyle = '#4a5058';
      ctx.fillRect(acX + 2, marginY + fy * floorH + 5, 18, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(acX + 3, marginY + fy * floorH + 9, 16, 2);
      // vent grille
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let g = 0; g < 4; g++) {
        ctx.fillRect(acX + 4 + g * 4, marginY + fy * floorH + 6, 2, 4);
      }
    }

    // Balcony rail strip
    if ((seed + fy) % 5 === 0) {
      ctx.fillStyle = 'rgba(30,34,40,0.55)';
      ctx.fillRect(marginX, marginY + fy * floorH + floorH - 5, W - marginX * 2, 3);
      ctx.fillStyle = 'rgba(180,190,200,0.25)';
      for (let rx = marginX; rx < W - marginX; rx += 10) {
        ctx.fillRect(rx, marginY + fy * floorH + floorH - 12, 2, 10);
      }
    }

    for (let cx = 0; cx < cols; cx++) {
      const lit = ((seed + fy * 17 + cx * 31) % 100) < litChance;
      const wx = marginX + cx * colW + winPadX;
      const wy = marginY + fy * floorH + winPadY;
      const ww = colW - winPadX * 2;
      const wh = floorH - winPadY * 2 - 3;

      // Window frame (aluminum + depth)
      ctx.fillStyle = 'rgba(45,52,62,0.92)';
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      ctx.fillStyle = 'rgba(120,130,140,0.35)';
      ctx.fillRect(wx - 1, wy - 1, ww + 2, 1.5);

      if (lit) {
        const warm = (seed + fy + cx) % 3 === 0;
        const cool = (seed + fy + cx) % 5 === 0;
        const gr = warm ? 255 : cool ? 180 : 210;
        const gg = warm ? 228 : cool ? 220 : 242;
        const gb = warm ? 155 : cool ? 255 : 255;
        const alpha = night ? 0.92 : 0.58 + ((seed + fy * cx) % 25) / 100;
        ctx.fillStyle = `rgba(${gr},${gg},${gb},${alpha})`;
      } else {
        const dark = night ? 14 : 48;
        ctx.fillStyle = `rgba(${dark + 6},${dark + 14},${dark + 28},0.92)`;
      }
      ctx.fillRect(wx, wy, ww, wh);

      // Interior silhouette when lit (desk / figure block)
      if (lit && (seed + fy + cx) % 6 === 0) {
        ctx.fillStyle = 'rgba(40,30,20,0.28)';
        ctx.fillRect(wx + ww * 0.15, wy + wh * 0.45, ww * 0.7, wh * 0.5);
      }

      // Curtain / blinds detail
      if (!lit && (seed + fy + cx) % 4 === 0) {
        ctx.fillStyle = 'rgba(80,70,90,0.4)';
        ctx.fillRect(wx, wy, ww * 0.48, wh);
      }
      if (lit && (seed + cx) % 3 === 0) {
        ctx.fillStyle = 'rgba(40,30,20,0.22)';
        for (let by = 0; by < wh; by += 2.5) {
          ctx.fillRect(wx, wy + by, ww, 1);
        }
      }

      // Glass reflection streak
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(wx + 2, wy + 2, ww * 0.22, wh - 4);

      if (ww > 14) {
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.fillRect(wx + ww * 0.5 - 0.5, wy, 1, wh);
      }
      if (wh > 16 && (seed + fy) % 3 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(wx, wy + wh * 0.5, ww, 1);
      }
    }
  }

  // Ground floor — dense retail strip
  const shopH = floorH * 1.55;
  const shopY = H - shopH;
  const shopPalettes = [
    [38, 38, 46],
    [24, 52, 40],
    [72, 28, 34],
    [48, 42, 68],
    [92, 52, 28],
    [22, 42, 68],
    [60, 20, 50],
    [30, 48, 58],
  ];
  const sp = shopPalettes[seed % shopPalettes.length];
  ctx.fillStyle = `rgb(${sp[0]},${sp[1]},${sp[2]})`;
  ctx.fillRect(0, shopY, W, shopH);

  // Stone / tile base skirting
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, H - 14, W, 14);
  ctx.fillStyle = 'rgba(180,170,150,0.15)';
  for (let x = 0; x < W; x += 16) {
    ctx.fillRect(x, H - 14, 1, 14);
  }

  for (let cx = 0; cx < cols; cx++) {
    const wx = marginX + cx * colW + 4;
    const ww = colW - 8;
    const glow = night || (seed + cx) % 3 !== 0;
    if (glow) {
      ctx.fillStyle = `rgba(255,${210 + (seed % 35)},${150 + (cx % 50)},0.58)`;
    } else {
      ctx.fillStyle = 'rgba(120,140,160,0.48)';
    }
    ctx.fillRect(wx, shopY + 18, ww, shopH - 36);

    // Reflections / poster strips on glass
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(wx + 4, shopY + 24, ww * 0.3, shopH - 48);
    if (cx === Math.floor(cols / 2)) {
      ctx.fillStyle = 'rgba(18,22,28,0.7)';
      ctx.fillRect(wx + ww * 0.22, shopY + 22, ww * 0.56, shopH - 30);
      // Door handle
      ctx.fillStyle = '#c0c8d0';
      ctx.fillRect(wx + ww * 0.7, shopY + shopH * 0.45, 3, 10);
    }
  }

  // Multi-layer kanban strip (看板 clutter — Kamurocho density)
  const signColors = [
    ['#e63946', '#fff'],
    ['#1d3557', '#f1faee'],
    ['#2a9d8f', '#fff'],
    ['#e9c46a', '#1a1a1a'],
    ['#9b2226', '#ffe8a3'],
    ['#457b9d', '#fff'],
    ['#ff006e', '#fff'],
    ['#3a0ca3', '#f72585'],
    ['#ff9f1c', '#1a0a00'],
    ['#2ec4b6', '#00332e'],
    ['#ffbe0b', '#1a1000'],
    ['#7209b7', '#fff'],
  ];
  const sc = signColors[seed % signColors.length];
  ctx.fillStyle = sc[0];
  ctx.fillRect(2, shopY + 2, W - 4, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(2, shopY + 2, W - 4, 3);
  ctx.fillStyle = sc[1];
  ctx.font = 'bold 16px "Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const shopNames = [
    'ラーメン',
    '居酒屋',
    '焼肉',
    '寿司',
    '薬局',
    '書店',
    'カフェ',
    'パチンコ',
    '美容室',
    '弁当',
    'カラオケ',
    '電気屋',
    'ゲーム',
    '洋服',
    '中華',
    '定食',
    '雀荘',
    'ネットカフェ',
    '立ち飲み',
    '串カツ',
    'うどん',
    'たい焼き',
  ];
  ctx.fillText(shopNames[seed % shopNames.length], W / 2, shopY + 12);

  // Second sign band
  const sc3 = signColors[(seed + 5) % signColors.length];
  ctx.fillStyle = sc3[0];
  ctx.fillRect(4, shopY + 24, W * 0.42, 14);
  ctx.fillStyle = sc3[1];
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(shopNames[(seed + 2) % shopNames.length], 4 + W * 0.21, shopY + 31);

  // Secondary hanging signs (stacked)
  if (seed % 2 === 0) {
    const sc2 = signColors[(seed + 3) % signColors.length];
    ctx.fillStyle = sc2[0];
    ctx.fillRect(W - 56, shopY - 100, 42, 90);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(W - 54, shopY - 98, 38, 86);
    ctx.fillStyle = sc2[1];
    ctx.font = 'bold 16px sans-serif';
    const chars = [...shopNames[(seed + 1) % shopNames.length]].slice(0, 4);
    chars.forEach((ch, i) => ctx.fillText(ch, W - 35, shopY - 80 + i * 20));
  }
  // Left hanging sign
  if (seed % 3 !== 1) {
    const scL = signColors[(seed + 7) % signColors.length];
    ctx.fillStyle = scL[0];
    ctx.fillRect(8, shopY - 70, 32, 64);
    ctx.fillStyle = scL[1];
    ctx.font = 'bold 14px sans-serif';
    const charsL = [...shopNames[(seed + 4) % shopNames.length]].slice(0, 3);
    charsL.forEach((ch, i) => ctx.fillText(ch, 24, shopY - 52 + i * 18));
  }

  // Awning / noren
  if (seed % 3 !== 2) {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? sc[0] : 'rgba(0,0,0,0.22)';
      ctx.fillRect(6 + i * 76, shopY + 40, 60, 12);
    }
  }

  // Poster stickers on wall above shops
  for (let i = 0; i < 5; i++) {
    const pc = signColors[(seed + i * 2) % signColors.length];
    ctx.fillStyle = pc[0];
    const px = 20 + i * 140 + (seed % 20);
    const py = shopY - 40 - (i % 2) * 12;
    ctx.fillRect(px, py, 48, 32);
    ctx.fillStyle = pc[1];
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('OPEN', px + 24, py + 16);
  }

  // Roof edge detail at top
  ctx.fillStyle = 'rgba(40,44,50,0.9)';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = 'rgba(80,88,96,0.55)';
  ctx.fillRect(0, 14, W, 5);
  // Antenna / water tank silhouette
  ctx.fillStyle = 'rgba(70,76,84,0.85)';
  ctx.fillRect(W * 0.7, 2, 8, 18);
  ctx.beginPath();
  ctx.arc(W * 0.35, 10, 14, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = isMobileClient ? 1 : 4;
  tex.generateMipmaps = !isMobileClient;
  if (isMobileClient) tex.minFilter = THREE.LinearFilter;
  cache.set(key, tex);
  return tex;
}

/** Vertical Japanese neon kanban */
export function verticalSignTexture(seed = 0, text) {
  const labels = text
    ? [text]
    : [
        '焼肉',
        'ラーメン',
        '居酒屋',
        'カラオケ',
        '薬局',
        '寿司',
        'ホテル',
        'ゲーム',
        'パチスロ',
        '弁当',
        '酒',
        '美容',
        '雀荘',
        '立ち飲み',
        '串カツ',
        'ネット',
      ];
  const label = labels[seed % labels.length];
  const key = `vsign-${seed}-${label}-v3`;
  if (cache.has(key)) return cache.get(key);

  const W = 128;
  const H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const colors = [
    ['#ff2d55', '#fff'],
    ['#00d4ff', '#001018'],
    ['#ffbe0b', '#1a1000'],
    ['#7b2cbf', '#fff'],
    ['#06d6a0', '#002018'],
    ['#ef476f', '#fff'],
    ['#118ab2', '#fff'],
    ['#f77f00', '#1a0a00'],
  ];
  const c = colors[seed % colors.length];
  // Gradient body
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c[0]);
  g.addColorStop(1, shadeHex(c[0], -30));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = c[1];
  ctx.font = 'bold 36px "Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...label];
  const gap = (H - 48) / Math.max(chars.length, 1);
  chars.forEach((ch, i) => {
    ctx.shadowColor = c[0];
    ctx.shadowBlur = 12;
    ctx.fillText(ch, W / 2, 32 + i * gap);
  });
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function shadeHex(hex, amt) {
  // rough darken for gradients; hex like #ff2d55
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt;
  let g = ((n >> 8) & 0xff) + amt;
  let b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

export function billboardTexture(seed = 0) {
  const key = `bb-${seed}-v2`;
  if (cache.has(key)) return cache.get(key);

  const W = 768;
  const H = 432;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const themes = [
    { bg: ['#ff006e', '#8338ec'], title: 'SHIBUYA', sub: 'ナイトライフ' },
    { bg: ['#fb5607', '#ffbe0b'], title: '東京ビール', sub: '冷たい一杯' },
    { bg: ['#3a86ff', '#8338ec'], title: 'スマホ新発売', sub: '限定キャンペーン' },
    { bg: ['#06d6a0', '#118ab2'], title: 'JR 山手線', sub: '次は渋谷' },
    { bg: ['#ef476f', '#ffd166'], title: 'アニメ新作', sub: '今週末公開' },
    { bg: ['#073b4c', '#118ab2'], title: 'コンビニ', sub: '24時間営業' },
    { bg: ['#9b2226', '#370617'], title: '居酒屋通り', sub: '飲み放題' },
    { bg: ['#0077b6', '#023e8a'], title: '地下鉄', sub: '各駅停車' },
  ];
  const t = themes[seed % themes.length];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg[0]);
  g.addColorStop(1, t.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Film grain bars
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 12; i++) ctx.fillRect(0, i * 36, W, 2);
  // City silhouette
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 18; i++) {
    const bx = i * 44;
    const bh = 40 + ((seed * 7 + i * 13) % 90);
    ctx.fillRect(bx, H - bh, 36, bh);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 16;
  ctx.fillText(t.title, W / 2, H / 2 - 28);
  ctx.shadowBlur = 0;
  ctx.font = '36px "Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(t.sub, W / 2, H / 2 + 44);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(W - 110, H - 42, 96, 28);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('広告', W - 62, H - 28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/**
 * Convenience store facade.
 * variant: 0 = FamilyMart-inspired, 1 = 7-Eleven-inspired, 2 = Lawson-inspired
 */
export function konbiniTexture(variant = 0) {
  const key = `konbini-${variant}-v5`;
  if (cache.has(key)) return cache.get(key);

  const W = 768;
  const H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const schemes = [
    {
      wall: '#f4f8f4',
      stripe: ['#00a040', '#00a0e9', '#00a040'],
      name: 'FamilyMart',
      nameJa: 'ファミリーマート',
      accent: '#00a040',
    },
    {
      wall: '#fff8f5',
      stripe: ['#e60012', '#ff6600', '#e60012'],
      name: '7-ELEVEN',
      nameJa: 'セブン‐イレブン',
      accent: '#e60012',
    },
    {
      wall: '#f5f8ff',
      stripe: ['#0033a0', '#ffffff', '#0033a0'],
      name: 'LAWSON',
      nameJa: 'ローソン',
      accent: '#0033a0',
    },
  ];
  const s = schemes[variant % schemes.length];
  ctx.fillStyle = s.wall;
  ctx.fillRect(0, 0, W, H);

  // Header stripe (thicker, more brand presence)
  const sh = 72;
  const band = W / s.stripe.length;
  s.stripe.forEach((col, i) => {
    ctx.fillStyle = col === '#ffffff' ? '#f0f4ff' : col;
    ctx.fillRect(i * band, 0, band + 1, sh);
  });
  // Gloss highlight on stripe
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.fillText(s.name, W / 2, 28);
  ctx.shadowBlur = 0;
  ctx.font = '18px "Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.fillText(s.nameJa, W / 2, 54);

  // Bright interior glass with warm fluorescent glow
  const gGlass = ctx.createLinearGradient(0, sh, 0, H);
  gGlass.addColorStop(0, 'rgba(255,252,230,0.98)');
  gGlass.addColorStop(0.5, 'rgba(255,245,200,0.92)');
  gGlass.addColorStop(1, 'rgba(255,230,160,0.88)');
  ctx.fillStyle = gGlass;
  ctx.fillRect(14, sh + 10, W - 28, H - sh - 58);

  // Window mullions + frame
  ctx.strokeStyle = 'rgba(40,50,60,0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, sh + 10, W - 28, H - sh - 58);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, sh + 10);
  ctx.lineTo(W / 2, H - 48);
  ctx.moveTo(14, sh + 10 + (H - sh - 58) * 0.55);
  ctx.lineTo(W - 14, sh + 10 + (H - sh - 58) * 0.55);
  ctx.stroke();

  // Automatic sliding door
  ctx.fillStyle = 'rgba(30,40,50,0.5)';
  ctx.fillRect(W / 2 - 55, sh + 50, 110, H - sh - 120);
  ctx.fillStyle = 'rgba(190,215,235,0.55)';
  ctx.fillRect(W / 2 - 48, sh + 58, 42, H - sh - 140);
  ctx.fillRect(W / 2 + 6, sh + 58, 42, H - sh - 140);
  // Door handles
  ctx.fillStyle = '#c8d0d8';
  ctx.fillRect(W / 2 - 10, sh + 120, 4, 28);
  ctx.fillRect(W / 2 + 6, sh + 120, 4, 28);
  // Automatic door sensor bar
  ctx.fillStyle = s.accent;
  ctx.fillRect(W / 2 - 58, sh + 44, 116, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(W / 2 - 20, sh + 46, 40, 4);

  // Shelf silhouettes + product colors inside
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(90,110,70,0.28)';
    ctx.fillRect(28, sh + 55 + i * 42, W / 2 - 100, 14);
    ctx.fillRect(W / 2 + 60, sh + 55 + i * 42, W / 2 - 100, 14);
    const cols = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#ff006e'];
    for (let p = 0; p < 5; p++) {
      ctx.fillStyle = cols[p];
      ctx.globalAlpha = 0.45;
      ctx.fillRect(32 + p * 28, sh + 48 + i * 42, 18, 10);
      ctx.fillRect(W / 2 + 64 + p * 28, sh + 48 + i * 42, 18, 10);
      ctx.globalAlpha = 1;
    }
  }

  // Ceiling light strip reflection
  ctx.fillStyle = 'rgba(255,255,240,0.35)';
  ctx.fillRect(40, sh + 18, W - 80, 8);

  // Promo posters along bottom
  const posters =
    variant === 0
      ? ['#00a040', '#00a0e9', '#ffcc00', '#333', '#ff6600']
      : variant === 1
        ? ['#e60012', '#ff6600', '#22aa44', '#fff200', '#0033a0']
        : ['#0033a0', '#7ec8ff', '#ff6600', '#fff', '#00a040'];
  const labels = ['新商品', 'おにぎり', 'コーヒー', '24H', 'フェア'];
  posters.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(18 + i * 148, H - 44, 136, 34);
    ctx.fillStyle = c === '#fff' || c === '#fff200' || c === '#ffcc00' || c === '#7ec8ff' ? '#111' : '#fff';
    ctx.font = 'bold 14px "Hiragino Sans","Noto Sans JP",sans-serif';
    ctx.fillText(labels[i], 86 + i * 148, H - 27);
  });

  // Open 24h badge
  ctx.fillStyle = s.accent;
  ctx.beginPath();
  ctx.arc(W - 48, sh + 36, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('24H', W - 48, sh + 36);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Interior floor tiles for konbini */
export function konbiniFloorTexture() {
  if (cache.has('kf')) return cache.get('kf');
  const W = 128;
  const H = 128;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('kf', tex);
  return tex;
}

/** Station sign / JR style board */
export function stationSignTexture(nameJa = '渋谷', nameEn = 'SHIBUYA') {
  const key = `stsign-${nameJa}`;
  if (cache.has(key)) return cache.get(key);
  const W = 512;
  const H = 128;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a3a6e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 8, H);
  ctx.fillRect(W - 8, 0, 8, H);
  ctx.font = 'bold 42px "Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nameJa, W / 2, 48);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#a8d4ff';
  ctx.fillText(nameEn, W / 2, 92);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

export function asphaltTexture() {
  if (cache.has('asphalt-v2')) return cache.get('asphalt-v2');
  const W = 512;
  const H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c4048';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 32) | 0;
    d[i] = 54 + n;
    d[i + 1] = 58 + n;
    d[i + 2] = 64 + n;
  }
  ctx.putImageData(img, 0, 0);
  // Wet patches / tire marks
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * W, Math.random() * H, 20 + Math.random() * 40, 8 + Math.random() * 16, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * W, Math.random() * H);
    ctx.lineTo(Math.random() * W, Math.random() * H);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('asphalt-v2', tex);
  return tex;
}

export function sidewalkTexture() {
  if (cache.has('sidewalk-v2')) return cache.get('sidewalk-v2');
  const W = 256;
  const H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6e727a';
  ctx.fillRect(0, 0, W, H);
  noiseFill(ctx, W, H, 42, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Yellow tactile paving (点字ブロック)
  ctx.fillStyle = 'rgba(230, 190, 40, 0.55)';
  ctx.fillRect(0, 112, W, 28);
  ctx.fillStyle = 'rgba(200, 160, 20, 0.4)';
  for (let x = 4; x < W; x += 10) {
    for (let y = 116; y < 136; y += 10) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('sidewalk-v2', tex);
  return tex;
}

export function clearTextureCache() {
  for (const tex of cache.values()) {
    if (tex && tex.dispose) tex.dispose();
  }
  cache.clear();
}
