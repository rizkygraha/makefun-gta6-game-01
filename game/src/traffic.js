// NEON TIDE — traffic.js
// Civilian cars and pedestrians. Cars loop around city blocks on the road
// centrelines; pedestrians stroll the sidewalks and turn at intersections.
// They are scenery with simple rules, and they stop for the player in front
// of them instead of driving through.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

const CAR_COLORS = [0x8a2f2f, 0x2f5d8a, 0x3a6b46, 0x6b5a2e, 0x4a4a55, 0x7a3a6b, 0x2e6b6b, 0x555f2e];
const PED_COLORS = [0xd8d8d8, 0xff9f1c, 0x2effc4, 0xff5a5a, 0x9db8ff, 0xe2b8ff];

function makeCivilianCar(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1620 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.1), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const s of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.1), lightMat);
    hl.position.set(s, 0.62, 2.06);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.1), tailMat);
    tl.position.set(s, 0.62, -2.06);
    g.add(tl);
  }
  return g;
}

function makePedestrian(color) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9a184 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), new THREE.MeshLambertMaterial({ color: 0x1c1e26 }));
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), jacket);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.68;
  g.add(head);
  return g;
}

export class Traffic {
  constructor(game) {
    this.g = game;
    this.cars = [];
    this.peds = [];
    this._buildCars();
    this._buildPeds();
  }

  _loopForBlock(rng) {
    // A rectangular loop on the road centrelines around one block.
    const lines = CFG.roadLines;
    const i = rng.int(0, lines.length - 2);
    const j = rng.int(0, lines.length - 2);
    const x0 = lines[i], x1 = lines[i + 1];
    const z0 = lines[j], z1 = lines[j + 1];
    return [
      { x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 },
    ];
  }

  _buildCars() {
    const rng = this.g.rng;
    for (let n = 0; n < CFG.traffic.carCount; n++) {
      const loop = this._loopForBlock(rng);
      const seg = rng.int(0, 3);
      const t = rng.f();
      const a = loop[seg];
      const b = loop[(seg + 1) % 4];
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const mesh = makeCivilianCar(rng.pick(CAR_COLORS));
      mesh.position.set(x, 0, z);
      this.g.scene.add(mesh);
      this.cars.push({
        mesh, loop, seg, t,
        speed: rng.range(CFG.traffic.carSpeedMin, CFG.traffic.carSpeedMax),
        lane: rng.sign() * 2.5,
        heading: 0,
        parked: false,
      });
    }
  }

  _buildPeds() {
    const rng = this.g.rng;
    for (let n = 0; n < CFG.traffic.pedCount; n++) {
      const line = rng.pick(CFG.roadLines);
      const along = rng.range(-200, 200);
      const axis = rng.chance(0.5) ? 'x' : 'z';
      const side = rng.sign();
      const x = axis === 'x' ? line + side * 7.2 : along;
      const z = axis === 'x' ? along : line + side * 7.2;
      const mesh = makePedestrian(rng.pick(PED_COLORS));
      mesh.position.set(x, 0, z);
      this.g.scene.add(mesh);
      this.peds.push({
        mesh, axis, line, side,
        along,
        dir: rng.sign(),
        speed: rng.range(CFG.traffic.pedSpeedMin, CFG.traffic.pedSpeedMax),
        walkPhase: rng.range(0, Math.PI * 2),
      });
    }
  }

  // Remove a car from the traffic flow (stolen by the player). Returns it.
  stealCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.parked = true;
    return car;
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    // ---- cars: follow their block loop ----
    for (const car of this.cars) {
      // Stop for the player in front of the car.
      let blocked = false;
      if (p) {
        const dx = p.pos.x - car.mesh.position.x;
        const dz = p.pos.z - car.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 6) {
          const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
          const ahead = dx * fx + dz * fz;
          if (ahead > 0) blocked = true;
        }
      }
      const speed = blocked ? 0 : car.speed;
      let remaining = speed * dt;
      let guard = 0;
      while (remaining > 0.001 && guard++ < 4) {
        const a = car.loop[car.seg];
        const b = car.loop[(car.seg + 1) % 4];
        const segLen = Math.hypot(b.x - a.x, b.z - a.z);
        const segLeft = (1 - car.t) * segLen;
        if (remaining < segLeft) {
          car.t += remaining / segLen;
          remaining = 0;
        } else {
          remaining -= segLeft;
          car.seg = (car.seg + 1) % 4;
          car.t = 0;
        }
      }
      const a = car.loop[car.seg];
      const b = car.loop[(car.seg + 1) % 4];
      const cx = a.x + (b.x - a.x) * car.t;
      const cz = a.z + (b.z - a.z) * car.t;
      // Lane offset, perpendicular to the direction of travel.
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      car.mesh.position.set(cx + px * car.lane, 0, cz + pz * car.lane);
      car.heading = Math.atan2(dx, dz);
      car.mesh.rotation.y = car.heading;
    }
    // ---- pedestrians: stroll a sidewalk, turn at intersections ----
    for (const ped of this.peds) {
      ped.along += ped.dir * ped.speed * dt;
      if (ped.along > 208) { ped.along = 208; ped.dir = -1; }
      if (ped.along < -208) { ped.along = -208; ped.dir = 1; }
      // At a road line, sometimes turn onto the crossing road.
      const nearLine = CFG.roadLines.some((l) => Math.abs(ped.along - l) < 0.6);
      if (nearLine && this.g.rng.chance(dt * 0.25)) {
        const other = this.g.rng.chance(0.5) ? 'x' : 'z';
        if (other !== ped.axis) {
          const oldLine = ped.line;
          ped.axis = other;
          ped.line = ped.along;
          ped.along = oldLine;
          ped.side = this.g.rng.sign();
        }
      }
      const x = ped.axis === 'x' ? ped.line + ped.side * 7.2 : ped.along;
      const z = ped.axis === 'x' ? ped.along : ped.line + ped.side * 7.2;
      ped.mesh.position.set(x, 0, z);
      const heading = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      ped.mesh.rotation.y = heading;
      ped.walkPhase += dt * ped.speed * 3;
      ped.mesh.position.y = Math.abs(Math.sin(ped.walkPhase)) * 0.06;
    }
  }
}
