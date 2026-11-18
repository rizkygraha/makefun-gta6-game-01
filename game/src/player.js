// player.js — Mara Voss on foot and behind the wheel. On foot she walks
// and sprints with WASD; F steps into the nearest car (stealing it if it
// is not hers), and in the car WASD drives with a simple arcade model:
// acceleration, steering that bites less at speed, and a handbrake that
// breaks the rear loose. Buildings stop her with a circle push-out.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh, collideCircle } from './world.js';

function figureMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.36), jacket);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  // A neon stripe so she reads at night.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.38), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  stripe.position.y = 1.3;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), pants);
  legL.position.set(-0.16, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(body);
  g.add(head);
  g.add(stripe);
  g.add(legL);
  g.add(legR);
  g.userData.legs = [legL, legR];
  return g;
}

export class Player {
  constructor(scene, world, traffic) {
    this.world = world;
    this.traffic = traffic;
    this.x = 0;
    this.z = 0;
    this.yaw = 0; // facing, radians; forward is (sin yaw, cos yaw)
    this.onFoot = true;
    this.health = CFG.tuning.playerHealth;
    this.cash = 320;
    this.rep = 1;
    this.walkPhase = 0;
    this.stolen = false; // the current car was taken, not bought

    this.figure = figureMesh();
    scene.add(this.figure);

    // Mara's own car, parked where she left it: just ahead of her on the
    // road south of the spawn, so the first thing a new player does is
    // walk up to it and get in. (It used to sit 45 m away at (45, 0),
    // which a play test showed F could never reach from the spawn.)
    this.car = makeCarMesh(0x0e7490, { glow: 0x22d3ee });
    this.car.position.set(0, 0, 5);
    scene.add(this.car);
    this.carHeading = 0;
    this.carSpeed = 0;
    this.carVel = { x: 0, z: 0 };
    this.carParked = true;
    this.parked = []; // cars she left behind on the street, still enterable
  }

  get speed() {
    return this.onFoot ? 0 : Math.hypot(this.carVel.x, this.carVel.z);
  }

  /** The point the camera follows, and the heading it looks along. */
  focus() {
    if (this.onFoot) return { x: this.x, z: this.z, heading: this.yaw };
    return { x: this.car.position.x, z: this.car.position.z, heading: this.carHeading };
  }

  update(dt, input) {
    const t = CFG.tuning;
    if (this.onFoot) {
      const ax = input.axes();
      const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = sprint ? t.sprintSpeed : t.walkSpeed;
      // Move camera-relative: W is away from the camera.
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const rx = Math.cos(this.yaw);
      const rz = -Math.sin(this.yaw);
      let mx = fx * ax.y + rx * ax.x;
      let mz = fz * ax.y + rz * ax.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len;
        mz /= len;
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
        // Face the way she walks.
        this.yaw = Math.atan2(mx, mz);
        this.walkPhase += dt * (sprint ? 11 : 7);
      }
      [this.x, this.z] = collideCircle(this.world, this.x, this.z, 0.6);
      this.figure.position.set(this.x, 0, this.z);
      this.figure.rotation.y = this.yaw;
      const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.5 : 0;
      this.figure.userData.legs[0].rotation.x = swing;
      this.figure.userData.legs[1].rotation.x = -swing;
      this.figure.visible = true;
    } else {
      const ax = input.axes();
      const handbrake = input.down('Space');
      const fx = Math.sin(this.carHeading);
      const fz = Math.cos(this.carHeading);
      // Engine force along the nose.
      if (ax.y > 0) {
        this.carVel.x += fx * t.carAccel * dt;
        this.carVel.z += fz * t.carAccel * dt;
      } else if (ax.y < 0) {
        const fwd = this.carVel.x * fx + this.carVel.z * fz;
        if (fwd > 0.5) {
          this.carVel.x -= fx * t.carBrake * dt;
          this.carVel.z -= fz * t.carBrake * dt;
        } else {
          this.carVel.x -= fx * t.carReverse * dt;
          this.carVel.z -= fz * t.carReverse * dt;
        }
      }
      // Steering: stronger at low speed, reversed when reversing.
      const fwdSpeed = this.carVel.x * fx + this.carVel.z * fz;
      const steerAuthority = Math.min(1, Math.abs(fwdSpeed) / 8);
      const steer = ax.x * t.carSteer * steerAuthority * (fwdSpeed < -0.5 ? -1 : 1);
      this.carHeading += steer * dt * (handbrake ? 1.6 : 1);
      // Grip: kill sideways velocity, less of it with the handbrake down.
      const grip = handbrake ? t.handbrakeGrip : t.carGrip;
      const nfx = Math.sin(this.carHeading);
      const nfz = Math.cos(this.carHeading);
      const fwd = this.carVel.x * nfx + this.carVel.z * nfz;
      const latX = this.carVel.x - fwd * nfx;
      const latZ = this.carVel.z - fwd * nfz;
      const damp = Math.exp(-grip * dt);
      this.carVel.x = fwd * nfx + latX * damp;
      this.carVel.z = fwd * nfz + latZ * damp;
      // Cap speed.
      const sp = Math.hypot(this.carVel.x, this.carVel.z);
      if (sp > t.carMaxSpeed) {
        this.carVel.x *= t.carMaxSpeed / sp;
        this.carVel.z *= t.carMaxSpeed / sp;
      }
      // Rolling drag.
      this.carVel.x *= 1 - 0.25 * dt;
      this.carVel.z *= 1 - 0.25 * dt;
      let nx = this.car.position.x + this.carVel.x * dt;
      let nz = this.car.position.z + this.carVel.z * dt;
      const before = [nx, nz];
      [nx, nz] = collideCircle(this.world, nx, nz, 2.1);
      if (nx !== before[0] || nz !== before[1]) {
        // A wall: scrub speed and bounce a little.
        this.carVel.x *= -0.25;
        this.carVel.z *= -0.25;
      }
      this.car.position.x = nx;
      this.car.position.z = nz;
      this.car.rotation.y = this.carHeading;
      // Spin the wheels with the road speed.
      const wob = sp * dt * 2.6;
      for (const w of this.car.userData.wheels) w.rotation.x += wob;
      this.x = nx;
      this.z = nz;
      this.figure.visible = false;
    }
  }

  /** Step into the nearest car: her own, a parked one, or a traffic car. */
  tryEnterCar() {
    if (!this.onFoot) return null;
    // The car she drives, wherever it sits.
    const dOwn = Math.hypot(this.car.position.x - this.x, this.car.position.z - this.z);
    if (dOwn < 4) {
      this.onFoot = false;
      return { stolen: this.stolen };
    }
    // A car she left parked on the street.
    for (const m of this.parked) {
      if (Math.hypot(m.position.x - this.x, m.position.z - this.z) < 4) {
        this.parked.splice(this.parked.indexOf(m), 1);
        this.parked.push(this.car);
        this.car = m;
        this.carHeading = this.yaw;
        this.carVel = { x: 0, z: 0 };
        this.onFoot = false;
        this.stolen = false;
        return { stolen: false };
      }
    }
    // Then a traffic car close by: stealing it.
    const mesh = this.traffic.stealNearest(this.x, this.z, 4);
    if (mesh) {
      // The stolen car stays where it is; her old car stays parked behind.
      this.parked.push(this.car);
      this.car = mesh;
      this.carHeading = this.yaw;
      this.carVel = { x: 0, z: 0 };
      this.onFoot = false;
      this.stolen = true;
      return { stolen: true };
    }
    return null;
  }

  /** Step out of the car, onto the street beside it. */
  exitCar() {
    if (this.onFoot) return;
    this.onFoot = true;
    this.x = this.car.position.x + Math.cos(this.carHeading) * 2.5;
    this.z = this.car.position.z - Math.sin(this.carHeading) * 2.5;
    [this.x, this.z] = collideCircle(this.world, this.x, this.z, 0.6);
    this.carVel = { x: 0, z: 0 };
    this.figure.position.set(this.x, 0, this.z);
    this.figure.visible = true;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  heal(amount) {
    this.health = Math.min(CFG.tuning.playerHealth, this.health + amount);
  }

  addCash(n) {
    this.cash += n;
  }

  addRep(n) {
    this.rep += n;
  }
}
