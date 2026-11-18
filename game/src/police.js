// police.js — the wanted level and the Tidewater PD. Heat rises with
// crime and cools when the player stays quiet; named units spawn to match
// the stars, chase in PURSUIT, close in to RAM, and one sets a ROADBLOCK
// ahead of a fast getaway. At three stars the helicopter comes up.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh, collideCircle } from './world.js';

function heliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5), bodyMat);
  body.position.y = 0;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
  tail.position.set(0, 0.3, -4.5);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.6), new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.2, metalness: 0.7 }));
  glass.position.set(0, 0.3, 2.2);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
  rotor.position.y = 1.1;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  tailRotor.position.set(0.4, 0.4, -6.6);
  g.add(body);
  g.add(tail);
  g.add(glass);
  g.add(rotor);
  g.add(tailRotor);
  g.userData.rotor = rotor;
  // The searchlight.
  const spot = new THREE.SpotLight(0xfff2c0, 900, 120, 0.35, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  const spotTarget = new THREE.Object3D();
  g.add(spotTarget);
  spot.target = spotTarget;
  g.add(spot);
  g.userData.spot = spot;
  g.userData.spotTarget = spotTarget;
  return g;
}

export class Police {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.heat = 0;
    this.wanted = 0;
    this.lastCrime = -99;
    this.time = 0;
    this.units = [];
    this.heli = null;
    this.heliName = null;
    this.barPhase = 0;
  }

  addHeat(n) {
    this.heat = Math.min(100, this.heat + n);
    this.lastCrime = this.time;
  }

  _wantedFromHeat() {
    if (this.heat >= 80) return 5;
    if (this.heat >= 60) return 4;
    if (this.heat >= 40) return 3;
    if (this.heat >= 20) return 2;
    if (this.heat >= 8) return 1;
    return 0;
  }

  _spawnUnit() {
    const idx = this.units.length % CFG.policeNames.length;
    const name = CFG.policeNames[idx];
    const mesh = makeCarMesh(0xe8e8e8, { glow: 0x2244ff, police: true });
    // Spawn on a road 60–100 units from the player, roughly.
    const a = this.rng.range(0, Math.PI * 2);
    const d = this.rng.range(60, 100);
    const x = Math.max(-430, Math.min(430, this._px + Math.cos(a) * d));
    const z = Math.max(-430, Math.min(430, this._pz + Math.sin(a) * d));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const unit = { name, mesh, state: 'PURSUIT', heading: 0, vx: 0, vz: 0, speed: 0 };
    this.units.push(unit);
    return unit;
  }

  _removeUnit(unit) {
    this.scene.remove(unit.mesh);
    this.units.splice(this.units.indexOf(unit), 1);
  }

  update(dt, player) {
    this.time += dt;
    this._px = player.x;
    this._pz = player.z;
    // Heat cools when the player has been quiet for a while.
    if (this.time - this.lastCrime > 6) {
      this.heat = Math.max(0, this.heat - CFG.tuning.wantedDecay * 8 * dt);
    }
    const want = this._wantedFromHeat();
    if (want !== this.wanted) this.wanted = want;

    // Match the number of units to the stars.
    const wantUnits = this.wanted === 0 ? 0 : Math.min(4, this.wanted + 1);
    while (this.units.length < wantUnits) this._spawnUnit();
    while (this.units.length > wantUnits) this._removeUnit(this.units[this.units.length - 1]);

    // Helicopter at three stars and up.
    if (this.wanted >= 3 && !this.heli) {
      this.heli = heliMesh();
      this.heliName = CFG.heliNames[this.units.length % CFG.heliNames.length];
      this.scene.add(this.heli);
    }
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
      this.heliName = null;
    }

    // Flash the light bars.
    this.barPhase += dt;
    const redOn = Math.floor(this.barPhase * 2.5) % 2 === 0;
    for (const u of this.units) {
      const bar = u.mesh.userData.bar;
      if (bar) {
        bar.userData.red.material.color.setHex(redOn ? 0xff2233 : 0x551111);
        bar.userData.blue.material.color.setHex(redOn ? 0x111155 : 0x2244ff);
      }
    }

    const pSpeed = player.inCar ? Math.hypot(player.carVel.x, player.carVel.z) : 0;
    const pHeading = player.inCar ? player.carHeading : player.yaw;
    for (const u of this.units) {
      const dx = player.x - u.mesh.position.x;
      const dz = player.z - u.mesh.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      // Pick a state.
      if (dist < 14) u.state = 'RAMMING';
      else if (pSpeed > 16 && u === this.units[0] && dist > 40) u.state = 'ROADBLOCK';
      else if (dist > 45) u.state = 'PURSUIT';
      else if (u.state === 'RAMMING' && dist > 22) u.state = 'PURSUIT';

      let tx;
      let tz;
      if (u.state === 'ROADBLOCK') {
        // Get ahead of the getaway and stop across the road.
        tx = player.x + Math.sin(pHeading) * 55;
        tz = player.z + Math.cos(pHeading) * 55;
      } else {
        tx = player.x;
        tz = player.z;
      }
      const tdx = tx - u.mesh.position.x;
      const tdz = tz - u.mesh.position.z;
      const targetHeading = Math.atan2(tdx, tdz);
      // Steer toward the target heading.
      let dh = targetHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh * 3 * dt));
      const maxSpeed = u.state === 'RAMMING' ? 31 : u.state === 'ROADBLOCK' ? 26 : 28;
      const accel = u.state === 'ROADBLOCK' && dist < 20 ? -18 : 14;
      u.speed = Math.max(0, Math.min(maxSpeed, u.speed + accel * dt));
      if (u.state === 'ROADBLOCK' && dist < 18) u.speed = 0;
      const fx = Math.sin(u.heading);
      const fz = Math.cos(u.heading);
      u.vx = fx * u.speed;
      u.vz = fz * u.speed;
      let nx = u.mesh.position.x + u.vx * dt;
      let nz = u.mesh.position.z + u.vz * dt;
      [nx, nz] = collideCircle(this.world, nx, nz, 2.1);
      u.mesh.position.x = nx;
      u.mesh.position.z = nz;
      u.mesh.rotation.y = u.heading;
      for (const w of u.mesh.userData.wheels) w.rotation.x += (u.speed * dt) / 0.38;
      u.dist = dist;
    }

    if (this.heli) {
      const t = this.time * 0.25;
      this.heli.position.set(
        player.x + Math.cos(t) * 26,
        42,
        player.z + Math.sin(t) * 26,
      );
      this.heli.rotation.y = Math.atan2(player.x - this.heli.position.x, player.z - this.heli.position.z);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.spotTarget.position.set(
        player.x - this.heli.position.x,
        -42,
        player.z - this.heli.position.z,
      );
    }
  }

  /** The units the HUD lists, nearest first. */
  listUnits() {
    return this.units
      .slice()
      .sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999))
      .map((u) => ({ name: u.name, state: u.state, dist: Math.round(u.dist ?? 0) }));
  }
}
