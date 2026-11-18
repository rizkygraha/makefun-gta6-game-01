// Civilian traffic: cars that drive the road grid and pedestrians on the
// sidewalks. Cars turn at intersections; pedestrians ping-pong their block.
// Also the car factory every other system uses for its own vehicles.

import * as THREE from '../vendor/three.module.js';
import { WORLD } from './config.js';

const CAR_COLORS = [0x8a8f98, 0x3a5a8a, 0x8a3a3a, 0x3a8a5a, 0xc2a23a, 0x5a3a8a, 0xd8d8d8, 0x222226];

export function makeCarMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.15, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.2), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), lightMat);
    h.position.set(sx, 0.6, 2.12);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  for (const sx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    t.position.set(sx, 0.6, -2.12);
    g.add(t);
  }
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.7), wheelMat);
    w.position.set(wx, 0.35, wz);
    g.add(w);
  }
  return g;
}

export function makePedMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.32), bodyMat);
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xd8a080, roughness: 0.8 })
  );
  head.position.y = 1.7;
  g.add(head);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.8 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), legMat);
  legL.position.set(-0.13, 0.3, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), legMat);
  legR.position.set(0.13, 0.3, 0);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

const DIRS = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
];

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 14; i++) this.cars.push(this._spawnCar());
    for (let i = 0; i < 18; i++) this.peds.push(this._spawnPed());
  }

  _roadCoord() {
    return -WORLD.half + this.rng.int(0, 12) * WORLD.block;
  }

  _spawnCar() {
    const alongX = this.rng.chance(0.5);
    const road = this._roadCoord();
    const along = this.rng.range(-WORLD.half + 20, WORLD.half - 20);
    const dir = alongX ? (this.rng.chance(0.5) ? 0 : 2) : (this.rng.chance(0.5) ? 1 : 3);
    const mesh = makeCarMesh(CAR_COLORS[this.rng.int(0, CAR_COLORS.length - 1)]);
    this.scene.add(mesh);
    return {
      x: alongX ? along : road,
      z: alongX ? road : along,
      dir,
      speed: this.rng.range(8, 14),
      mesh,
    };
  }

  _spawnPed() {
    const alongX = this.rng.chance(0.5);
    const road = this._roadCoord();
    const side = this.rng.chance(0.5) ? 8.5 : -8.5;
    const along = this.rng.range(-WORLD.half + 20, WORLD.half - 20);
    const colors = [0xc23b2e, 0x2e7dc2, 0x3aa655, 0xd8a13a, 0x8a5ac2, 0xd8d8d8];
    const mesh = makePedMesh(colors[this.rng.int(0, colors.length - 1)]);
    this.scene.add(mesh);
    return {
      x: alongX ? along : road + side,
      z: alongX ? road + side : along,
      alongX,
      dir: this.rng.chance(0.5) ? 1 : -1,
      speed: this.rng.range(0.9, 1.8),
      phase: this.rng.range(0, 6),
      mesh,
    };
  }

  _nextIntersection(v, dir) {
    const step = WORLD.block;
    if (dir > 0) return Math.floor(v / step) * step + step;
    return Math.ceil(v / step) * step - step;
  }

  update(dt, state) {
    const px = state.player.pos.x;
    const pz = state.player.pos.z;
    for (const car of this.cars) {
      const d = DIRS[car.dir];
      let speed = car.speed;
      const dxp = px - car.x;
      const dzp = pz - car.z;
      if (dxp * dxp + dzp * dzp < 100) speed = Math.min(speed, 3);
      const before = car.dir % 2 === 0 ? car.x : car.z;
      const target = this._nextIntersection(before, d.x !== 0 ? d.x : d.z);
      let moved = (car.dir % 2 === 0 ? d.x : d.z) * speed * dt;
      let after = before + moved;
      if ((d.x !== 0 ? d.x : d.z) > 0 ? after >= target : after <= target) {
        after = target;
        const r = this.rng.next();
        if (r < 0.22) car.dir = (car.dir + 1) % 4;
        else if (r < 0.38) car.dir = (car.dir + 3) % 4;
        moved = after - before;
      }
      if (car.dir % 2 === 0) car.x += moved;
      else car.z += moved;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = Math.atan2(DIRS[car.dir].x, DIRS[car.dir].z);
    }
    for (const ped of this.peds) {
      ped.phase += dt * ped.speed * 3;
      const step = ped.dir * ped.speed * dt;
      if (ped.alongX) {
        ped.x += step;
        const block = Math.round((ped.x + WORLD.half) / WORLD.block) * WORLD.block - WORLD.half;
        if (Math.abs(ped.x - block) < 2 || Math.abs(ped.x) > WORLD.half - 10) ped.dir *= -1;
      } else {
        ped.z += step;
        const block = Math.round((ped.z + WORLD.half) / WORLD.block) * WORLD.block - WORLD.half;
        if (Math.abs(ped.z - block) < 2 || Math.abs(ped.z) > WORLD.half - 10) ped.dir *= -1;
      }
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.phase)) * 0.06, ped.z);
      ped.mesh.rotation.y = ped.alongX ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      const swing = Math.sin(ped.phase) * 0.4;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
    }
  }
}
