import * as THREE from 'three';

/**
 * First-person walker with collision against building AABBs.
 * Move via joystick vector; look via right-side drag / mouse.
 * Desktop: WASD + mouse drag.
 */
export class Player {
  constructor(camera, colliders) {
    this.camera = camera;
    this.colliders = colliders || [];
    this._streetColliders = colliders || [];
    // Scramble Crossing plaza center — open road, not inside buildings
    this.position = new THREE.Vector3(0, 1.7, 0);
    this.yaw = 0;
    this.pitch = -0.08;
    this.speed = 9.5;
    this.sprintMul = 1.55;
    this.radius = 0.45;
    this.eyeHeight = 1.7;
    this.bobPhase = 0;
    this.interiorMode = false;
    this._interiorBounds = null;

    this._lookActive = false;
    this._lookId = null;
    this._lastX = 0;
    this._lastY = 0;
    this.lookSensitivity = 0.0042;

    camera.position.copy(this.position);
    this._applyLook();
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
    if (!this.interiorMode) this._streetColliders = colliders || [];
  }

  enterInterior({ x, z, yaw = Math.PI, cx, cz, maxR = 14 }) {
    this.interiorMode = true;
    this.colliders = [];
    this.position.set(x, this.eyeHeight, z);
    this.yaw = yaw;
    this.pitch = -0.05;
    // Soft bounds for konbini / station rooms (world space center of room)
    this._interiorBounds = {
      cx: cx ?? x,
      cz: cz ?? z,
      maxR,
    };
    this._applyLook();
  }

  exitInterior(streetPos) {
    this.interiorMode = false;
    this.colliders = this._streetColliders || [];
    this._interiorBounds = null;
    if (streetPos) {
      this.position.set(streetPos.x, this.eyeHeight, streetPos.z);
      this.yaw = streetPos.yaw ?? this.yaw;
    }
    this._applyLook();
  }

  /** Find a free point near (x,z) so we never spawn inside a wall. */
  findSafeSpawn(x = 0, z = 0) {
    const candidates = [
      [x, z],
      [0, 0],
      [0, 8],
      [0, -8],
      [8, 0],
      [-8, 0],
      [12, 12],
      [-12, 12],
      [12, -12],
      [-12, -12],
      [0, 20],
      [20, 0],
      [-20, 0],
      [0, -20],
    ];
    for (const [cx, cz] of candidates) {
      if (!this._collides(cx, cz)) return { x: cx, z: cz };
    }
    // Spiral search
    for (let r = 2; r <= 80; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const cx = Math.cos(a) * r;
        const cz = Math.sin(a) * r;
        if (!this._collides(cx, cz)) return { x: cx, z: cz };
      }
    }
    return { x: 0, z: 0 };
  }

  reset(x = 0, z = 0) {
    const safe = this.findSafeSpawn(x, z);
    this.position.set(safe.x, this.eyeHeight, safe.z);
    this.yaw = 0;
    this.pitch = -0.08;
    this._applyLook();
  }

  bindLook(domElement) {
    const el = domElement;

    const isLeftJoystick = (clientX, clientY) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return clientX < w * 0.4 && clientY > h * 0.52;
    };

    const onStart = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (isLeftJoystick(t.clientX, t.clientY)) return;
      if (t.clientY < 140 && t.clientX > window.innerWidth - 70) return;
      this._lookActive = true;
      this._lookId = t.identifier ?? 'mouse';
      this._lastX = t.clientX;
      this._lastY = t.clientY;
    };

    const onMove = (e) => {
      if (!this._lookActive) return;
      const list = e.changedTouches || [e];
      for (const t of list) {
        const id = t.identifier ?? 'mouse';
        if (id !== this._lookId && this._lookId !== 'mouse') continue;
        const dx = t.clientX - this._lastX;
        const dy = t.clientY - this._lastY;
        this._lastX = t.clientX;
        this._lastY = t.clientY;
        this.yaw -= dx * this.lookSensitivity;
        this.pitch -= dy * this.lookSensitivity;
        this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
        if (e.cancelable) e.preventDefault();
        break;
      }
    };

    const onEnd = (e) => {
      const list = e.changedTouches || [e];
      for (const t of list) {
        const id = t.identifier ?? 'mouse';
        if (id !== this._lookId && this._lookId !== 'mouse') continue;
        this._lookActive = false;
        this._lookId = null;
        break;
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('mousedown', onStart);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('mouseup', onEnd);

    this.keys = {};
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  _applyLook(bobY = 0) {
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
    this.camera.position.set(this.position.x, this.position.y + bobY, this.position.z);
  }

  _collides(x, z) {
    const r = this.radius;
    if (this.interiorMode && this._interiorBounds) {
      const d = Math.hypot(x - this._interiorBounds.cx, z - this._interiorBounds.cz);
      if (d > this._interiorBounds.maxR) return true;
      return false;
    }
    for (const c of this.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    if (Math.hypot(x, z) > 430) return true;
    return false;
  }

  update(dt, moveVec) {
    let mx = moveVec?.x || 0;
    let mz = moveVec?.y || 0;

    if (this.keys) {
      if (this.keys.KeyW || this.keys.ArrowUp) mz += 1;
      if (this.keys.KeyS || this.keys.ArrowDown) mz -= 1;
      if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    }

    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }

    const sprint =
      (this.keys && (this.keys.ShiftLeft || this.keys.ShiftRight)) || len > 0.92;
    const spd = this.speed * (sprint && len > 0.2 ? this.sprintMul : 1);

    if (len > 0.01) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const dx = (mx * cos + mz * sin) * spd * dt;
      const dz = (-mx * sin + mz * cos) * spd * dt;

      const nx = this.position.x + dx;
      const nz = this.position.z + dz;

      if (!this._collides(nx, this.position.z)) this.position.x = nx;
      if (!this._collides(this.position.x, nz)) this.position.z = nz;

      this.bobPhase += dt * (sprint ? 12 : 9) * len;
    }

    const bob = len > 0.05 ? Math.sin(this.bobPhase) * 0.035 : 0;
    this.position.y = this.eyeHeight;
    this._applyLook(bob);
  }
}
