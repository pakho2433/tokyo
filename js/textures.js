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

function noiseFill(ctx, W, H, seed, amount = 10) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
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
  const key = `f-yakuza-${seed}-${night ? 'n' : 'd'}-v2`;
  if (cache.has(key)) return cache.get(key);

  const W = 512;
  const H = 1024;
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

  // Tile / panel cladding
  const panelH = 14 + (seed % 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += panelH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const panelW = 28 + (seed % 20);
  for (let x = 0; x < W; x += panelW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Subtle vertical seams / expansion joints
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let x = 40; x < W; x += 80 + (seed % 30)) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  noiseFill(ctx, W, H, seed, 8);

  const floors = 14 + (seed % 10);
  const cols = 6 + (seed % 5);
  const marginX = 12;
  const marginY = 18;
  const floorH = (H - marginY * 2) / floors;
  const colW = (W - marginX * 2) / cols;
  const winPadX = 3 + (seed % 3);
  const winPadY = 3 + (seed % 2);
  const litChance = night ? 68 : 38;

  for (let fy = 0; fy < floors; fy++) {
    // Floor ledge
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, marginY + fy * floorH, W, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, marginY + fy * floorH + 2, W, 1);

    // AC units on some floors
    if ((seed + fy) % 4 === 0) {
      const acX = marginX + ((seed + fy * 3) % cols) * colW + 4;
      ctx.fillStyle = '#6a7078';
      ctx.fillRect(acX, marginY + fy * floorH + 4, 18, 10);
      ctx.fillStyle = '#4a5058';
      ctx.fillRect(acX + 2, marginY + fy * floorH + 6, 14, 3);
    }

    for (let cx = 0; cx < cols; cx++) {
      const lit = ((seed + fy * 17 + cx * 31) % 100) < litChance;
      const wx = marginX + cx * colW + winPadX;
      const wy = marginY + fy * floorH + winPadY;
      const ww = colW - winPadX * 2;
      const wh = floorH - winPadY * 2 - 3;

      // Window frame (aluminum)
      ctx.fillStyle = 'rgba(55,62,72,0.85)';
      ctx.fillRect(wx - 1.5, wy - 1.5, ww + 3, wh + 3);

      if (lit) {
        const warm = (seed + fy + cx) % 3 === 0;
        const gr = warm ? 255 : 210;
        const gg = warm ? 228 : 242;
        const gb = warm ? 155 : 255;
        const alpha = night ? 0.9 : 0.55 + ((seed + fy * cx) % 25) / 100;
        ctx.fillStyle = `rgba(${gr},${gg},${gb},${alpha})`;
      } else {
        const dark = night ? 16 : 52;
        ctx.fillStyle = `rgba(${dark + 8},${dark + 16},${dark + 30},0.9)`;
      }
      ctx.fillRect(wx, wy, ww, wh);

      // Curtain / blinds detail
      if (!lit && (seed + fy + cx) % 5 === 0) {
        ctx.fillStyle = 'rgba(80,70,90,0.35)';
        ctx.fillRect(wx, wy, ww * 0.45, wh);
      }
      if (lit && (seed + cx) % 4 === 0) {
        ctx.fillStyle = 'rgba(40,30,20,0.2)';
        for (let by = 0; by < wh; by += 3) {
          ctx.fillRect(wx, wy + by, ww, 1);
        }
      }

      if (ww > 16) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(wx + ww * 0.5 - 0.5, wy, 1, wh);
      }
      if (wh > 20 && (seed + fy) % 3 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
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

  // Multi-layer kanban strip (看板 clutter)
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
  ];
  const sc = signColors[seed % signColors.length];
  ctx.fillStyle = sc[0];
  ctx.fillRect(2, shopY + 2, W - 4, 16);
  ctx.fillStyle = sc[1];
  ctx.font = 'bold 13px "Hiragino Sans","Noto Sans JP",sans-serif';
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
  ];
  ctx.fillText(shopNames[seed % shopNames.length], W / 2, shopY + 10);

  // Secondary hanging signs
  if (seed % 2 === 0) {
    const sc2 = signColors[(seed + 3) % signColors.length];
    ctx.fillStyle = sc2[0];
    ctx.fillRect(W - 48, shopY - 80, 36, 72);
    ctx.fillStyle = sc2[1];
    ctx.font = 'bold 14px sans-serif';
    const chars = [...shopNames[(seed + 1) % shopNames.length]].slice(0, 3);
    chars.forEach((ch, i) => ctx.fillText(ch, W - 30, shopY - 62 + i * 20));
  }

  // Awning / noren
  if (seed % 3 !== 2) {
    ctx.fillStyle = sc[0];
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(6 + i * 62, shopY + 18, 48, 8);
      ctx.fillStyle = i % 2 === 0 ? sc[0] : 'rgba(0,0,0,0.2)';
      ctx.fillRect(6 + i * 62, shopY + 18, 48, 8);
    }
  }

  // Roof edge detail at top
  ctx.fillStyle = 'rgba(40,44,50,0.85)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = 'rgba(80,88,96,0.5)';
  ctx.fillRect(0, 10, W, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Vertical Japanese neon kanban */
export function verticalSignTexture(seed = 0, text) {
  const labels = text
    ? [text]
    : ['焼肉', 'ラーメン', '居酒屋', 'カラオケ', '薬局', '寿司', 'ホテル', 'ゲーム', 'パチスロ', '弁当', '酒', '美容'];
  const label = labels[seed % labels.length];
  const key = `vsign-${seed}-${label}-v2`;
  if (cache.has(key)) return cache.get(key);

  const W = 96;
  const H = 384;
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
  const key = `konbini-${variant}-v3`;
  if (cache.has(key)) return cache.get(key);

  const W = 512;
  const H = 384;
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

  // Header stripe
  const sh = 52;
  const band = W / s.stripe.length;
  s.stripe.forEach((col, i) => {
    ctx.fillStyle = col === '#ffffff' ? '#f0f4ff' : col;
    ctx.fillRect(i * band, 0, band + 1, sh);
  });
  ctx.fillStyle = variant === 2 ? '#0033a0' : '#fff';
  if (variant === 2) {
    ctx.fillStyle = '#fff';
  }
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.name, W / 2, 20);
  ctx.font = '14px "Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.fillText(s.nameJa, W / 2, 40);

  // Bright interior glass
  const gGlass = ctx.createLinearGradient(0, sh, 0, H);
  gGlass.addColorStop(0, 'rgba(255,248,220,0.95)');
  gGlass.addColorStop(1, 'rgba(255,236,180,0.85)');
  ctx.fillStyle = gGlass;
  ctx.fillRect(12, sh + 8, W - 24, H - sh - 48);

  // Window mullions
  ctx.strokeStyle = 'rgba(40,50,60,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, sh + 8, W - 24, H - sh - 48);
  ctx.beginPath();
  ctx.moveTo(W / 2, sh + 8);
  ctx.lineTo(W / 2, H - 40);
  ctx.stroke();

  // Door
  ctx.fillStyle = 'rgba(30,40,50,0.55)';
  ctx.fillRect(W / 2 - 40, sh + 40, 80, H - sh - 90);
  ctx.fillStyle = 'rgba(200,220,240,0.5)';
  ctx.fillRect(W / 2 - 34, sh + 48, 30, H - sh - 110);
  ctx.fillRect(W / 2 + 4, sh + 48, 30, H - sh - 110);
  // Automatic door sensor bar
  ctx.fillStyle = s.accent;
  ctx.fillRect(W / 2 - 44, sh + 36, 88, 6);

  // Shelf silhouettes inside
  ctx.fillStyle = 'rgba(80,100,60,0.25)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(24, sh + 50 + i * 36, W / 2 - 80, 12);
    ctx.fillRect(W / 2 + 50, sh + 50 + i * 36, W / 2 - 80, 12);
  }

  // Promo posters
  const posters =
    variant === 0
      ? ['#00a040', '#00a0e9', '#ffcc00', '#333']
      : variant === 1
        ? ['#e60012', '#ff6600', '#22aa44', '#fff200']
        : ['#0033a0', '#7ec8ff', '#ff6600', '#fff'];
  posters.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(20 + i * 120, H - 36, 100, 28);
    ctx.fillStyle = c === '#fff' || c === '#fff200' || c === '#ffcc00' ? '#111' : '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(['新商品', 'おにぎり', 'コーヒー', '24H'][i], 70 + i * 120, H - 22);
  });

  // Open 24h badge
  ctx.fillStyle = s.accent;
  ctx.beginPath();
  ctx.arc(W - 36, sh + 28, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('24H', W - 36, sh + 28);

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
