import * as THREE from 'three';
import { Joystick } from './joystick.js';
import { Player } from './player.js';
import { loadTokyoOSM, worldToLatLon, TOKYO_ORIGIN } from './tokyo-data.js';
import { buildWorld, setupAtmosphere } from './world-builder.js';
import { DayNightCycle } from './day-night.js';
import { TokyoAudio } from './audio-jp.js';
import { buildInteriors } from './interiors.js';
import { TrainCycle } from './railway.js';

const $ = (id) => document.getElementById(id);

function setLoad(p, text) {
  const fill = $('load-fill');
  const t = $('load-text');
  if (fill) fill.style.width = `${Math.round(p * 100)}%`;
  if (t && text) t.textContent = text;
}

function setPrompt(text, show = true) {
  const el = $('interact-prompt');
  if (!el) return;
  if (!show || !text) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.remove('hidden');
}

function setZoneBadge(text) {
  const el = $('zone-badge');
  if (!el) return;
  if (!text) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.remove('hidden');
}

async function main() {
  setLoad(0.05, '初始化 Three.js…');

  const canvas = $('c');
  // Higher pixel ratio on desktop for finer street detail (Yakuza-like clarity)
  const isMobile =
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2.25));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if ('physicallyCorrectLights' in renderer) renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  const { sun, hemi } = setupAtmosphere(scene, renderer);

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.08,
    isMobile ? 900 : 1600
  );

  const amb = new THREE.AmbientLight(0x8a96a8, 0.42);
  scene.add(amb);
  // Soft fill for street-level detail
  const streetFill = new THREE.HemisphereLight(0xb0c4de, 0x3a3028, 0.18);
  scene.add(streetFill);

  setLoad(0.12, '載入東京真實地圖資料（OpenStreetMap）…');

  let mapData;
  try {
    mapData = await loadTokyoOSM(TOKYO_ORIGIN, 450, setLoad);
  } catch (e) {
    console.error(e);
    setLoad(0.5, '載入失敗，使用樣本資料…');
    mapData = await loadTokyoOSM(TOKYO_ORIGIN, 100, () => {});
  }

  setLoad(0.75, `建立 3D 建築（${mapData.count} 棟）・日本街景…`);
  await new Promise((r) => setTimeout(r, 20));

  const world = await buildWorld(scene, mapData, setLoad);
  const interiors = buildInteriors(scene);
  const trainCycle = new TrainCycle();

  setLoad(0.9, '設定玩家控制・日夜・音效・鐵路…');

  const allStreetLights = [
    ...(world.streetLights || []),
    ...(world.konbiniPositions || []).map((k) => k.light).filter(Boolean),
  ];

  const dayNight = new DayNightCycle({
    scene,
    renderer,
    sun,
    hemi,
    ambient: amb,
    streetLights: allStreetLights,
    neonMaterials: world.neonMaterials || [],
    startHour: 18.5,
    cycleMinutes: 8,
    clockEl: $('clock'),
    phaseEl: $('phase'),
  });

  const audio = new TokyoAudio();

  const unlockAudio = () => {
    audio.ensure();
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  $('btn-mute')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await audio.ensure();
    const muted = audio.toggleMute();
    const btn = $('btn-mute');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title = muted ? '開啟音效' : '靜音';
    }
  });

  $('btn-tod')?.addEventListener('click', (e) => {
    e.stopPropagation();
    dayNight.skip(6);
  });

  const player = new Player(camera, world.colliders);
  player.reset(0, 0);
  player.bindLook(canvas);

  const joy = new Joystick($('joystick-base'), $('joystick-stick'));

  $('btn-loc')?.addEventListener('click', () => {
    if (player.interiorMode) exitInterior();
    player.reset(0, 0);
  });

  // —— Interior enter / exit ——
  let activeZone = null;
  let streetReturn = { x: 0, z: 0, yaw: 0 };
  let interactCooldown = 0;

  function enterZone(zone) {
    if (!zone || player.interiorMode) return;
    streetReturn = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
    };
    activeZone = zone;
    interiors.setVisible(zone.id, true);
    const off = zone.room.userData.worldOffset;
    player.enterInterior({
      x: off.x + zone.spawn.x,
      z: off.z + zone.spawn.z,
      yaw: zone.spawn.yaw ?? Math.PI,
      cx: off.x,
      cz: off.z,
      maxR: zone.type === 'station' ? 18 : 7.5,
    });
    audio.ensure().then(() => {
      if (zone.type === 'konbini') {
        audio.playKonbiniEnter(zone.brand || 'familymart');
        setTimeout(() => audio.announceKonbiniWelcome(zone.brand || 'familymart'), 400);
      } else if (zone.type === 'station') {
        audio.announceEnterStation(zone.stationName || '渋谷');
      }
    });
    const label =
      zone.type === 'konbini'
        ? zone.brand === 'seven'
          ? '7-ELEVEN'
          : zone.brand === 'lawson'
            ? 'LAWSON'
            : 'FamilyMart'
        : '渋谷駅 構内';
    setZoneBadge(label);
    setPrompt('靠近出口 · 按 E 或點擊提示離開');
  }

  function exitInterior() {
    if (!player.interiorMode) return;
    interiors.setVisible(null, false);
    player.exitInterior(streetReturn);
    activeZone = null;
    setZoneBadge('');
    setPrompt('', false);
  }

  function tryInteract() {
    if (interactCooldown > 0) return;
    if (player.interiorMode) {
      // Exit if near door
      if (!activeZone) {
        exitInterior();
        return;
      }
      const off = activeZone.room.userData.worldOffset;
      const lx = player.position.x - off.x;
      const lz = player.position.z - off.z;
      const d = Math.hypot(lx - activeZone.exit.x, lz - activeZone.exit.z);
      if (d < activeZone.exit.radius + 1.5) {
        interactCooldown = 0.6;
        exitInterior();
      }
      return;
    }
    // Street: find nearby enter zone
    const px = player.position.x;
    const pz = player.position.z;
    let best = null;
    let bestD = 999;
    for (const z of interiors.zones) {
      const d = Math.hypot(px - z.enter.x, pz - z.enter.z);
      if (d < z.enter.radius && d < bestD) {
        best = z;
        bestD = d;
      }
    }
    if (best) {
      interactCooldown = 0.6;
      enterZone(best);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' || e.code === 'Space') {
      e.preventDefault();
      tryInteract();
    }
  });
  $('interact-prompt')?.addEventListener('click', (e) => {
    e.stopPropagation();
    tryInteract();
  });

  // Minimap
  const mm = $('minimap');
  const mmCtx = mm?.getContext('2d');

  function drawMinimap() {
    if (!mmCtx || !mm) return;
    const W = mm.width;
    const H = mm.height;
    mmCtx.fillStyle = dayNight.isNight ? '#0e1520' : '#1a2332';
    mmCtx.fillRect(0, 0, W, H);

    if (player.interiorMode) {
      mmCtx.fillStyle = '#1a2838';
      mmCtx.fillRect(0, 0, W, H);
      mmCtx.fillStyle = '#5eead4';
      mmCtx.font = '11px sans-serif';
      mmCtx.textAlign = 'center';
      mmCtx.fillText(activeZone?.type === 'station' ? '駅構内' : 'コンビニ内', W / 2, H / 2);
      mmCtx.strokeStyle = 'rgba(255,255,255,0.15)';
      mmCtx.strokeRect(0.5, 0.5, W - 1, H - 1);
      return;
    }

    const scale = 0.22;
    const cx = W / 2;
    const cy = H / 2;
    const px = player.position.x;
    const pz = player.position.z;

    mmCtx.strokeStyle = '#3a4558';
    mmCtx.lineWidth = 1.5;
    for (const road of mapData.roads) {
      if (!road.points?.length) continue;
      mmCtx.beginPath();
      road.points.forEach(([x, z], i) => {
        const sx = cx + (x - px) * scale;
        const sy = cy + (z - pz) * scale;
        if (i === 0) mmCtx.moveTo(sx, sy);
        else mmCtx.lineTo(sx, sy);
      });
      mmCtx.stroke();
    }

    mmCtx.fillStyle = '#5a6578';
    let n = 0;
    for (const b of mapData.buildings) {
      if (n++ > 220) break;
      const ring = b.ring;
      if (!ring?.length) continue;
      if (b.isLandmark) mmCtx.fillStyle = '#c45c4a';
      else mmCtx.fillStyle = dayNight.isNight ? '#3a4558' : '#5a6578';
      mmCtx.beginPath();
      ring.forEach(([x, z], i) => {
        const sx = cx + (x - px) * scale;
        const sy = cy + (z - pz) * scale;
        if (i === 0) mmCtx.moveTo(sx, sy);
        else mmCtx.lineTo(sx, sy);
      });
      mmCtx.fill();
    }

    // Konbini (green)
    mmCtx.fillStyle = '#00c853';
    for (const k of world.konbiniPositions || []) {
      const sx = cx + (k.x - px) * scale;
      const sy = cy + (k.z - pz) * scale;
      if (sx < 0 || sy < 0 || sx > W || sy > H) continue;
      mmCtx.beginPath();
      mmCtx.arc(sx, sy, 2.8, 0, Math.PI * 2);
      mmCtx.fill();
    }

    // Stations (blue)
    mmCtx.fillStyle = '#4fc3f7';
    for (const s of world.stationZones || []) {
      const sx = cx + (s.x - px) * scale;
      const sy = cy + (s.z - pz) * scale;
      if (sx < 0 || sy < 0 || sx > W || sy > H) continue;
      mmCtx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    mmCtx.save();
    mmCtx.translate(cx, cy);
    mmCtx.rotate(-player.yaw);
    mmCtx.fillStyle = '#5eead4';
    mmCtx.beginPath();
    mmCtx.moveTo(0, -7);
    mmCtx.lineTo(5, 6);
    mmCtx.lineTo(-5, 6);
    mmCtx.closePath();
    mmCtx.fill();
    mmCtx.restore();

    mmCtx.strokeStyle = 'rgba(255,255,255,0.15)';
    mmCtx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function updatePedSignals() {
    const green = audio.crosswalkGreen;
    for (const s of world.signalHeads || []) {
      if (s.walkMat) s.walkMat.color.setHex(green ? 0x22ee66 : 0x113311);
      if (s.stopMat) s.stopMat.color.setHex(green ? 0x331111 : 0xff2222);
    }
  }

  function updateInteractPrompt() {
    if (player.interiorMode && activeZone) {
      const off = activeZone.room.userData.worldOffset;
      const lx = player.position.x - off.x;
      const lz = player.position.z - off.z;
      const d = Math.hypot(lx - activeZone.exit.x, lz - activeZone.exit.z);
      if (d < activeZone.exit.radius + 2) {
        setPrompt('按 E ／ 點擊 · 離開 → 街道');
      } else if (activeZone.type === 'station') {
        setPrompt('月台等車中 · 列車到站會有音效與廣播');
      } else {
        setPrompt('店內自由走動 · 靠近門口離開');
      }
      return;
    }

    const px = player.position.x;
    const pz = player.position.z;
    let best = null;
    let bestD = 999;
    for (const z of interiors.zones) {
      const d = Math.hypot(px - z.enter.x, pz - z.enter.z);
      if (d < z.enter.radius + 1.5 && d < bestD) {
        best = z;
        bestD = d;
      }
    }
    if (best) {
      if (best.type === 'konbini') {
        const name =
          best.brand === 'seven'
            ? '7-ELEVEN'
            : best.brand === 'lawson'
              ? 'LAWSON'
              : 'FamilyMart';
        setPrompt(`按 E ／ 點擊 · 進入 ${name}`);
      } else {
        setPrompt('按 E ／ 點擊 · 進入 鉄道駅・月台');
      }
    } else {
      setPrompt('', false);
    }
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

  setLoad(1, '完成');
  const loading = $('loading');
  setTimeout(() => loading?.classList.add('hidden'), 350);
  setTimeout(() => $('look-hint')?.classList.add('fade'), 5000);

  let frames = 0;
  let lastFps = performance.now();
  let last = performance.now();
  const coordsEl = $('coords');
  const fpsEl = $('fps');
  const districtEl = $('district');

  if (districtEl) {
    const src = mapData.source === 'openstreetmap' ? 'OSM 真實資料' : '樣本資料';
    districtEl.textContent = `渋谷 · ${world.buildingCount} 棟 · ${src}`;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (interactCooldown > 0) interactCooldown -= dt;

    player.update(dt, joy.vector);
    dayNight.update(dt);
    trainCycle.updateElevated(dt, world.root);

    let trainEvents = null;
    if (player.interiorMode && activeZone?.type === 'station') {
      const trainMesh = activeZone.room.userData.train;
      trainEvents = trainCycle.update(dt, trainMesh);
    }

    audio.update(
      dt,
      { x: player.position.x, z: player.position.z },
      {
        konbiniPositions: world.konbiniPositions || [],
        stationZones: world.stationZones || [],
        trainEvents,
        insideKonbini: player.interiorMode && activeZone?.type === 'konbini' ? activeZone.brand : null,
        insideStation: player.interiorMode && activeZone?.type === 'station',
      },
      dayNight.isNight
    );
    updatePedSignals();
    updateInteractPrompt();

    // Hide outdoor world slightly when inside? Keep both; interiors are far away
    if (world.root) world.root.visible = !player.interiorMode;

    renderer.render(scene, camera);

    frames++;
    if (now - lastFps > 500) {
      const fps = Math.round((frames * 1000) / (now - lastFps));
      frames = 0;
      lastFps = now;
      if (fpsEl) fpsEl.textContent = `${fps} fps`;

      if (!player.interiorMode) {
        const { lat, lon } = worldToLatLon(player.position.x, player.position.z);
        if (coordsEl) {
          coordsEl.textContent = `${lat.toFixed(5)}°N  ${lon.toFixed(5)}°E`;
        }
      } else if (coordsEl) {
        coordsEl.textContent =
          activeZone?.type === 'station' ? '渋谷駅 構内' : 'コンビニ 店内';
      }
      drawMinimap();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  setLoad(0, `錯誤：${err.message}`);
});
