/**
 * Outdoor railway station props + train arrival cycle for interiors.
 */
import * as THREE from 'three';
import { stationSignTexture, verticalSignTexture } from './textures.js';

export function addRailwayStations(root, neonMaterials, streetLights) {
  const stations = [
    { x: -15, z: -85, rot: 0, name: '渋谷駅' },
    { x: 55, z: -70, rot: -0.4, name: 'JR出口' },
  ];
  const stationZones = [];

  for (const s of stations) {
    buildStationExterior(root, s, neonMaterials, streetLights);
    stationZones.push({ x: s.x, z: s.z, radius: 8, name: s.name });
  }

  // Elevated track ribbon across south side
  addElevatedTracks(root, neonMaterials);

  return { stationZones };
}

function buildStationExterior(root, s, neonMaterials, streetLights) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.rot;

  // Main station hall block
  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(22, 9, 14),
    new THREE.MeshStandardMaterial({
      color: 0xc8d0d8,
      roughness: 0.55,
      metalness: 0.25,
    })
  );
  hall.position.y = 4.5;
  hall.castShadow = true;
  g.add(hall);

  // Glass curtain wall
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 6),
    new THREE.MeshStandardMaterial({
      color: 0x88aacc,
      emissive: 0x446688,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.75,
      metalness: 0.6,
      roughness: 0.2,
    })
  );
  glass.position.set(0, 3.5, 7.05);
  g.add(glass);
  neonMaterials.push({ mat: glass.material, base: 0.25 });

  // Entrance canopy
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.35, 5),
    new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.4, roughness: 0.5 })
  );
  canopy.position.set(0, 4.2, 9);
  g.add(canopy);

  // Canopy pillars
  for (const x of [-6, 6]) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.5, roughness: 0.4 })
    );
    p.position.set(x, 2.1, 10);
    g.add(p);
  }

  // Station name board
  const tex = stationSignTexture('渋谷', 'SHIBUYA');
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.2, 0.3),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.55,
    })
  );
  board.position.set(0, 7.5, 7.2);
  g.add(board);
  neonMaterials.push({ mat: board.material, base: 0.55 });

  // JR green stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(22.2, 0.4, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x3d8b6e,
      emissive: 0x1a4a38,
      emissiveIntensity: 0.3,
    })
  );
  stripe.position.set(0, 8.8, 7.1);
  g.add(stripe);

  // Entrance glow
  const light = new THREE.PointLight(0xc8e0ff, 1.2, 22, 2);
  light.position.set(0, 3.5, 10);
  light.userData.baseIntensity = 1.2;
  g.add(light);
  streetLights.push(light);

  // Stairs hint
  const stairs = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.9, 3),
    new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.8 })
  );
  stairs.position.set(0, 0.45, 11.5);
  g.add(stairs);

  // Vertical 駅 sign
  const vtex = verticalSignTexture(7, '駅');
  const vsign = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 3.5, 0.2),
    new THREE.MeshStandardMaterial({
      map: vtex,
      emissive: 0xffffff,
      emissiveMap: vtex,
      emissiveIntensity: 0.5,
    })
  );
  vsign.position.set(9, 4, 7.5);
  g.add(vsign);
  neonMaterials.push({ mat: vsign.material, base: 0.5 });

  root.add(g);
}

function addElevatedTracks(root, neonMaterials) {
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.7 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.85, metalness: 0.15 });

  for (let i = -4; i <= 6; i++) {
    const x = i * 22;
    const z = -95;
    // Pillars
    for (const ox of [-4, 4]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.2), pillarMat);
      p.position.set(x + ox, 4, z);
      root.add(p);
    }
    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 10), deckMat);
    deck.position.set(x, 8.5, z);
    root.add(deck);
    // Sound barrier
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(22, 2.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.6 })
    );
    wall.position.set(x, 10.2, z - 4.5);
    root.add(wall);
  }

  // Distant train on elevated (decorative loop)
  const train = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(24, 3, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0x3d8b6e,
      metalness: 0.4,
      roughness: 0.4,
      emissive: 0x0a2018,
      emissiveIntensity: 0.2,
    })
  );
  body.position.y = 10.5;
  train.add(body);
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xaaddff,
    emissive: 0x88ccff,
    emissiveIntensity: 0.5,
  });
  neonMaterials.push({ mat: winMat, base: 0.5 });
  for (let i = -4; i <= 4; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), winMat);
    w.position.set(i * 2.4, 10.8, -95 + 1.35);
    train.add(w);
  }
  train.position.set(-80, 0, 0);
  train.userData.elevatedTrain = true;
  train.userData.speed = 18;
  root.add(train);

  return train;
}

/**
 * Manages train arrival cycle when player is inside station.
 */
export class TrainCycle {
  constructor() {
    this.timer = 0;
    this.phase = 'wait'; // wait | approach | arrive | dwell | depart
    this.phaseT = 0;
    this.justArrived = false;
    this.approaching = false;
    this.stationName = '渋谷';
  }

  /** Call each frame when inside station; pass train mesh if available */
  update(dt, trainMesh) {
    this.justArrived = false;
    this.approaching = false;
    this.timer += dt;
    this.phaseT += dt;

    const durations = {
      wait: 14,
      approach: 4,
      arrive: 1.2,
      dwell: 10,
      depart: 3,
    };

    if (this.phaseT >= durations[this.phase]) {
      this.phaseT = 0;
      if (this.phase === 'wait') this.phase = 'approach';
      else if (this.phase === 'approach') {
        this.phase = 'arrive';
        this.justArrived = true;
      } else if (this.phase === 'arrive') this.phase = 'dwell';
      else if (this.phase === 'dwell') this.phase = 'depart';
      else this.phase = 'wait';
    }

    if (this.phase === 'approach' && this.phaseT < 0.2) {
      this.approaching = true;
    }

    if (trainMesh) {
      if (this.phase === 'wait') {
        trainMesh.position.x = -45;
        trainMesh.visible = false;
      } else if (this.phase === 'approach') {
        trainMesh.visible = true;
        const t = this.phaseT / durations.approach;
        trainMesh.position.x = -45 + t * 45;
      } else if (this.phase === 'arrive' || this.phase === 'dwell') {
        trainMesh.visible = true;
        trainMesh.position.x = 0;
      } else if (this.phase === 'depart') {
        trainMesh.visible = true;
        const t = this.phaseT / durations.depart;
        trainMesh.position.x = t * 50;
      }
    }

    return {
      justArrived: this.justArrived,
      approaching: this.approaching,
      phase: this.phase,
      stationName: this.stationName,
    };
  }

  /** Outdoor elevated train motion */
  updateElevated(dt, root) {
    root.traverse((obj) => {
      if (obj.userData?.elevatedTrain) {
        obj.position.x += (obj.userData.speed || 18) * dt;
        if (obj.position.x > 120) obj.position.x = -100;
      }
    });
  }
}
