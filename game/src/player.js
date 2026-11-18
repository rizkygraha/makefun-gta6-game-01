// Mara Voss: on foot and behind the wheel. On foot she walks, runs and
// aims; near a parked car, F steals it and she drives. The car is simple
// arcade physics: accelerate, steer, brake, handbrake drift.

import * as THREE from '../vendor/three.module.js';
import { PLAYER, WANTED } from './config.js';
import { collideCircle, clampWorld } from './world.js';
import { makeCarMesh } from './traffic.js';

const PARKED_SPOTS = [
  { x: 44, z: 28, color: 0x2e7d8a },
  { x: -36, z: -12, color: 0x8a3a3a },
  { x: 84, z: 60, color: 0xd8d8d8 },
  { x: -116, z: 148, color: 0x3a5a8a },
  { x: 124, z: 132, color: 0xc2a13a },
  { x: 4, z: 108, color: 0x3a8a5a },
  { x: 44, z: -68, color: 0x5a3a8a },
  { x: -196, z: -12, color: 0x222226 },
];

export class Player {
  constructor(scene, world, rng) {
    this.world = world;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = Math.PI;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.health = PLAYER.health;
    this.weapon = 1;
    this.ammo = [Infinity, 24, 90, 18];
    this.cash = 420;
    this.rep = 0;
    this.walkPhase = 0;
    this.steer = 0;
    this.mesh = this._makePerson();
    scene.add(this.mesh);
    this.parked = [];
    for (const s of PARKED_SPOTS) {
      const mesh = makeCarMesh(s.color);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(mesh);
      this.parked.push({ x: s.x, z: s.z, heading: mesh.rotation.y, mesh, taken: false });
    }
  }

  _makePerson() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: 0x1f8a8a, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.35), jacket);
    body.position.y = 1.05;
    g.add(body);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.57, 0.08, 0.37),
      new THREE.MeshBasicMaterial({ color: 0x2de2ff })
    );
    trim.position.y = 1.35;
    g.add(trim);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xd8a080, roughness: 0.8 })
    );
    head.position.y = 1.78;
    g.add(head);
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 })
    );
    hair.position.y = 1.95;
    g.add(hair);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.8 });
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), legMat);
    this.legL.position.set(-0.14, 0.33, 0);
    g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), legMat);
    this.legR.position.set(0.14, 0.33, 0);
    g.add(this.legR);
    return g;
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.parked) {
      if (p.taken) continue;
      const dx = p.x - this.pos.x;
      const dz = p.z - this.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  enterCar(state) {
    const p = this.nearestCar(4.5);
    if (!p) return false;
    p.taken = true;
    this.car = p;
    this.onFoot = false;
    this.speed = 0;
    this.heading = p.heading;
    this.pos.set(p.x, 0, p.z);
    this.mesh.visible = false;
    state.wanted = Math.min(WANTED.maxStars, state.wanted + WANTED.steal);
    state.audio.siren();
    return true;
  }

  exitCar() {
    if (!this.car) return;
    this.car.taken = false;
    this.car.x = this.pos.x;
    this.car.z = this.pos.z;
    this.car.heading = this.heading;
    this.car.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.car.mesh.rotation.y = this.heading;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.pos.set(this.pos.x - fx * 2.5, 0, this.pos.z - fz * 2.5);
    this.car = null;
    this.onFoot = true;
    this.speed = 0;
    this.mesh.visible = true;
  }

  update(dt, state) {
    const input = state.input;
    const axis = input.axis();
    if (this.onFoot) {
      const running = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const camHeading = state.camHeading;
      const mx = Math.sin(camHeading);
      const mz = Math.cos(camHeading);
      const moveX = mx * axis.y + mz * axis.x;
      const moveZ = mz * axis.y - mx * axis.x;
      const len = Math.hypot(moveX, moveZ);
      if (len > 0.01) {
        const nx = moveX / len;
        const nz = moveZ / len;
        const targetHeading = Math.atan2(nx, nz);
        let diff = targetHeading - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += diff * Math.min(1, PLAYER.turnSpeed * dt);
        const step = speed * dt;
        let nx2 = this.pos.x + nx * step;
        let nz2 = this.pos.z + nz * step;
        const fixed = collideCircle(this.world.colliders, nx2, nz2, 0.6);
        nx2 = fixed.x;
        nz2 = fixed.z;
        const clamped = clampWorld(nx2, nz2);
        this.pos.x = clamped.x;
        this.pos.z = clamped.z;
        this.walkPhase += dt * speed * 1.6;
        const swing = Math.sin(this.walkPhase) * 0.5;
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
      } else {
        this.legL.rotation.x *= 0.8;
        this.legR.rotation.x *= 0.8;
      }
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;
    } else {
      const handbrake = input.down('Space');
      const steerTarget = -axis.x * PLAYER.carTurn;
      this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
      if (axis.y > 0) this.speed += PLAYER.carAccel * dt;
      else if (axis.y < 0) {
        if (this.speed > 0.5) this.speed -= PLAYER.carBrake * dt;
        else this.speed -= PLAYER.carReverse * dt;
      } else {
        this.speed -= Math.sign(this.speed) * 6 * dt;
        if (Math.abs(this.speed) < 0.2) this.speed = 0;
      }
      if (handbrake) {
        this.speed -= Math.sign(this.speed) * 18 * dt;
        this.heading += this.steer * 1.6 * dt * Math.min(1, Math.abs(this.speed) / 8);
      }
      this.speed = Math.max(-PLAYER.carMaxReverse, Math.min(PLAYER.carMaxSpeed, this.speed));
      if (Math.abs(this.speed) > 0.1) {
        this.heading += this.steer * dt * Math.min(1, Math.abs(this.speed) / 10) * (this.speed >= 0 ? 1 : -1);
      }
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      let nx = this.pos.x + fx * this.speed * dt;
      let nz = this.pos.z + fz * this.speed * dt;
      const before = { x: nx, z: nz };
      const fixed = collideCircle(this.world.colliders, nx, nz, 1.6);
      nx = fixed.x;
      nz = fixed.z;
      if (Math.abs(fixed.x - before.x) > 0.01 || Math.abs(fixed.z - before.z) > 0.01) {
        this.speed *= 0.3;
      }
      const clamped = clampWorld(nx, nz);
      this.pos.x = clamped.x;
      this.pos.z = clamped.z;
      if (this.car) {
        this.car.x = this.pos.x;
        this.car.z = this.pos.z;
        this.car.heading = this.heading;
        this.car.mesh.position.set(this.pos.x, 0, this.pos.z);
        this.car.mesh.rotation.y = this.heading;
      }
      state.audio.setEngine(true, Math.abs(this.speed) / PLAYER.carMaxSpeed);
    }
    if (input.pressed('KeyF')) {
      if (this.onFoot) this.enterCar(state);
      else this.exitCar();
    }
    if (input.pressed('Digit1')) this.weapon = 0;
    if (input.pressed('Digit2')) this.weapon = 1;
    if (input.pressed('Digit3')) this.weapon = 2;
    if (input.pressed('Digit4')) this.weapon = 3;
  }
}
