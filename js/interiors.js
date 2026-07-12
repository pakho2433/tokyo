/**
 * Enterable Japanese interiors: konbini + station concourse.
 */
import * as THREE from 'three';
import { konbiniFloorTexture, konbiniTexture, stationSignTexture } from './textures.js';

const KONBINI_BRANDS = ['familymart', 'seven', 'lawson'];

/**
 * @returns {{
 *   group: THREE.Group,
 *   zones: Array,
 *   setVisible: Function,
 *   queryZone: Function
 * }}
 */
export function buildInteriors(scene) {
  const group = new THREE.Group();
  group.name = 'interiors';
  group.visible = false;
  scene.add(group);

  const zones = [];
  const rooms = {};

  // —— Konbini interiors (3 brands) ——
  const konbiniSpawns = [
    { id: 'fm', brand: 'familymart', variant: 0, street: { x: 42, z: 28 }, color: 0x00a040 },
    { id: 'sev', brand: 'seven', variant: 1, street: { x: -48, z: -22 }, color: 0xe60012 },
    { id: 'law', brand: 'lawson', variant: 2, street: { x: 28, z: -52 }, color: 0x0033a0 },
    { id: 'fm2', brand: 'familymart', variant: 0, street: { x: -35, z: 48 }, color: 0x00a040 },
    { id: 'sev2', brand: 'seven', variant: 1, street: { x: 70, z: 40 }, color: 0xe60012 },
    { id: 'law2', brand: 'lawson', variant: 2, street: { x: -70, z: 20 }, color: 0x0033a0 },
  ];

  konbiniSpawns.forEach((k, i) => {
    const room = buildKonbiniRoom(k, i);
    room.visible = false;
    group.add(room);
    rooms[k.id] = room;
    zones.push({
      type: 'konbini',
      id: k.id,
      brand: k.brand,
      variant: k.variant,
      // Street entrance trigger
      enter: { x: k.street.x, z: k.street.z, radius: 4.2 },
      // Interior spawn
      spawn: { x: 0, z: 4.5, yaw: Math.PI },
      // Exit trigger inside room (near door)
      exit: { x: 0, z: 5.2, radius: 1.8 },
      room,
    });
  });

  // —— Station interior (shared) ——
  const stationRoom = buildStationRoom();
  stationRoom.visible = false;
  group.add(stationRoom);
  rooms.station = stationRoom;
  zones.push({
    type: 'station',
    id: 'shibuya-station',
    brand: null,
    enter: { x: -15, z: -85, radius: 7 },
    spawn: { x: 0, z: 8, yaw: Math.PI },
    exit: { x: 0, z: 10, radius: 2.5 },
    room: stationRoom,
    stationName: '渋谷',
  });
  // Second entrance near JR side
  zones.push({
    type: 'station',
    id: 'shibuya-station-b',
    brand: null,
    enter: { x: 55, z: -70, radius: 6 },
    spawn: { x: 6, z: 8, yaw: Math.PI },
    exit: { x: 0, z: 10, radius: 2.5 },
    room: stationRoom,
    stationName: '渋谷',
  });

  let active = null;

  function setVisible(zoneId, on) {
    Object.values(rooms).forEach((r) => {
      r.visible = false;
    });
    if (on && rooms[zoneId === 'shibuya-station-b' ? 'station' : zoneId === 'shibuya-station' ? 'station' : zoneId]) {
      const key =
        zoneId === 'shibuya-station' || zoneId === 'shibuya-station-b' ? 'station' : zoneId;
      rooms[key].visible = true;
      group.visible = true;
      active = zoneId;
    } else {
      group.visible = false;
      active = null;
    }
  }

  function queryZone(x, z, mode = 'street') {
    for (const zdef of zones) {
      if (mode === 'street') {
        const d = Math.hypot(x - zdef.enter.x, z - zdef.enter.z);
        if (d < zdef.enter.radius) return zdef;
      } else if (mode === 'exit' && active) {
        const isThis =
          active === zdef.id ||
          (active.startsWith('shibuya-station') && zdef.id.startsWith('shibuya-station'));
        if (!isThis && zdef.id !== active) continue;
        // Local interior coords: player is placed near spawn; exit is in room space
        // We track interior local position separately in main — here use absolute if set
        if (zdef._localPos) {
          const d = Math.hypot(zdef._localPos.x - zdef.exit.x, zdef._localPos.z - zdef.exit.z);
          if (d < zdef.exit.radius) return zdef;
        }
      }
    }
    return null;
  }

  return {
    group,
    zones,
    rooms,
    setVisible,
    queryZone,
    get active() {
      return active;
    },
    konbiniStreetList: konbiniSpawns,
  };
}

function buildKonbiniRoom(cfg, index) {
  const g = new THREE.Group();
  g.name = `konbini-interior-${cfg.id}`;
  // Offset each room far underground / aside so they don't overlap world
  const baseX = 2000 + index * 40;
  const baseZ = 2000;
  g.position.set(baseX, 0, baseZ);
  g.userData.worldOffset = { x: baseX, z: baseZ };

  const floorTex = konbiniFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 12),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, color: 0xffffff })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  g.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      emissive: 0xfff5e0,
      emissiveIntensity: 0.35,
      roughness: 0.9,
    })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.2;
  g.add(ceil);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f0, roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), wallMat);
  back.position.set(0, 1.6, -6);
  g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-7, 1.6, 0);
  g.add(left);
  const right = left.clone();
  right.position.x = 7;
  right.rotation.y = -Math.PI / 2;
  g.add(right);

  // Front wall with door opening
  const frontL = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), wallMat);
  frontL.position.set(-4.5, 1.6, 6);
  frontL.rotation.y = Math.PI;
  g.add(frontL);
  const frontR = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), wallMat);
  frontR.position.set(4.5, 1.6, 6);
  frontR.rotation.y = Math.PI;
  g.add(frontR);

  // Brand header
  const tex = konbiniTexture(cfg.variant);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.2),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.4,
    })
  );
  sign.position.set(0, 2.7, -5.9);
  g.add(sign);

  // Shelves
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.6, metalness: 0.2 });
  for (let row = 0; row < 3; row++) {
    for (let side = -1; side <= 1; side += 2) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 4.5), shelfMat);
      shelf.position.set(side * (2.2 + row * 0.1), 0.95, -1 + row * 0.05);
      g.add(shelf);
      // Product colors
      for (let p = 0; p < 6; p++) {
        const col = [0xe63946, 0x457b9d, 0x2a9d8f, 0xe9c46a, 0xff006e, 0x06d6a0][p];
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.3, 0.2),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })
        );
        box.position.set(side * (2.2 + row * 0.1), 0.5 + (p % 3) * 0.45, -2.5 + p * 0.7);
        g.add(box);
      }
    }
  }

  // Register counter
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 1.1, 0.9),
    new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.5 })
  );
  counter.position.set(0, 0.55, -4.2);
  g.add(counter);

  // Fridge glow
  const fridge = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.2, 0.8),
    new THREE.MeshStandardMaterial({
      color: 0xc8e8ff,
      emissive: 0x88ccff,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.4,
    })
  );
  fridge.position.set(0, 1.15, -5.5);
  g.add(fridge);

  const light = new THREE.PointLight(0xfff2d8, 1.4, 16, 2);
  light.position.set(0, 2.8, 0);
  g.add(light);
  const light2 = new THREE.PointLight(0xffe8c0, 0.6, 10, 2);
  light2.position.set(0, 2.5, -3);
  g.add(light2);

  // Exit mat
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.95 })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.02, 5.2);
  g.add(mat);

  return g;
}

function buildStationRoom() {
  const g = new THREE.Group();
  g.name = 'station-interior';
  const baseX = 2500;
  const baseZ = 2000;
  g.position.set(baseX, 0, baseZ);
  g.userData.worldOffset = { x: baseX, z: baseZ };

  // Concourse floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 28),
    new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.75, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  // Platform strip
  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.85 })
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.set(0, 0.05, -8);
  g.add(platform);

  // Yellow safety line
  const yellow = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 0.25),
    new THREE.MeshBasicMaterial({ color: 0xffd000 })
  );
  yellow.rotation.x = -Math.PI / 2;
  yellow.position.set(0, 0.07, -4.2);
  g.add(yellow);

  // Tracks pit
  const pit = new THREE.Mesh(
    new THREE.BoxGeometry(36, 1.2, 5),
    new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.95 })
  );
  pit.position.set(0, -0.55, -11);
  g.add(pit);

  // Rails
  const railMat = new THREE.MeshStandardMaterial({ color: 0x889099, metalness: 0.8, roughness: 0.35 });
  for (const z of [-10.3, -11.7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(34, 0.08, 0.12), railMat);
    rail.position.set(0, 0.02, z);
    g.add(rail);
  }

  // Ceiling beams
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.7 });
  for (let i = -3; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 28), beamMat);
    beam.position.set(i * 5, 5.5, 0);
    g.add(beam);
  }

  // Station sign
  const signTex = stationSignTexture('渋谷', 'SHIBUYA');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xffffff,
      emissiveMap: signTex,
      emissiveIntensity: 0.5,
    })
  );
  sign.position.set(0, 4.2, -3.5);
  g.add(sign);

  // Pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.5, metalness: 0.2 });
  for (const x of [-10, -4, 4, 10]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 5.5, 12), pillarMat);
    p.position.set(x, 2.75, 2);
    g.add(p);
  }

  // Ticket gates silhouette
  for (let i = -2; i <= 2; i++) {
    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.5, roughness: 0.4 })
    );
    gate.position.set(i * 2.2, 0.7, 10);
    g.add(gate);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0x22ee66,
        emissive: 0x22ee66,
        emissiveIntensity: 0.8,
      })
    );
    light.position.set(i * 2.2, 1.35, 10.35);
    g.add(light);
  }

  // Vending on platform
  const vend = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.7),
    new THREE.MeshStandardMaterial({
      color: 0xc41e3a,
      emissive: 0x881122,
      emissiveIntensity: 0.3,
    })
  );
  vend.position.set(12, 1, -2);
  g.add(vend);

  const amb = new THREE.PointLight(0xd0e0ff, 1.1, 40, 2);
  amb.position.set(0, 4.5, 0);
  g.add(amb);
  const platLight = new THREE.PointLight(0xffe8c0, 0.7, 25, 2);
  platLight.position.set(0, 4, -8);
  g.add(platLight);

  // Train mesh (animated by railway system via userData)
  const train = buildTrainMesh();
  train.position.set(-40, 0.6, -11);
  train.userData.isTrain = true;
  g.add(train);
  g.userData.train = train;

  return g;
}

function buildTrainMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3d8b6e,
    roughness: 0.4,
    metalness: 0.35,
  }); // Yamanote green-ish
  const body = new THREE.Mesh(new THREE.BoxGeometry(28, 3.2, 2.8), bodyMat);
  body.position.y = 1.6;
  g.add(body);
  // Windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x88aacc,
    emissive: 0xaaddff,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.5,
  });
  for (let i = -5; i <= 5; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), winMat);
    w.position.set(i * 2.3, 1.9, 1.42);
    g.add(w);
    const w2 = w.clone();
    w2.position.z = -1.42;
    w2.rotation.y = Math.PI;
    g.add(w2);
  }
  // Stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(28.1, 0.25, 2.85),
    new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.5 })
  );
  stripe.position.y = 0.9;
  g.add(stripe);
  // Headlights
  const hl = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffee })
  );
  hl.position.set(14.05, 1.2, 0.6);
  hl.rotation.y = Math.PI / 2;
  g.add(hl);
  const hl2 = hl.clone();
  hl2.position.z = -0.6;
  g.add(hl2);

  return g;
}

export { KONBINI_BRANDS };
