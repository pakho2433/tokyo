import * as THREE from 'three';
import {
  facadeTexture,
  asphaltTexture,
  sidewalkTexture,
  verticalSignTexture,
  billboardTexture,
  konbiniTexture,
} from './textures.js';
import { addRailwayStations } from './railway.js';

/**
 * Build Japanese-flavoured Tokyo street scene from real OSM footprints.
 * Visual direction: dense commercial streets inspired by open-world JP urban games
 * (original procedural art — not licensed assets).
 */

const PALETTE = {
  asphalt: 0x3a3e46,
  asphaltLine: 0xc8c4a8,
  sidewalk: 0x6a6e76,
  ground: 0x4a5058,
  roof: 0x4a5058,
  neon: [0xff4d6d, 0x4cc9f0, 0xf72585, 0x7209b7, 0x80ffdb, 0xffbe0b, 0x06d6a0, 0xff006e],
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function shapeFromRing(ring) {
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
  return shape;
}

function yieldFrame() {
  return new Promise((r) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => r());
    else setTimeout(r, 0);
  });
}

/** Async world build — yields every chunk so mobile Safari stays responsive */
export async function buildWorld(scene, mapData, onProgress) {
  const root = new THREE.Group();
  root.name = 'tokyo-world';
  scene.add(root);

  const neonMaterials = [];
  const streetLights = [];
  const konbiniPositions = [];
  const signalHeads = []; // for walk light color updates

  const asphaltTex = asphaltTexture();
  const sidewalkTex = sidewalkTexture();

  // Ground plane — lighter so Japan streets don't look pitch black
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.MeshStandardMaterial({
    color: PALETTE.ground,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  root.add(ground);

  // Scramble plaza
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(55, 48),
    new THREE.MeshStandardMaterial({
      color: 0x454a52,
      roughness: 0.92,
      metalness: 0.05,
      map: asphaltTex.clone(),
    })
  );
  plaza.material.map.repeat.set(8, 8);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  root.add(plaza);

  // Roads
  const roadGroup = new THREE.Group();
  for (const road of mapData.roads) {
    if (!road.points || road.points.length < 2) continue;
    addRoadRibbon(roadGroup, road.points, road.width, asphaltTex, sidewalkTex);
  }
  root.add(roadGroup);
  await yieldFrame();

  // Buildings — chunked so UI progress bar keeps moving on phones
  const buildingGroup = new THREE.Group();
  let built = 0;
  const list = mapData.buildings || [];
  const total = list.length;
  const CHUNK = mapData.mobileLite ? 8 : 20;
  for (let i = 0; i < total; i++) {
    const b = list[i];
    try {
      const mesh = extrudeBuilding(b, neonMaterials);
      if (mesh) {
        buildingGroup.add(mesh);
        built++;
      }
    } catch {
      /* skip bad poly */
    }
    if (i % CHUNK === CHUNK - 1 || i === total - 1) {
      const p = 0.75 + 0.14 * ((i + 1) / Math.max(1, total));
      onProgress?.(p, `建立 3D 建築（${i + 1}/${total}）・日本街景…`);
      await yieldFrame();
    }
  }
  root.add(buildingGroup);

  onProgress?.(0.9, '鋪設街景道具・鐵路・便利店…');
  await yieldFrame();

  addStreetProps(root, streetLights, signalHeads);
  addJapaneseProps(root, neonMaterials, konbiniPositions);
  // Skip heaviest clutter on mobile lite so load finishes
  if (!mapData.mobileLite) {
    addIzakayaAlleys(root, neonMaterials, streetLights);
    addJapaneseScenicProps(root, neonMaterials, streetLights);
    addDenseStreetClutter(root, neonMaterials, streetLights);
  } else {
    addDenseStreetClutter(root, neonMaterials, streetLights);
  }
  const { stationZones } = addRailwayStations(root, neonMaterials, streetLights);
  addHachikoMarker(root);
  addLandmarkLabels(root, mapData.buildings);
  addSkylineFar(root);
  addBillboards(root, neonMaterials);
  addUtilityPoles(root);
  if (!mapData.mobileLite) {
    addExtraFacades(root, neonMaterials);
    addWireTangles(root);
  }

  // AABB colliders (slightly inset for sidewalk walkability)
  const colliders = mapData.buildings
    .map((b) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const [x, z] of b.ring) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      const pad = 0.55;
      return {
        minX: minX + pad,
        maxX: maxX - pad,
        minZ: minZ + pad,
        maxZ: maxZ - pad,
        h: b.height,
      };
    })
    .filter((c) => c.maxX > c.minX && c.maxZ > c.minZ);

  return {
    root,
    colliders,
    buildingCount: built,
    roadCount: mapData.roads.length,
    neonMaterials,
    streetLights,
    konbiniPositions,
    signalHeads,
    stationZones,
  };
}

function extrudeBuilding(b, neonMaterials) {
  if (!b.ring || b.ring.length < 4) return null;
  const height = Math.max(4, b.height || 12);
  const shape = shapeFromRing(b.ring);
  const seed = hashStr(String(b.id) + (b.name || ''));

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);

  const uv = geo.attributes.uv;
  if (uv) {
    const floors = Math.max(2, Math.round(height / 3.2));
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, uv.getY(i) * (floors / 8));
      uv.setX(i, uv.getX(i) * 2.2);
    }
    uv.needsUpdate = true;
  }

  const tex = facadeTexture(seed);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.16,
    envMapIntensity: 0.8,
  });

  if (b.isLandmark || height > 100) {
    mat.metalness = 0.42;
    mat.roughness = 0.38;
    mat.color = new THREE.Color(0xd8e0ea);
  }

  const mesh = new THREE.Mesh(geo, mat);
  // Shadows off for buildings — major mobile GPU/CPU win during load
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData = { name: b.name, height, isLandmark: !!b.isLandmark };

  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  if (size.x > 3 && size.z > 3) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(2, size.x * 0.9), 0.55, Math.max(2, size.z * 0.9)),
      new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 0.9, metalness: 0.1 })
    );
    roof.position.set(center.x, height + 0.28, center.z);
    mesh.add(roof);

    if (height > 15 && height < 90 && seed % 3 === 0) {
      const ac = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.1, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.6, metalness: 0.4 })
      );
      ac.position.set(center.x + size.x * 0.15, height + 1.0, center.z);
      mesh.add(ac);
    }
  }

  // Neon box signs on commercial mid-rises (denser — Kamurocho style)
  if (height > 10 && height < 160 && seed % 6 < 5) {
    const neonCol = PALETTE.neon[seed % PALETTE.neon.length];
    const neonMat = new THREE.MeshStandardMaterial({
      color: neonCol,
      emissive: neonCol,
      emissiveIntensity: 1.15,
      roughness: 0.28,
    });
    neonMaterials.push({ mat: neonMat, base: 1.15 });
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.8 + (seed % 5), 2.0 + (seed % 3) * 0.45, 0.32),
      neonMat
    );
    sign.position.set(center.x, 6 + (seed % 12), box.max.z + 0.38);
    mesh.add(sign);
    // Stacked signs
    if (seed % 2 === 0) {
      const neonCol2 = PALETTE.neon[(seed + 3) % PALETTE.neon.length];
      const neonMat2 = new THREE.MeshStandardMaterial({
        color: neonCol2,
        emissive: neonCol2,
        emissiveIntensity: 1.05,
        roughness: 0.3,
      });
      neonMaterials.push({ mat: neonMat2, base: 1.05 });
      const sign2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.28), neonMat2);
      sign2.position.set(center.x, 9 + (seed % 8), box.max.z + 0.38);
      mesh.add(sign2);
    }
    if (seed % 3 === 0) {
      const neonCol3 = PALETTE.neon[(seed + 5) % PALETTE.neon.length];
      const neonMat3 = new THREE.MeshStandardMaterial({
        color: neonCol3,
        emissive: neonCol3,
        emissiveIntensity: 0.95,
        roughness: 0.32,
      });
      neonMaterials.push({ mat: neonMat3, base: 0.95 });
      const sign3 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.22), neonMat3);
      sign3.position.set(center.x + size.x * 0.15, 12 + (seed % 6), box.max.z + 0.38);
      mesh.add(sign3);
    }
  }

  // Vertical Japanese kanban (縦看板) — more dense
  if (height > 10 && height < 120 && seed % 5 !== 0) {
    const vtex = verticalSignTexture(seed);
    const vmat = new THREE.MeshStandardMaterial({
      map: vtex,
      emissive: 0xffffff,
      emissiveMap: vtex,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    });
    neonMaterials.push({ mat: vmat, base: 0.55 });
    const vsign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.5 + (seed % 4), 0.2), vmat);
    const side = seed % 2 === 0 ? box.max.x + 0.35 : box.min.x - 0.35;
    vsign.position.set(side, 5 + (seed % 6), center.z);
    mesh.add(vsign);
    if (seed % 2 === 0) {
      const vtex2 = verticalSignTexture(seed + 11);
      const vmat2 = new THREE.MeshStandardMaterial({
        map: vtex2,
        emissive: 0xffffff,
        emissiveMap: vtex2,
        emissiveIntensity: 0.5,
      });
      neonMaterials.push({ mat: vmat2, base: 0.5 });
      const v2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.8, 0.18), vmat2);
      v2.position.set(side, 10 + (seed % 4), center.z + 1.2);
      mesh.add(v2);
    }
  }

  // Window AC boxes on facade edge
  if (height > 16 && seed % 2 === 0) {
    const acMat = new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.55, metalness: 0.35 });
    for (let i = 0; i < Math.min(4, Math.floor(height / 12)); i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.55), acMat);
      ac.position.set(
        seed % 2 === 0 ? box.max.x + 0.3 : box.min.x - 0.3,
        4 + i * 6,
        center.z + ((i % 2) - 0.5) * 2
      );
      mesh.add(ac);
    }
  }

  return mesh;
}

function addRoadRibbon(group, points, width, asphaltTex, sidewalkTex) {
  const half = width / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const ang = Math.atan2(dx, dz);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltTex,
      roughness: 0.88,
      metalness: 0.05,
    });
    const geo = new THREE.PlaneGeometry(width, len + 0.4);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -ang;
    mesh.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);

    if (width >= 9 && len > 12) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, len * 0.9),
        new THREE.MeshBasicMaterial({ color: PALETTE.asphaltLine })
      );
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = -ang;
      line.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2);
      group.add(line);
    }

    const px = -dz / len;
    const pz = dx / len;
    for (const side of [-1, 1]) {
      const swMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: sidewalkTex,
        roughness: 0.95,
      });
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len + 0.2), swMat);
      sw.rotation.x = -Math.PI / 2;
      sw.rotation.z = -ang;
      sw.position.set(
        (x0 + x1) / 2 + px * (half + 1.1) * side,
        0.06,
        (z0 + z1) / 2 + pz * (half + 1.1) * side
      );
      sw.receiveShadow = true;
      group.add(sw);
    }
  }
}

function addStreetProps(root, streetLights, signalHeads) {
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x2c3038,
    roughness: 0.7,
    metalness: 0.4,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c8,
    emissive: 0xffcc88,
    emissiveIntensity: 0.85,
  });

  const positions = [
    [25, 25],
    [-25, 25],
    [25, -25],
    [-25, -25],
    [60, 10],
    [-60, 10],
    [10, 60],
    [10, -60],
    [80, 80],
    [-80, -40],
    [40, -90],
    [-50, 70],
    [100, -30],
    [-30, 100],
    [70, -70],
    [-90, 40],
    [35, -15],
    [-40, 55],
    [55, -60],
    [-70, -20],
  ];

  for (const [x, z] of positions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 8), poleMat);
    pole.position.set(x, 3.5, z);
    pole.castShadow = true;
    root.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), lightMat);
    lamp.position.set(x, 7.1, z);
    root.add(lamp);
    const light = new THREE.PointLight(0xffd8a8, 1.15, 32, 2);
    light.position.set(x, 6.8, z);
    light.userData.baseIntensity = 1.15;
    root.add(light);
    streetLights.push(light);
  }

  // Shibuya scramble zebra stripes
  for (let i = -8; i <= 8; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 14),
      new THREE.MeshBasicMaterial({ color: 0xe8e4d8 })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 1.85, 0.07, 0);
    root.add(stripe);
  }
  for (let i = -6; i <= 6; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 1.15),
      new THREE.MeshBasicMaterial({ color: 0xe8e4d8 })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.071, i * 1.85);
    root.add(stripe);
  }

  // Traffic + pedestrian signals (日本式)
  const sigPos = [
    [18, 18],
    [-18, 18],
    [18, -18],
    [-18, -18],
  ];
  for (const [x, z] of sigPos) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.5, 8), poleMat);
    post.position.set(x, 2.75, z);
    root.add(post);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.4, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.5 })
    );
    head.position.set(x, 5.6, z);
    root.add(head);
    const colors = [0xff2222, 0xffcc00, 0x22cc44];
    colors.forEach((c, i) => {
      const bulb = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 10),
        new THREE.MeshBasicMaterial({ color: c })
      );
      bulb.position.set(x, 6.1 - i * 0.4, z + 0.2);
      root.add(bulb);
    });

    // Pedestrian signal box (歩行者信号)
    const ped = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.9, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1a1e24 })
    );
    ped.position.set(x + 0.55, 4.2, z);
    root.add(ped);
    const walkMat = new THREE.MeshBasicMaterial({ color: 0x22ee66 });
    const walk = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), walkMat);
    walk.position.set(x + 0.55, 4.4, z + 0.12);
    root.add(walk);
    const stopMat = new THREE.MeshBasicMaterial({ color: 0x331111 });
    const stop = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), stopMat);
    stop.position.set(x + 0.55, 4.0, z + 0.12);
    root.add(stop);
    signalHeads.push({ walk, stop, walkMat, stopMat });
  }
}

/** Konbini, vending machines, chochin lanterns, torii-ish accents */
function addJapaneseProps(root, neonMaterials, konbiniPositions) {
  // —— Convenience stores (コンビニ) FamilyMart / 7-Eleven / Lawson 風 ——
  const brands = [
    { variant: 0, brand: 'familymart', awning: 0x00a040, name: 'FamilyMart' },
    { variant: 1, brand: 'seven', awning: 0xe60012, name: '7-ELEVEN' },
    { variant: 2, brand: 'lawson', awning: 0x0033a0, name: 'LAWSON' },
  ];
  // Street-visible konbini (must stay in sync with interiors.js enter zones)
  const konbinis = [
    { x: 42, z: 28, rot: 0, variant: 0 },
    { x: -48, z: -22, rot: Math.PI / 2, variant: 1 },
    { x: 28, z: -52, rot: -0.3, variant: 2 },
    { x: -35, z: 48, rot: Math.PI, variant: 0 },
    { x: 70, z: 40, rot: -0.6, variant: 1 },
    { x: -70, z: 20, rot: 0.5, variant: 2 },
    { x: 15, z: 75, rot: 0.2, variant: 0 },
    { x: -80, z: -50, rot: 1.0, variant: 1 },
    { x: 95, z: -35, rot: -0.8, variant: 2 },
    { x: -25, z: 90, rot: 0.4, variant: 0 },
    { x: 55, z: 85, rot: -1.1, variant: 1 },
    { x: -95, z: -15, rot: 0.9, variant: 2 },
  ];
  for (const k of konbinis) {
    const brand = brands[k.variant % 3];
    const tex = konbiniTexture(k.variant);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.55,
      roughness: 0.42,
      metalness: 0.08,
    });
    neonMaterials.push({ mat, base: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 7.2), mat);
    body.position.set(k.x, 2.5, k.z);
    body.rotation.y = k.rot;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);
    // Side / back walls
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f0, roughness: 0.7 });
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 7.2), sideMat);
    side.position.set(
      k.x + Math.cos(k.rot) * 5.05,
      2.5,
      k.z - Math.sin(k.rot) * 5.05
    );
    side.rotation.y = k.rot;
    root.add(side);
    const back = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.25), sideMat);
    back.position.set(
      k.x - Math.sin(k.rot) * 3.7,
      2.5,
      k.z - Math.cos(k.rot) * 3.7
    );
    back.rotation.y = k.rot;
    root.add(back);

    // Roof cap
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 0.35, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.85, metalness: 0.2 })
    );
    roof.position.set(k.x, 5.15, k.z);
    roof.rotation.y = k.rot;
    root.add(roof);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 0.45, 1.3),
      new THREE.MeshStandardMaterial({
        color: brand.awning,
        emissive: brand.awning,
        emissiveIntensity: 0.7,
      })
    );
    awning.position.set(
      k.x + Math.sin(k.rot) * 3.6,
      5.0,
      k.z + Math.cos(k.rot) * 3.6
    );
    awning.rotation.y = k.rot;
    root.add(awning);
    neonMaterials.push({ mat: awning.material, base: 0.7 });

    // Brand flag pole sign
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 3.2, 0.9),
      new THREE.MeshStandardMaterial({
        color: brand.awning,
        emissive: brand.awning,
        emissiveIntensity: 0.65,
      })
    );
    flag.position.set(
      k.x + Math.cos(k.rot) * 5.2 + Math.sin(k.rot) * 3.2,
      4.2,
      k.z - Math.sin(k.rot) * 5.2 + Math.cos(k.rot) * 3.2
    );
    flag.rotation.y = k.rot;
    root.add(flag);
    neonMaterials.push({ mat: flag.material, base: 0.65 });

    // Entrance marker pad
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.9 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(k.x + Math.sin(k.rot) * 4.4, 0.08, k.z + Math.cos(k.rot) * 4.4);
    root.add(pad);

    // Door glow strip
    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.4),
      new THREE.MeshStandardMaterial({
        color: 0xfff2cc,
        emissive: 0xffe8a0,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.55,
      })
    );
    doorGlow.position.set(
      k.x + Math.sin(k.rot) * 3.65,
      1.5,
      k.z + Math.cos(k.rot) * 3.65
    );
    doorGlow.rotation.y = k.rot;
    root.add(doorGlow);
    neonMaterials.push({ mat: doorGlow.material, base: 0.45 });

    const glow = new THREE.PointLight(0xffe8c0, 1.35, 24, 2);
    glow.position.set(k.x, 2.8, k.z);
    glow.userData.baseIntensity = 1.35;
    root.add(glow);
    konbiniPositions.push({
      x: k.x,
      z: k.z,
      light: glow,
      brand: brand.brand,
      variant: k.variant,
      name: brand.name,
    });
  }

  // —— Vending machines (自動販売機) ——
  const vendingSpots = [
    [22, -8],
    [-15, 20],
    [50, -15],
    [-55, 5],
    [8, 40],
    [-25, -40],
    [65, 35],
    [-40, -55],
    [15, -65],
    [75, -5],
  ];
  const vendColors = [0xc41e3a, 0x1e4d9b, 0xe85d04, 0x2d6a4f];
  vendingSpots.forEach(([x, z], i) => {
    const col = vendColors[i % vendColors.length];
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.0, 0.7),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.35,
      })
    );
    body.position.set(x, 1.0, z);
    body.castShadow = true;
    root.add(body);
    neonMaterials.push({ mat: body.material, base: 0.25 });
    // Glass front glow
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        emissive: 0x88ccff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85,
      })
    );
    glass.position.set(x, 1.15, z + 0.36);
    root.add(glass);
    neonMaterials.push({ mat: glass.material, base: 0.5 });
  });

  // —— Red chochin lanterns (赤提灯) near izakaya vibe ——
  const lanternSpots = [
    [30, 15],
    [-28, -18],
    [12, -30],
    [-45, 30],
    [55, 50],
    [-60, -35],
  ];
  for (const [x, z] of lanternSpots) {
    for (let i = 0; i < 3; i++) {
      const lx = x + i * 1.4;
      const paper = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 10),
        new THREE.MeshStandardMaterial({
          color: 0xff2222,
          emissive: 0xff3311,
          emissiveIntensity: 0.8,
          roughness: 0.7,
        })
      );
      paper.scale.set(1, 1.25, 1);
      paper.position.set(lx, 3.2, z);
      root.add(paper);
      neonMaterials.push({ mat: paper.material, base: 0.8 });
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      cord.position.set(lx, 3.9, z);
      root.add(cord);
    }
  }

  // —— Torii-style red gate marker near station approach (decorative) ——
  const toriiX = 18;
  const toriiZ = -35;
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xc41e3a,
    emissive: 0x4a0000,
    emissiveIntensity: 0.15,
    roughness: 0.55,
  });
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.5, 10), redMat);
  postL.position.set(toriiX - 1.6, 2.25, toriiZ);
  root.add(postL);
  const postR = postL.clone();
  postR.position.set(toriiX + 1.6, 2.25, toriiZ);
  root.add(postR);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.5), redMat);
  lintel.position.set(toriiX, 4.4, toriiZ);
  root.add(lintel);
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.25, 0.55), redMat);
  topBar.position.set(toriiX, 4.85, toriiZ);
  root.add(topBar);

  // —— Potted street greenery (プランター) ——
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 38 + (i % 3) * 8;
    const px = Math.cos(a) * r;
    const pz = Math.sin(a) * r;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 })
    );
    pot.position.set(px, 0.25, pz);
    root.add(pot);
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.95 })
    );
    bush.position.set(px, 0.85, pz);
    root.add(bush);
  }
}

function addUtilityPoles(root) {
  // Japanese-style utility poles with crossarms
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.8,
    metalness: 0.3,
  });
  const spots = [
    [20, 40],
    [-30, 25],
    [45, -40],
    [-50, -30],
    [70, 20],
    [-20, -70],
    [90, -50],
    [-80, 60],
  ];
  for (const [x, z] of spots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 11, 8), poleMat);
    pole.position.set(x, 5.5, z);
    root.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.12), poleMat);
    arm.position.set(x, 9.5, z);
    root.add(arm);
    const arm2 = arm.clone();
    arm2.position.y = 8.8;
    root.add(arm2);
    // Transformer box
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.5, roughness: 0.5 })
    );
    box.position.set(x + 0.6, 8.2, z);
    root.add(box);
  }
}

function addHachikoMarker(root) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.6, metalness: 0.3 })
  );
  base.position.set(18, 0.2, -22);
  root.add(base);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7 })
  );
  body.position.set(18, 1.0, -22);
  body.scale.set(1, 1.15, 0.9);
  root.add(body);

  // Small Japanese plaque
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.4, roughness: 0.4 })
  );
  plaque.position.set(18, 0.55, -20.6);
  root.add(plaque);
}

function addLandmarkLabels(root, buildings) {
  const landmarks = buildings.filter((b) => b.isLandmark && b.name).slice(0, 12);
  for (const b of landmarks) {
    let cx = 0;
    let cz = 0;
    for (const [x, z] of b.ring) {
      cx += x;
      cz += z;
    }
    cx /= b.ring.length;
    cz /= b.ring.length;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,14,22,0.72)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(20, 16, 472, 64, 12);
      ctx.fill();
    } else {
      ctx.fillRect(20, 16, 472, 64);
    }
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 32px "Hiragino Sans","Noto Sans JP",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = b.name.length > 18 ? `${b.name.slice(0, 17)}…` : b.name;
    ctx.fillText(label, 256, 48);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true })
    );
    sprite.scale.set(22, 4.2, 1);
    sprite.position.set(cx, Math.min(b.height + 8, 80), cz);
    root.add(sprite);
  }
}

function addBillboards(root, neonMaterials) {
  const ads = [
    { x: -40, z: 30, h: 22, seed: 0 },
    { x: 45, z: -35, h: 28, seed: 1 },
    { x: -55, z: -45, h: 18, seed: 2 },
    { x: 30, z: 55, h: 24, seed: 3 },
    { x: 70, z: 15, h: 32, seed: 4 },
    { x: -20, z: 70, h: 20, seed: 5 },
    { x: 90, z: -20, h: 36, seed: 6 },
    { x: -75, z: 50, h: 26, seed: 7 },
    { x: 20, z: -80, h: 30, seed: 0 },
    { x: -30, z: -75, h: 22, seed: 3 },
    { x: 100, z: 40, h: 34, seed: 2 },
    { x: -100, z: -25, h: 28, seed: 5 },
    { x: 15, z: 90, h: 26, seed: 1 },
    { x: -65, z: 85, h: 30, seed: 4 },
    { x: 75, z: -85, h: 32, seed: 6 },
    { x: 0, z: -50, h: 20, seed: 7 },
  ];
  for (const a of ads) {
    const tex = billboardTexture(a.seed);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });
    neonMaterials.push({ mat, base: 0.65 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 0.45), mat);
    board.position.set(a.x, a.h, a.z);
    root.add(board);
    // Support poles
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, a.h - 2, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.5, roughness: 0.5 })
    );
    pole.position.set(a.x, (a.h - 2) / 2, a.z);
    root.add(pole);
  }
}

function addSkylineFar(root) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6a7588,
    roughness: 1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.78,
  });
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = 480 + (i % 6) * 40;
    const h = 45 + (i * 23) % 190;
    const w = 14 + (i % 5) * 8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.85), mat);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    root.add(m);
  }
}

/** Extra procedural mid-rises to densify non-OSM gaps (Yakuza street density) */
function addExtraFacades(root, neonMaterials) {
  const spots = [
    [95, 25, 18, 0.2],
    [88, -45, 24, -0.3],
    [-95, 35, 16, 0.5],
    [-88, -60, 22, 1.0],
    [110, -10, 32, 0],
    [-105, -15, 28, 0.8],
    [50, 95, 14, -0.5],
    [-55, 100, 20, 0.3],
    [5, -110, 26, 0],
    [120, 60, 40, -0.2],
    [-120, 70, 35, 0.4],
    [75, -100, 18, 0.6],
    [38, 38, 22, 0.15],
    [-42, 32, 19, -0.4],
    [62, -28, 28, 0.7],
    [-58, -42, 24, 1.2],
    [22, -95, 16, 0.1],
    [-15, 105, 30, -0.2],
    [105, 80, 36, 0.35],
    [-110, -80, 20, 0.9],
    [130, 20, 42, 0],
    [-130, 40, 38, 0.5],
    [45, 120, 26, -0.6],
    [-75, 115, 22, 0.25],
  ];
  spots.forEach(([x, z, h, rot], i) => {
    const seed = 9000 + i * 17;
    const tex = facadeTexture(seed);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.55,
      metalness: 0.16,
      envMapIntensity: 0.9,
    });
    const w = 10 + (i % 4) * 3;
    const d = 8 + (i % 3) * 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.rotation.y = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    // Stacked neon signs (both sides when possible)
    const vtex = verticalSignTexture(seed);
    const vmat = new THREE.MeshStandardMaterial({
      map: vtex,
      emissive: 0xffffff,
      emissiveMap: vtex,
      emissiveIntensity: 0.7,
    });
    neonMaterials.push({ mat: vmat, base: 0.7 });
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.5 + (i % 3), 0.22), vmat);
    v.position.set(x + Math.cos(rot) * (w * 0.55), 6, z - Math.sin(rot) * (w * 0.55));
    v.rotation.y = rot;
    root.add(v);
    if (i % 2 === 0) {
      const vtex2 = verticalSignTexture(seed + 9);
      const vmat2 = new THREE.MeshStandardMaterial({
        map: vtex2,
        emissive: 0xffffff,
        emissiveMap: vtex2,
        emissiveIntensity: 0.65,
      });
      neonMaterials.push({ mat: vmat2, base: 0.65 });
      const v2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 0.2), vmat2);
      v2.position.set(x + Math.cos(rot) * (w * 0.55), 11, z - Math.sin(rot) * (w * 0.55) + 1.2);
      v2.rotation.y = rot;
      root.add(v2);
    }

    // Rooftop AC / water tank
    if (h > 18) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.3, 1.6, 10),
        new THREE.MeshStandardMaterial({ color: 0x6a7078, metalness: 0.45, roughness: 0.5 })
      );
      tank.position.set(x, h + 1.0, z);
      root.add(tank);
    }
  });
}

/** Narrow izakaya / snack bar alleys (横丁 vibes) */
function addIzakayaAlleys(root, neonMaterials, streetLights) {
  const alleys = [
    { x: 32, z: 12, rot: 0.2 },
    { x: -30, z: -12, rot: -0.4 },
    { x: 8, z: -40, rot: 0.6 },
    { x: -50, z: 15, rot: 1.1 },
    { x: 60, z: -55, rot: -0.2 },
  ];
  const norenColors = [0xc41e3a, 0x1a3a6e, 0x2d6a4f, 0x5a2d6e, 0xc45c12];

  for (let ai = 0; ai < alleys.length; ai++) {
    const a = alleys[ai];
    // Two facing low commercial buildings
    for (const side of [-1, 1]) {
      const seed = 5000 + ai * 20 + side;
      const tex = facadeTexture(seed);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.58,
        metalness: 0.12,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(14, 9 + (ai % 3) * 2, 5.5), mat);
      const ox = Math.cos(a.rot) * side * 5.5;
      const oz = -Math.sin(a.rot) * side * 5.5;
      b.position.set(a.x + ox, 5, a.z + oz);
      b.rotation.y = a.rot;
      b.castShadow = true;
      root.add(b);

      // Noren curtains
      for (let n = 0; n < 3; n++) {
        const col = norenColors[(ai + n) % norenColors.length];
        const noren = new THREE.Mesh(
          new THREE.PlaneGeometry(1.1, 1.4),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.2,
            side: THREE.DoubleSide,
            roughness: 0.9,
          })
        );
        noren.position.set(
          a.x + ox + Math.sin(a.rot) * (2 + n * 1.3),
          2.4,
          a.z + oz + Math.cos(a.rot) * (2 + n * 1.3)
        );
        noren.rotation.y = a.rot + (side > 0 ? 0 : Math.PI);
        root.add(noren);
        neonMaterials.push({ mat: noren.material, base: 0.2 });
      }
    }

    // Red chochin string over alley
    for (let i = 0; i < 5; i++) {
      const lx = a.x + Math.sin(a.rot) * (i * 2.2 - 4);
      const lz = a.z + Math.cos(a.rot) * (i * 2.2 - 4);
      const paper = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff2222,
          emissive: 0xff2200,
          emissiveIntensity: 0.95,
          roughness: 0.7,
        })
      );
      paper.scale.set(1, 1.3, 1);
      paper.position.set(lx, 3.6, lz);
      root.add(paper);
      neonMaterials.push({ mat: paper.material, base: 0.95 });
    }

    const light = new THREE.PointLight(0xff6633, 1.1, 18, 2);
    light.position.set(a.x, 3.2, a.z);
    light.userData.baseIntensity = 1.1;
    root.add(light);
    streetLights.push(light);
  }
}

/** Phone booths, taxi stand, shrine gate, mailboxes, more JP street furniture */
function addJapaneseScenicProps(root, neonMaterials, streetLights) {
  // Green public phones (公衆電話)
  const phoneSpots = [
    [12, 22],
    [-20, -8],
    [48, -40],
    [-60, 40],
    [80, 10],
  ];
  for (const [x, z] of phoneSpots) {
    const booth = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.2, 0.9),
      new THREE.MeshStandardMaterial({
        color: 0x1a8f4a,
        emissive: 0x0a4020,
        emissiveIntensity: 0.2,
        metalness: 0.35,
        roughness: 0.45,
      })
    );
    booth.position.set(x, 1.1, z);
    booth.castShadow = true;
    root.add(booth);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.45,
        metalness: 0.5,
        roughness: 0.15,
      })
    );
    glass.position.set(x, 1.25, z + 0.46);
    root.add(glass);
  }

  // Red post boxes (郵便ポスト)
  const postSpots = [
    [8, -18],
    [-40, 8],
    [55, 30],
    [-12, 55],
  ];
  for (const [x, z] of postSpots) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1.3, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0xc41e3a,
        roughness: 0.5,
        metalness: 0.25,
      })
    );
    box.position.set(x, 0.65, z);
    root.add(box);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.15, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xa01830 })
    );
    cap.position.set(x, 1.35, z);
    root.add(cap);
  }

  // Taxi stand canopy near station
  const taxi = new THREE.Group();
  taxi.position.set(35, 0, -78);
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.4, roughness: 0.5 })
  );
  canopy.position.y = 3.2;
  taxi.add(canopy);
  for (const ox of [-4, 4]) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a5058 })
    );
    p.position.set(ox, 1.6, 0);
    taxi.add(p);
  }
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.7, 0.15),
    new THREE.MeshStandardMaterial({
      color: 0xffd000,
      emissive: 0xaa8800,
      emissiveIntensity: 0.4,
    })
  );
  sign.position.set(0, 3.5, 0);
  taxi.add(sign);
  neonMaterials.push({ mat: sign.material, base: 0.4 });
  // Simple taxi body
  const car = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 1.5, 1.9),
    new THREE.MeshStandardMaterial({ color: 0xc8a020, metalness: 0.4, roughness: 0.4 })
  );
  car.position.set(0, 0.85, 1.5);
  taxi.add(car);
  root.add(taxi);

  // Small shrine-ish stone lanterns (石灯籠) near torii
  for (const [x, z] of [
    [16, -35],
    [20, -35],
  ]) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.9 })
    );
    base.position.set(x, 0.2, z);
    root.add(base);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a5e62 })
    );
    pillar.position.set(x, 1.0, z);
    root.add(pillar);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.5, 0.45),
      new THREE.MeshStandardMaterial({
        color: 0xffe8a0,
        emissive: 0xffcc66,
        emissiveIntensity: 0.5,
      })
    );
    lamp.position.set(x, 1.8, z);
    root.add(lamp);
    neonMaterials.push({ mat: lamp.material, base: 0.5 });
  }

  // Construction fencing / blue tarp (工事現場)
  for (let i = 0; i < 8; i++) {
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 2.0, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x2a6fbb, roughness: 0.75 })
    );
    fence.position.set(100 + i * 3.6, 1.0, 45);
    root.add(fence);
  }

  // More street billboards low (立て看板)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.4;
    const r = 42 + (i % 3) * 9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.8, 0.12),
      new THREE.MeshStandardMaterial({
        color: PALETTE.neon[i % PALETTE.neon.length],
        emissive: PALETTE.neon[i % PALETTE.neon.length],
        emissiveIntensity: 0.35,
      })
    );
    board.position.set(x, 1.0, z);
    board.rotation.y = -a;
    root.add(board);
    neonMaterials.push({ mat: board.material, base: 0.35 });
  }

  // Crosswalk mirror poles
  for (const [x, z] of [
    [22, 22],
    [-22, 22],
    [22, -22],
    [-22, -22],
  ]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x888890, metalness: 0.6, roughness: 0.35 })
    );
    pole.position.set(x, 1.75, z);
    root.add(pole);
    const mirror = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xc8d0d8,
        metalness: 0.9,
        roughness: 0.1,
      })
    );
    mirror.position.set(x, 3.6, z);
    root.add(mirror);
  }
}

/** Dense overhead power lines between utility poles (電線) */
function addWireTangles(root) {
  const pts = [
    [20, 40],
    [-30, 25],
    [45, -40],
    [-50, -30],
    [70, 20],
    [-20, -70],
    [90, -50],
    [-80, 60],
    [20, 40],
  ];
  const mat = new THREE.LineBasicMaterial({ color: 0x2a2a2e, transparent: true, opacity: 0.55 });
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    for (let w = 0; w < 3; w++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, 9.2 + w * 0.25, z0),
        new THREE.Vector3((x0 + x1) / 2, 7.8 + w * 0.2, (z0 + z1) / 2),
        new THREE.Vector3(x1, 9.2 + w * 0.25, z1),
      ]);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(12));
      root.add(new THREE.Line(geo, mat));
    }
  }
}

/** Bikes, bollards, signposts, more lanterns — street life density */
function addDenseStreetClutter(root, neonMaterials, streetLights) {
  // Bicycle racks
  const bikeMat = new THREE.MeshStandardMaterial({ color: 0x2a60a8, metalness: 0.5, roughness: 0.4 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 32 + (i % 4) * 12;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 12), bikeMat);
    frame.position.set(x, 0.55, z);
    frame.rotation.y = a;
    root.add(frame);
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.03, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.6, roughness: 0.4 })
    );
    wheel.position.set(x - 0.25, 0.3, z);
    wheel.rotation.y = Math.PI / 2;
    root.add(wheel);
  }

  // Bollards
  const bolMat = new THREE.MeshStandardMaterial({ color: 0xc8a020, metalness: 0.4, roughness: 0.45 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 48;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.85, 8), bolMat);
    b.position.set(Math.cos(a) * r, 0.42, Math.sin(a) * r);
    root.add(b);
  }

  // More neon verticals along scramble ring
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = 58 + (i % 3) * 6;
    const vtex = verticalSignTexture(100 + i);
    const vmat = new THREE.MeshStandardMaterial({
      map: vtex,
      emissive: 0xffffff,
      emissiveMap: vtex,
      emissiveIntensity: 0.6,
    });
    neonMaterials.push({ mat: vmat, base: 0.6 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.5, 0.18), vmat);
    sign.position.set(Math.cos(a) * r, 5, Math.sin(a) * r);
    sign.rotation.y = -a;
    root.add(sign);
  }

  // Extra street lamps
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.7, metalness: 0.4 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c8,
    emissive: 0xffcc88,
    emissiveIntensity: 0.9,
  });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const r = 70 + (i % 2) * 25;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 7.5, 8), poleMat);
    pole.position.set(x, 3.75, z);
    root.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), lightMat);
    lamp.position.set(x, 7.5, z);
    root.add(lamp);
    const light = new THREE.PointLight(0xffd8a8, 1.0, 28, 2);
    light.position.set(x, 7.2, z);
    light.userData.baseIntensity = 1.0;
    root.add(light);
    streetLights.push(light);
  }

  // Road wetness sheen patches near scramble (rain-after look)
  for (let i = 0; i < 12; i++) {
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(2 + (i % 3), 16),
      new THREE.MeshStandardMaterial({
        color: 0x4a5560,
        metalness: 0.85,
        roughness: 0.15,
        transparent: true,
        opacity: 0.45,
      })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(((i * 17) % 40) - 20, 0.09, ((i * 13) % 40) - 20);
    root.add(puddle);
  }
}

/** GTA-like sky + fog + cinematic lighting — day/night cycle takes over after init */
export function setupAtmosphere(scene, renderer) {
  scene.background = new THREE.Color(0x87b4d8);
  scene.fog = new THREE.FogExp2(0xa8c4dc, 0.0012);

  const hemi = new THREE.HemisphereLight(0xc4d4e8, 0x3a3830, 0.58);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d8, 1.4);
  sun.position.set(140, 170, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 520;
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8899bb, 0.38);
  fill.position.set(-90, 45, -70);
  scene.add(fill);

  const bounce = new THREE.DirectionalLight(0xffc8a0, 0.18);
  bounce.position.set(40, 20, -100);
  scene.add(bounce);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (renderer.shadowMap) {
    try {
      // Softer cinematic shadows where supported
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch {
      /* */
    }
  }

  return { sun, hemi, fill, bounce };
}
