// Tidewater PD: wanted heat and the units that answer it. Units are named,
// carry a state (PURSUIT / RAMMING / ROADBLOCK), and drive the road grid
// toward the player. At 3 stars a helicopter joins from above.

import * as THREE from '../vendor/three.module.js';
import { WORLD, POLICE_UNITS, WANTED } from './config.js';
import { collideCircle } from './world.js';
import { makeCarMesh } from './traffic.js';

const DIRS = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
];

function policeCarMesh() {
  const g = makeCarMesh(0x14264a);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.18, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff2d4d })
  );
  bar.position.set(0, 1.55, -0.2);
  g.add(bar);
  const bar2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x2d7bff })
  );
  bar2.position.set(0, 1.55, -0.2);
  bar2.position.x = 0.35;
  g.add(bar2);
  return g;
}

export class Police {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.units = [];
    this.heli = null;
    this.heliRotor = null;
    this.flashT = 0;
  }

  _spawnUnit(state) {
    const name = POLICE_UNITS[this.units.length % POLICE_UNITS.length];
    const mesh = policeCarMesh();
    this.scene.add(mesh);
    const angle = this.rng.range(0, Math.PI * 2);
    const x = state.player.pos.x + Math.cos(angle) * 70;
    const z = state.player.pos.z + Math.sin(angle) * 70;
    const unit = {
      name,
      x: Math.max(-WORLD.half + 10, Math.min(WORLD.half - 10, x)),
      z: Math.max(-WORLD.half + 10, Math.min(WORLD.half - 10, z)),
      dir: this.rng.int(0, 3),
      speed: 15,
      state: 'PURSUIT',
      mesh,
      cooldown: 0,
    };
    this.units.push(unit);
    return unit;
  }

  _spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 })
    );
    g.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 })
    );
    tail.position.set(0, 0.2, -4);
    g.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
    );
    rotor.position.y = 0.9;
    g.add(rotor);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(6, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.position.y = -15;
    cone.rotation.x = Math.PI;
    g.add(cone);
    this.scene.add(g);
    this.heli = g;
    this.heliRotor = rotor;
  }

  _removeHeli() {
    if (this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
      this.heliRotor = null;
    }
  }

  _nextIntersection(v, d) {
    const step = WORLD.block;
    if (d > 0) return Math.floor(v / step) * step + step;
    return Math.ceil(v / step) * step - step;
  }

  update(dt, state) {
    const wanted = state.wanted;
    const want = WANTED.unitsAtStar[Math.min(wanted, WANTED.maxStars)];
    while (this.units.length < want) this._spawnUnit(state);
    while (this.units.length > want) {
      const u = this.units.pop();
      this.scene.remove(u.mesh);
    }
    if (wanted >= WANTED.heliAt && !this.heli) this._spawnHeli();
    if (wanted < WANTED.heliAt && this.heli) this._removeHeli();

    const px = state.player.pos.x;
    const pz = state.player.pos.z;
    const pSpeed = Math.abs(state.player.speed);
    for (const u of this.units) {
      const dx = px - u.x;
      const dz = pz - u.z;
      const dist = Math.hypot(dx, dz);
      if (u.cooldown > 0) u.cooldown -= dt;
      if (dist < 14 && u.cooldown <= 0) {
        u.state = 'RAMMING';
      } else if (dist > 30) {
        u.state = 'PURSUIT';
      }
      if (!state.player.onFoot && pSpeed > 20 && dist > 40 && this.rng.chance(0.01)) {
        u.state = 'ROADBLOCK';
      }
      if (u.state === 'ROADBLOCK') {
        const fx = Math.sin(state.player.heading);
        const fz = Math.cos(state.player.heading);
        const tx = px + fx * 45;
        const tz = pz + fz * 45;
        const mdx = tx - u.x;
        const mdz = tz - u.z;
        const md = Math.hypot(mdx, mdz);
        if (md > 4) {
          u.x += (mdx / md) * u.speed * dt;
          u.z += (mdz / md) * u.speed * dt;
          u.mesh.rotation.y = Math.atan2(mdx, mdz);
        }
        if (dist < 8) u.state = 'RAMMING';
      } else {
        const speed = u.state === 'RAMMING' ? 19 : 15;
        const d = DIRS[u.dir];
        const before = u.dir % 2 === 0 ? u.x : u.z;
        const comp = d.x !== 0 ? d.x : d.z;
        const target = this._nextIntersection(before, comp);
        let moved = comp * speed * dt;
        let after = before + moved;
        if (comp > 0 ? after >= target : after <= target) {
          after = target;
          const options = [0, 1, 2, 3].map((nd) => {
            const ndx = DIRS[nd].x;
            const ndz = DIRS[nd].z;
            const nx = u.x + ndx * WORLD.block;
            const nz = u.z + ndz * WORLD.block;
            const ndist = Math.hypot(px - nx, pz - nz);
            return { nd, ndist };
          });
          options.sort((a, b) => a.ndist - b.ndist);
          u.dir = this.rng.chance(0.75) ? options[0].nd : options[this.rng.int(0, 3)].nd;
          moved = after - before;
        }
        if (u.dir % 2 === 0) u.x += moved;
        else u.z += moved;
        const fixed = collideCircle(state.world.colliders, u.x, u.z, 1.6);
        u.x = fixed.x;
        u.z = fixed.z;
        u.mesh.position.set(u.x, 0, u.z);
        u.mesh.rotation.y = Math.atan2(DIRS[u.dir].x, DIRS[u.dir].z);
      }
      if (dist < 3.2 && u.cooldown <= 0) {
        state.player.speed *= 0.4;
        state.player.health = Math.max(0, state.player.health - 4);
        u.cooldown = 1.2;
        state.audio.hit();
      }
    }

    if (this.heli) {
      const hx = this.heli.position.x + (px - this.heli.position.x) * Math.min(1, dt * 0.8);
      const hz = this.heli.position.z + (pz - this.heli.position.z) * Math.min(1, dt * 0.8);
      this.heli.position.set(hx, 42, hz);
      this.heliRotor.rotation.y += dt * 22;
      this.heli.lookAt(px, 0, pz);
    }

    if (wanted > 0) {
      let near = false;
      for (const u of this.units) {
        if (Math.hypot(u.x - px, u.z - pz) < 40) { near = true; break; }
      }
      if (!near) state.wanted = Math.max(0, wanted - WANTED.decayPerSecond * dt);
    }
    this.flashT += dt;
  }
}
