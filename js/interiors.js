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

  // —— Konbini interiors (must match street positions in world-builder) ——
  const konbiniSpawns = [
    { id: 'fm', brand: 'familymart', variant: 0, street: { x: 42, z: 28 }, color: 0x00a040 },
    { id: 'sev', brand: 'seven', variant: 1, street: { x: -48, z: -22 }, color: 0xe60012 },
    { id: 'law', brand: 'lawson', variant: 2, street: { x: 28, z: -52 }, color: 0x0033a0 },
    { id: 'fm2', brand: 'familymart', variant: 0, street: { x: -35, z: 48 }, color: 0x00a040 },
    { id: 'sev2', brand: 'seven', variant: 1, street: { x: 70, z: 40 }, color: 0xe60012 },
    { id: 'law2', brand: 'lawson', variant: 2, street: { x: -70, z: 20 }, color: 0x0033a0 },
    { id: 'fm3', brand: 'familymart', variant: 0, street: { x: 15, z: 75 }, color: 0x00a040 },
    { id: 'sev3', brand: 'seven', variant: 1, street: { x: -80, z: -50 }, color: 0xe60012 },
    { id: 'law3', brand: 'lawson', variant: 2, street: { x: 95, z: -35 }, color: 0x0033a0 },
    { id: 'fm4', brand: 'familymart', variant: 0, street: { x: -25, z: 90 }, color: 0x00a040 },
    { id: 'sev4', brand: 'seven', variant: 1, street: { x: 55, z: 85 }, color: 0xe60012 },
    { id: 'law4', brand: 'lawson', variant: 2, street: { x: -95, z: -15 }, color: 0x0033a0 },
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

  // —— Station interior (shared platform / concourse) ——
  const stationRoom = buildStationRoom();
  stationRoom.visible = false;
  group.add(stationRoom);
  rooms.station = stationRoom;
  zones.push({
    type: 'station',
    id: 'shibuya-station',
    brand: null,
    enter: { x: -15, z: -85, radius: 8 },
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
    enter: { x: 55, z: -70, radius: 7 },
    spawn: { x: 6, z: 8, yaw: Math.PI },
    exit: { x: 0, z: 10, radius: 2.5 },
    room: stationRoom,
    stationName: '渋谷',
  });
  // Third entrance near scramble approach
  zones.push({
    type: 'station',
    id: 'shibuya-station-c',
    brand: null,
    enter: { x: 20, z: -95, radius: 7 },
    spawn: { x: -5, z: 8, yaw: Math.PI },
    exit: { x: 0, z: 10, radius: 2.5 },
    room: stationRoom,
    stationName: '渋谷',
  });

  let active = null;

  function setVisible(zoneId, on) {
    Object.values(rooms).forEach((r) => {
      r.visible = false;
    });
    if (
      on &&
      rooms[
        zoneId?.startsWith('shibuya-station')
          ? 'station'
          : zoneId
      ]
    ) {
      const key = zoneId?.startsWith('shibuya-station') ? 'station' : zoneId;
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

  // Shelves with denser product rows
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.55, metalness: 0.25 });
  for (let row = 0; row < 4; row++) {
    for (let side = -1; side <= 1; side += 2) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 4.8), shelfMat);
      shelf.position.set(side * (2.0 + row * 0.15), 1.05, -0.8 + row * 0.05);
      g.add(shelf);
      for (let p = 0; p < 8; p++) {
        const col = [0xe63946, 0x457b9d, 0x2a9d8f, 0xe9c46a, 0xff006e, 0x06d6a0, 0xff9f1c, 0x8338ec][
          p % 8
        ];
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.28, 0.18),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
        );
        box.position.set(side * (2.0 + row * 0.15), 0.45 + (p % 4) * 0.4, -2.6 + (p % 6) * 0.7);
        g.add(box);
      }
    }
  }

  // Onigiri / bento island
  const island = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.9, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.5 })
  );
  island.position.set(0, 0.45, 1.2);
  g.add(island);
  for (let i = 0; i < 6; i++) {
    const item = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, 0.22),
      new THREE.MeshStandardMaterial({
        color: [0x2d6a4f, 0xc41e3a, 0x1a4a8a, 0xe8c84a][i % 4],
        roughness: 0.6,
      })
    );
    item.position.set(-0.7 + (i % 3) * 0.55, 0.95, 0.9 + Math.floor(i / 3) * 0.45);
    g.add(item);
  }

  // Register counter
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.15, 1.0),
    new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.45, metalness: 0.15 })
  );
  counter.position.set(0, 0.58, -4.2);
  g.add(counter);
  // POS screen
  const pos = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x4488cc,
      emissiveIntensity: 0.5,
    })
  );
  pos.position.set(-1.0, 1.4, -4.2);
  g.add(pos);

  // Fridge wall glow
  const fridge = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 2.4, 0.85),
    new THREE.MeshStandardMaterial({
      color: 0xc8e8ff,
      emissive: 0x88ccff,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.45,
    })
  );
  fridge.position.set(0, 1.25, -5.5);
  g.add(fridge);
  // Fridge door lines
  for (let i = -2; i <= 2; i++) {
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 2.1),
      new THREE.MeshStandardMaterial({
        color: 0xa8d8ff,
        emissive: 0x66aacc,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.7,
      })
    );
    door.position.set(i * 1.05, 1.25, -5.05);
    g.add(door);
  }

  // Hot food warmer
  const warmer = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.7, 0.7),
    new THREE.MeshStandardMaterial({
      color: 0xffcc88,
      emissive: 0xffaa44,
      emissiveIntensity: 0.35,
    })
  );
  warmer.position.set(2.8, 1.3, -4.0);
  g.add(warmer);

  const light = new THREE.PointLight(0xfff2d8, 1.6, 18, 2);
  light.position.set(0, 2.9, 0);
  g.add(light);
  const light2 = new THREE.PointLight(0xffe8c0, 0.75, 12, 2);
  light2.position.set(0, 2.6, -3);
  g.add(light2);
  const light3 = new THREE.PointLight(0xc8e8ff, 0.5, 10, 2);
  light3.position.set(0, 2.2, -4.5);
  g.add(light3);

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

  // Yellow safety line + tactile paving
  const yellow = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xffd000 })
  );
  yellow.rotation.x = -Math.PI / 2;
  yellow.position.set(0, 0.07, -4.2);
  g.add(yellow);
  const tactile = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xe8c840 })
  );
  tactile.rotation.x = -Math.PI / 2;
  tactile.position.set(0, 0.065, -3.7);
  g.add(tactile);

  // Platform edge barrier dots
  for (let i = -8; i <= 8; i++) {
    const dot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xaa8800, emissiveIntensity: 0.3 })
    );
    dot.position.set(i * 1.8, 0.06, -4.5);
    g.add(dot);
  }

  // Overhead digital board
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1.2, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x0a1a12,
      emissive: 0x22ff88,
      emissiveIntensity: 0.35,
    })
  );
  board.position.set(0, 4.8, -2);
  g.add(board);

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
  // Multi-car Yamanote-style set
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3d8b6e,
    roughness: 0.35,
    metalness: 0.4,
  });
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xc8d0d4,
    metalness: 0.55,
    roughness: 0.35,
  });
  for (let car = 0; car < 3; car++) {
    const cx = (car - 1) * 11;
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 2.85), bodyMat);
    body.position.set(cx, 1.65, 0);
    g.add(body);
    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.25, 2.6), silverMat);
    roof.position.set(cx, 3.35, 0);
    g.add(roof);
    // Gold stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(10.05, 0.22, 2.9),
      new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.45, metalness: 0.3 })
    );
    stripe.position.set(cx, 0.95, 0);
    g.add(stripe);
    // Windows per car
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc,
      emissive: 0xaaddff,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      metalness: 0.55,
    });
    for (let i = -2; i <= 2; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.15), winMat);
      w.position.set(cx + i * 1.7, 1.95, 1.44);
      g.add(w);
      const w2 = w.clone();
      w2.position.z = -1.44;
      w2.rotation.y = Math.PI;
      g.add(w2);
    }
    // Door outlines
    for (const dx of [-3.2, 3.2]) {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 2.2),
        new THREE.MeshStandardMaterial({
          color: 0x2a5040,
          metalness: 0.4,
          roughness: 0.4,
        })
      );
      door.position.set(cx + dx, 1.5, 1.43);
      g.add(door);
    }
  }
  // Headlights
  const hl = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffee })
  );
  hl.position.set(16.1, 1.25, 0.65);
  hl.rotation.y = Math.PI / 2;
  g.add(hl);
  const hl2 = hl.clone();
  hl2.position.z = -0.65;
  g.add(hl2);
  // Destination board
  const dest = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.5, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0x0a2010,
      emissive: 0x22ff66,
      emissiveIntensity: 0.5,
    })
  );
  dest.position.set(16.05, 2.4, 0);
  g.add(dest);

  return g;
}

export { KONBINI_BRANDS };
