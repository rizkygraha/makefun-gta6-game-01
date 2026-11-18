// NEON TIDE — police.js
// The wanted system. Named units with a visible state — PURSUIT, RAMMING or
// ROADBLOCK — chase Mara, and a helicopter joins at three stars. Heat rises
// with every crime and falls when she keeps her nose clean; the safehouse
// respray clears it outright.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

function makePoliceCar() {
  const g = new THREE.Group();
  const black = new THREE.MeshLambertMaterial({ color: 0x0c0d12 });
  const white = new THREE.MeshLambertMaterial({ color: 0xd8dce4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 4.3), black);
  body.position.y = 0.55;
  g.add(body);
  const doors = new THREE.Mesh(new THREE.BoxGeometry(1.97, 0.4, 1.6), white);
  doors.position.set(0, 0.6, 0.1);
  g.add(doors);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0), new THREE.MeshLambertMaterial({ color: 0x0e1620 }));
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), black);
  barBase.position.set(0, 1.4, -0.25);
  g.add(barBase);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.32), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
  red.position.set(-0.28, 1.42, -0.25);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.32), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  blue.position.set(0.28, 1.42, -0.25);
  g.add(blue);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const s of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.1), lightMat);
    hl.position.set(s, 0.62, 2.16);
    g.add(hl);
  }
  g.userData.red = red;
  g.userData.blue = blue;
  return g;
}

function makeHelicopter() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.6), new THREE.MeshLambertMaterial({ color: 0x14161c }));
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), new THREE.MeshLambertMaterial({ color: 0x14161c }));
  tail.position.set(0, 0.2, -4);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: 0x888888 }));
  rotor.position.y = 0.8;
  g.add(rotor);
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(6, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
  );
  spot.position.y = -21;
  g.add(spot);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  lamp.position.y = -0.8;
  g.add(lamp);
  g.userData.rotor = rotor;
  return g;
}

export class Police {
  constructor(game) {
    this.g = game;
    this.wanted = 0;
    this.heat = 0;
    this.lastCrimeAt = -999;
    this.units = [];
    this.heli = null;
    this.bustTimer = 0;
    this.flashT = 0;
  }

  addWanted(n) {
    this.wanted = Math.min(5, this.wanted + n);
    this.heat = 0;
    this.lastCrimeAt = this.g.time;
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
  }

  _spawnUnit(name) {
    const g = this.g;
    const p = g.player.pos;
    // Appear on a road 55-80 units away from Mara.
    const spot = g.world.nearestRoadPoint(p.x + g.rng.range(-70, 70), p.z + g.rng.range(-70, 70));
    const mesh = makePoliceCar();
    mesh.position.set(spot.x, 0, spot.z);
    g.scene.add(mesh);
    const unit = { name, state: 'PURSUIT', mesh, heading: 0, speed: 0, stateT: 0 };
    this.units.push(unit);
    return unit;
  }

  _removeUnit(unit) {
    this.g.scene.remove(unit.mesh);
    const i = this.units.indexOf(unit);
    if (i >= 0) this.units.splice(i, 1);
  }

  _spawnHeli() {
    const mesh = makeHelicopter();
    mesh.position.set(this.g.player.pos.x, 42, this.g.player.pos.z - 20);
    this.g.scene.add(mesh);
    this.heli = mesh;
  }

  _removeHeli() {
    if (!this.heli) return;
    this.g.scene.remove(this.heli);
    this.heli = null;
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    // Heat decays: one star falls after a quiet stretch.
    if (this.wanted > 0) {
      this.heat += dt;
      if (this.heat > CFG.police.decaySeconds && g.time - this.lastCrimeAt > CFG.police.decaySeconds) {
        this.wanted--;
        this.heat = 0;
      }
    }
    // Match the unit count to the wanted level.
    while (this.units.length < this.wanted) {
      this._spawnUnit(CFG.police.names[this.units.length % CFG.police.names.length]);
    }
    while (this.units.length > this.wanted) {
      this._removeUnit(this.units[this.units.length - 1]);
    }
    // Helicopter at three stars and up.
    if (this.wanted >= 3 && !this.heli) this._spawnHeli();
    if (this.wanted < 3 && this.heli) this._removeHeli();

    // Flash the light bars.
    this.flashT += dt;
    const redOn = Math.floor(this.flashT * 4) % 2 === 0;
    for (const u of this.units) {
      u.mesh.userData.red.material.color.setHex(redOn ? 0xff2233 : 0x550000);
      u.mesh.userData.blue.material.color.setHex(redOn ? 0x000044 : 0x2244ff);
    }

    // ---- unit driving ----
    const px = p.pos.x, pz = p.pos.z;
    const pSpeed = Math.abs(p.speed || 0);
    this.units.forEach((u, i) => {
      u.stateT += dt;
      const ux = u.mesh.position.x, uz = u.mesh.position.z;
      const dx = px - ux, dz = pz - uz;
      const dist = Math.hypot(dx, dz) || 0.01;
      // State: first unit roadblocks a fast driver, close ones ram, else pursue.
      let targetX = px, targetZ = pz;
      if (i === 0 && p.mode === 'car' && pSpeed > 12) {
        u.state = 'ROADBLOCK';
        targetX = px + Math.sin(p.heading) * 26;
        targetZ = pz + Math.cos(p.heading) * 26;
      } else if (dist < CFG.police.ramRange) {
        u.state = 'RAMMING';
      } else {
        u.state = 'PURSUIT';
      }
      const wantHeading = Math.atan2(targetX - ux, targetZ - uz);
      let dh = wantHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const wantSpeed = u.state === 'RAMMING' ? CFG.police.unitSpeed + 4 : CFG.police.unitSpeed;
      u.speed += (wantSpeed - u.speed) * Math.min(1, dt * 1.2);
      const nx = ux + Math.sin(u.heading) * u.speed * dt;
      const nz = uz + Math.cos(u.heading) * u.speed * dt;
      const hit = g.world.collideCircle(nx, nz, 1.7);
      u.mesh.position.set(hit.x, 0, hit.z);
      u.mesh.rotation.y = u.heading;
      // A ram that connects slows Mara down.
      if (dist < 3.2) {
        if (p.mode === 'car') p.speed *= Math.max(0, 1 - 2.2 * dt);
        else {
          this.bustTimer += dt;
          if (this.bustTimer > CFG.police.bustTime) {
            this.bustTimer = 0;
            this._busted();
          }
        }
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt);
      }
    });

    // ---- helicopter: hover above Mara, rotor spinning ----
    if (this.heli) {
      const h = this.heli;
      h.position.x += (px - h.position.x) * Math.min(1, dt * 1.1);
      h.position.z += (pz - 14 - h.position.z) * Math.min(1, dt * 1.1);
      h.position.y = 42 + Math.sin(g.time * 0.8) * 1.5;
      h.userData.rotor.rotation.y += dt * 22;
      h.rotation.y = Math.atan2(px - h.position.x, pz - h.position.z);
    }

    g.audio.setSiren(this.wanted > 0);
  }

  _busted() {
    const g = this.g;
    const lost = Math.floor(g.cash * 0.1);
    g.cash -= lost;
    this.clearWanted();
    const s = g.world.spots.safehouse;
    g.player.pos.set(s.x, 0, s.z);
    if (g.player.car) { g.player.car = null; g.player.mode = 'foot'; g.player.mesh.visible = true; }
    g.player.mesh.position.copy(g.player.pos);
    g.banner('BUSTED', 'Commissioner Hale let you off light — $' + lost + ' in fines');
    g.audio.sfx('busted');
    g.saveProgress();
  }
}
