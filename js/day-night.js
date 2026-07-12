/**
 * Day / night cycle for Tokyo streets.
 * Full cycle ≈ cycleMinutes real minutes (default 8 min = 24 game hours).
 */
import * as THREE from 'three';

const HOUR_COLORS = {
  // [sky, fog, sun, ambient, hemiSky, hemiGround, exposure, sunIntensity]
  night: {
    sky: 0x0a1020,
    fog: 0x0c1428,
    sun: 0x8899cc,
    ambient: 0x2a3550,
    hemiSky: 0x1a2848,
    hemiGround: 0x0a0c12,
    exposure: 0.72,
    sunI: 0.12,
    ambI: 0.28,
    hemiI: 0.22,
    fogDensity: 0.0018,
    neonBoost: 1.0,
    streetI: 1.35,
  },
  dawn: {
    sky: 0xffb088,
    fog: 0xe8a888,
    sun: 0xffc8a0,
    ambient: 0xc8a890,
    hemiSky: 0xffd0b0,
    hemiGround: 0x504040,
    exposure: 0.95,
    sunI: 0.55,
    ambI: 0.4,
    hemiI: 0.45,
    fogDensity: 0.0014,
    neonBoost: 0.55,
    streetI: 0.7,
  },
  day: {
    sky: 0x87b4d8,
    fog: 0xa8c4dc,
    sun: 0xfff4e0,
    ambient: 0xb0c0d0,
    hemiSky: 0xd0e4f8,
    hemiGround: 0x6a6558,
    exposure: 1.12,
    sunI: 1.45,
    ambI: 0.5,
    hemiI: 0.62,
    fogDensity: 0.0010,
    neonBoost: 0.15,
    streetI: 0.15,
  },
  dusk: {
    sky: 0xff6b4a,
    fog: 0xd87860,
    sun: 0xff9966,
    ambient: 0xc08070,
    hemiSky: 0xffa080,
    hemiGround: 0x403830,
    exposure: 0.98,
    sunI: 0.7,
    ambI: 0.38,
    hemiI: 0.42,
    fogDensity: 0.0015,
    neonBoost: 0.75,
    streetI: 0.85,
  },
};

function lerpColor(c1, c2, t, target) {
  const a = new THREE.Color(c1);
  const b = new THREE.Color(c2);
  target.copy(a).lerp(b, t);
  return target;
}

function mixNum(a, b, t) {
  return a + (b - a) * t;
}

function phaseAtHour(hour) {
  // 0–24 → night / dawn / day / dusk blends
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return { from: 'night', to: 'dawn', t };
  }
  if (hour >= 7 && hour < 9) {
    const t = (hour - 7) / 2;
    return { from: 'dawn', to: 'day', t };
  }
  if (hour >= 9 && hour < 17) {
    return { from: 'day', to: 'day', t: 0 };
  }
  if (hour >= 17 && hour < 19) {
    const t = (hour - 17) / 2;
    return { from: 'day', to: 'dusk', t };
  }
  if (hour >= 19 && hour < 21) {
    const t = (hour - 19) / 2;
    return { from: 'dusk', to: 'night', t };
  }
  return { from: 'night', to: 'night', t: 0 };
}

function sampleEnv(hour) {
  const { from, to, t } = phaseAtHour(hour);
  const A = HOUR_COLORS[from];
  const B = HOUR_COLORS[to];
  return {
    sky: A.sky,
    fog: A.fog,
    sun: A.sun,
    ambient: A.ambient,
    hemiSky: A.hemiSky,
    hemiGround: A.hemiGround,
    skyB: B.sky,
    fogB: B.fog,
    sunB: B.sun,
    ambientB: B.ambient,
    hemiSkyB: B.hemiSky,
    hemiGroundB: B.hemiGround,
    t,
    exposure: mixNum(A.exposure, B.exposure, t),
    sunI: mixNum(A.sunI, B.sunI, t),
    ambI: mixNum(A.ambI, B.ambI, t),
    hemiI: mixNum(A.hemiI, B.hemiI, t),
    fogDensity: mixNum(A.fogDensity, B.fogDensity, t),
    neonBoost: mixNum(A.neonBoost, B.neonBoost, t),
    streetI: mixNum(A.streetI, B.streetI, t),
    phaseName: hour < 5 || hour >= 21 ? 'night' : hour < 7 ? 'dawn' : hour < 17 ? 'day' : hour < 19 ? 'dusk' : 'night',
  };
}

export class DayNightCycle {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {THREE.WebGLRenderer} opts.renderer
   * @param {THREE.DirectionalLight} opts.sun
   * @param {THREE.HemisphereLight} opts.hemi
   * @param {THREE.AmbientLight} [opts.ambient]
   * @param {THREE.Light[]} [opts.streetLights]
   * @param {{mat: THREE.Material, base: number}[]} [opts.neonMaterials]
   * @param {number} [opts.startHour] game hour 0–24
   * @param {number} [opts.cycleMinutes] real minutes for full 24h
   * @param {HTMLElement} [opts.clockEl]
   * @param {HTMLElement} [opts.phaseEl]
   */
  constructor(opts) {
    this.scene = opts.scene;
    this.renderer = opts.renderer;
    this.sun = opts.sun;
    this.hemi = opts.hemi;
    this.ambient = opts.ambient || null;
    this.streetLights = opts.streetLights || [];
    this.neonMaterials = opts.neonMaterials || [];
    this.hour = opts.startHour ?? 19.5; // start near evening Shibuya
    this.cycleMinutes = opts.cycleMinutes ?? 8;
    this.clockEl = opts.clockEl || null;
    this.phaseEl = opts.phaseEl || null;
    this.paused = false;
    this._tmp = {
      sky: new THREE.Color(),
      fog: new THREE.Color(),
      sun: new THREE.Color(),
      amb: new THREE.Color(),
      hs: new THREE.Color(),
      hg: new THREE.Color(),
    };
    this.apply(true);
  }

  get isNight() {
    return this.hour < 6 || this.hour >= 19.5;
  }

  get phaseLabel() {
    const h = this.hour;
    if (h >= 5 && h < 7) return '夜明け Dawn';
    if (h >= 7 && h < 17) return '昼 Day';
    if (h >= 17 && h < 19) return '夕方 Dusk';
    if (h >= 19 && h < 21) return '夜 Neon';
    return '深夜 Night';
  }

  setHour(h) {
    this.hour = ((h % 24) + 24) % 24;
    this.apply(true);
  }

  /** Skip forward by game hours */
  skip(hours) {
    this.setHour(this.hour + hours);
  }

  update(dt) {
    if (this.paused) return;
    // cycleMinutes real min = 24 game hours
    const hoursPerSec = 24 / (this.cycleMinutes * 60);
    this.hour = (this.hour + dt * hoursPerSec) % 24;
    this.apply(false);
  }

  apply(force) {
    const env = sampleEnv(this.hour);
    const t = env.t;
    const { sky, fog, sun, amb, hs, hg } = this._tmp;

    lerpColor(env.sky, env.skyB, t, sky);
    lerpColor(env.fog, env.fogB, t, fog);
    lerpColor(env.sun, env.sunB, t, sun);
    lerpColor(env.ambient, env.ambientB, t, amb);
    lerpColor(env.hemiSky, env.hemiSkyB, t, hs);
    lerpColor(env.hemiGround, env.hemiGroundB, t, hg);

    this.scene.background = sky.clone();
    if (this.scene.fog) {
      this.scene.fog.color.copy(fog);
      if (this.scene.fog.isFogExp2) this.scene.fog.density = env.fogDensity;
    }

    this.sun.color.copy(sun);
    this.sun.intensity = env.sunI;
    // Sun orbit: rise east, set west
    const ang = ((this.hour - 6) / 12) * Math.PI; // 6am=0, 6pm=π
    const elev = Math.sin(ang);
    const az = Math.cos(ang);
    this.sun.position.set(az * 180, Math.max(8, elev * 200), 90);

    this.hemi.color.copy(hs);
    this.hemi.groundColor.copy(hg);
    this.hemi.intensity = env.hemiI;

    if (this.ambient) {
      this.ambient.color.copy(amb);
      this.ambient.intensity = env.ambI;
    }

    this.renderer.toneMappingExposure = env.exposure;

    for (const L of this.streetLights) {
      L.intensity = (L.userData.baseIntensity ?? 1.15) * env.streetI;
      L.visible = env.streetI > 0.08;
    }

    for (const n of this.neonMaterials) {
      if (n.mat && n.mat.emissiveIntensity !== undefined) {
        n.mat.emissiveIntensity = n.base * (0.25 + env.neonBoost * 1.1);
      }
    }

    // HUD
    if (this.clockEl) {
      const H = Math.floor(this.hour);
      const M = Math.floor((this.hour % 1) * 60);
      this.clockEl.textContent = `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
    }
    if (this.phaseEl) {
      this.phaseEl.textContent = this.phaseLabel;
      this.phaseEl.dataset.phase = env.phaseName;
    }

    this._lastNeon = env.neonBoost;
    this._force = force;
  }
}
