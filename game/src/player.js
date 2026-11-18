// NEON TIDE — player.js
// Mara Voss, on foot and behind the wheel. On foot she turns with A/D or the
// mouse and walks with W/S; in a car W/S is throttle and brake, A/D steers,
// Space is the handbrake. F enters the nearest car (her own teal car is free;
// a traffic car is a steal and raises heat). She collects Tide Tapes, and a
// fall to zero health sends her to the hospital.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

function makeMara() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a1c5c });
  const trim = new THREE.MeshBasicMaterial({ color: 0xff2ea6 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9a184 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1e26 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.85, 0.28), dark);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), jacket);
  torso.position.y = 1.2;
  g.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.36), trim);
  stripe.position.y = 1.35;
  g.add(stripe);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.74;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.4), dark);
  hair.position.y = 1.95;
  g.add(hair);
  return g;
}

export function makePlayerCar() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0f7a6e });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1620 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.05, -0.2);
  g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.97, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0x2effc4 }));
  stripe.position.set(0, 0.72, 0.6);
  g.add(stripe);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const s of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.1), lightMat);
    hl.position.set(s, 0.62, 2.21);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.1), tailMat);
    tl.position.set(s, 0.62, -2.21);
    g.add(tl);
  }
  // One headlight beam for the player's own car.
  const beam = new THREE.SpotLight(0xfff2c0, 55, 42, 0.5, 0.5, 1.6);
  beam.position.set(0, 0.8, 2.1);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0, 14);
  g.add(beamTarget);
  beam.target = beamTarget;
  g.add(beam);
  return g;
}

export class Player {
  constructor(game) {
    this.g = game;
    const s = game.world.spots.spawn;
    this.pos = new THREE.Vector3(s.x, 0, s.z);
    this.heading = Math.PI; // facing north, up the avenue
    this.mode = 'foot';
    this.speed = 0;         // forward speed (m/s), signed
    this.steer = 0;
    this.health = CFG.player.health;
    this.hurtAt = -99;
    this.car = null;        // the car object currently driven
    this.walkPhase = 0;
    this.mesh = makeMara();
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
    // Mara's own car, parked ahead of the spawn.
    this.ownCar = {
      mesh: makePlayerCar(),
      heading: Math.PI,
      speed: 0,
      steer: 0,
      isPlayerCar: true,
      parked: true,
    };
    this.ownCar.mesh.position.set(0, 0, 5);
    this.ownCar.mesh.rotation.y = Math.PI;
    game.scene.add(this.ownCar.mesh);
  }

  // The car object the player can enter (own car or a traffic car), or null.
  nearestCar() {
    const g = this.g;
    const range = CFG.player.enterRange;
    let best = null;
    let bestD = range;
    const consider = (car) => {
      const d = Math.hypot(car.mesh.position.x - this.pos.x, car.mesh.position.z - this.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    };
    if (!this.car) consider(this.ownCar);
    for (const c of g.traffic.cars) consider(c);
    return best;
  }

  enterCar(car) {
    const g = this.g;
    if (car.isPlayerCar) {
      // Her own car: free.
    } else {
      g.traffic.stealCar(car);
      g.addWanted(1);
      g.banner('CAR STOLEN', 'The Ebb will remember this — heat +1');
      g.audio.sfx('steal');
    }
    this.car = car;
    this.mode = 'car';
    this.heading = car.heading;
    this.speed = 0;
    this.steer = 0;
    this.mesh.visible = false;
    g.audio.sfx('door');
  }

  exitCar() {
    const g = this.g;
    if (!this.car) return;
    const car = this.car;
    this.car = null;
    this.mode = 'foot';
    this.pos.set(car.mesh.position.x - Math.sin(this.heading) * 2.4, 0, car.mesh.position.z - Math.cos(this.heading) * 2.4);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    g.audio.sfx('door');
  }

  damage(amount, why) {
    this.health -= amount;
    this.hurtAt = this.g.time;
    if (this.health <= 0) this.wasted();
  }

  wasted() {
    const g = this.g;
    const lost = Math.floor(g.cash * 0.1);
    g.cash -= lost;
    g.police.wanted = 0;
    g.police.heat = 0;
    this.health = CFG.player.health;
    const h = g.world.spots.hospital;
    this.pos.set(h.x, 0, h.z);
    if (this.car) { this.car = null; this.mode = 'foot'; this.mesh.visible = true; }
    this.mesh.position.copy(this.pos);
    g.banner('WASTED', 'The hospital patched you up — $' + lost + ' in bills');
    g.audio.sfx('wasted');
    g.saveProgress();
  }

  update(dt) {
    const g = this.g;
    const c = g.controls;
    // Health regenerates slowly out of combat.
    if (g.time - this.hurtAt > 5 && this.health < CFG.player.health) {
      this.health = Math.min(CFG.player.health, this.health + 2.5 * dt);
    }
    // Mouse-look turns Mara on foot.
    if (this.mode === 'foot' && c.mouseDX) {
      this.heading -= c.mouseDX * 0.0035;
    }
    if (this.mode === 'foot') {
      const turn = (c.left ? -1 : 0) + (c.right ? 1 : 0);
      this.heading += turn * 2.6 * dt;
      const fwd = (c.forward ? 1 : 0) - (c.back ? 0.55 : 0);
      const speed = c.sprint ? CFG.player.sprintSpeed : CFG.player.walkSpeed;
      const vx = Math.sin(this.heading) * fwd * speed;
      const vz = Math.cos(this.heading) * fwd * speed;
      this.pos.x += vx * dt;
      this.pos.z += vz * dt;
      const hit = g.world.collideCircle(this.pos.x, this.pos.z, CFG.player.radius);
      this.pos.x = hit.x; this.pos.z = hit.z;
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.heading;
      this.walkPhase += dt * Math.abs(fwd) * speed * 1.4;
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
      this.speed = fwd * speed;
      // Tide Tapes.
      for (const t of g.world.tapes) {
        if (t.taken) continue;
        if (Math.hypot(t.x - this.pos.x, t.z - this.pos.z) < CFG.player.collectRange) {
          t.taken = true;
          t.mesh.visible = false;
          g.tapes++;
          g.audio.sfx('pickup');
          g.hud.flashObjective('Tide Tape ' + g.tapes + '/' + CFG.tapesTotal);
        }
      }
      if (c.enter) {
        const car = this.nearestCar();
        if (car) this.enterCar(car);
      }
    } else {
      // Driving.
      const car = this.car;
      const steerTarget = ((c.left ? -1 : 0) + (c.right ? 1 : 0)) * CFG.car.steerMax;
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * CFG.car.steerSpeed * 2);
      if (c.forward) this.speed += CFG.car.accel * dt;
      if (c.back) this.speed -= (this.speed > 0.5 ? CFG.car.brake : CFG.car.accel * 0.7) * dt;
      if (!c.forward && !c.back) this.speed -= Math.sign(this.speed) * 6 * dt;
      if (Math.abs(this.speed) < 0.2 && !c.forward && !c.back) this.speed = 0;
      this.speed = Math.max(-CFG.car.reverseMax, Math.min(CFG.car.maxSpeed, this.speed));
      const grip = c.brake ? CFG.car.handbrakeGrip : CFG.car.grip;
      if (c.brake) this.speed *= Math.max(0, 1 - 0.9 * dt);
      const turnRate = this.speed * Math.tan(this.steer) * 0.16 * (grip / CFG.car.grip);
      this.heading += turnRate * dt;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      this.pos.x += fx * this.speed * dt;
      this.pos.z += fz * this.speed * dt;
      const hit = g.world.collideCircle(this.pos.x, this.pos.z, 1.7);
      const hitWall = hit.x !== this.pos.x || hit.z !== this.pos.z;
      if (hitWall) {
        this.pos.x = hit.x; this.pos.z = hit.z;
        if (Math.abs(this.speed) > 8) g.audio.sfx('crash');
        this.speed *= 0.45;
      }
      // Shove traffic cars aside.
      for (const tc of g.traffic.cars) {
        const dx = tc.mesh.position.x - this.pos.x;
        const dz = tc.mesh.position.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.4 && d > 0.01) {
          tc.mesh.position.x += (dx / d) * (3.4 - d);
          tc.mesh.position.z += (dz / d) * (3.4 - d);
          this.speed *= 0.92;
        }
      }
      car.mesh.position.set(this.pos.x, 0, this.pos.z);
      car.mesh.rotation.y = this.heading;
      car.heading = this.heading;
      car.speed = this.speed;
      this.mesh.position.copy(this.pos);
      if (c.enter) this.exitCar();
    }
  }
}
