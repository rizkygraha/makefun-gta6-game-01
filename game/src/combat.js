// Combat: the player's weapons and the Ebb who shoot back. Hitscan shots
// from the camera's crosshair, muzzle flash, tracers, and enemies that close
// in and fire. Dario Flint is the boss of the last job.

import * as THREE from '../vendor/three.module.js';
import { WEAPONS, WANTED } from './config.js';
import { collideCircle } from './world.js';
import { makePedMesh } from './traffic.js';

const NAMES = ['Ebb Lookout', 'Ebb Enforcer', 'Ebb Guard', 'Ebb Runner'];

export class Combat {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.enemies = [];
    this.tracers = [];
    this.cooldown = 0;
    this.flash = new THREE.PointLight(0xffc860, 0, 18, 1.5);
    this.scene.add(this.flash);
    this.flashT = 0;
    this.raycaster = new THREE.Raycaster();
  }

  _enemyMesh(isBoss) {
    const g = makePedMesh(isBoss ? 0x8a1a1a : 0x3a1a1a);
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(isBoss ? 0.55 : 0.35),
      new THREE.MeshBasicMaterial({ color: isBoss ? 0xffe62d : 0xff2d2d })
    );
    marker.position.y = 2.3;
    g.add(marker);
    g.userData.marker = marker;
    return g;
  }

  spawnSquad(x, z, count, boss) {
    const n = boss ? Math.max(1, count - 1) : count;
    for (let i = 0; i < n; i++) {
      this._spawnOne(x + this.rng.range(-10, 10), z + this.rng.range(-10, 10), false);
    }
    if (boss) this._spawnOne(x + 4, z - 4, true);
  }

  _spawnOne(x, z, isBoss) {
    const mesh = this._enemyMesh(isBoss);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.enemies.push({
      x,
      z,
      health: isBoss ? 220 : 70,
      maxHealth: isBoss ? 220 : 70,
      mesh,
      name: isBoss ? 'Dario Flint' : NAMES[this.rng.int(0, NAMES.length - 1)],
      isBoss,
      speed: this.rng.range(2.5, 3.6),
      shootTimer: this.rng.range(0.8, 2),
      phase: this.rng.range(0, 6),
    });
  }

  _tracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.BoxGeometry(0.06, 0.06, len);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.lookAt(to);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.12 });
  }

  _shoot(state) {
    const p = state.player;
    const w = WEAPONS[p.weapon];
    if (w.ammo !== Infinity) {
      if (p.ammo[p.weapon] <= 0) return;
      p.ammo[p.weapon] -= 1;
    }
    this.cooldown = 1 / w.rate;
    const cam = state.render.camera;
    const from = new THREE.Vector3();
    cam.getWorldPosition(from);
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    if (w.spread > 0) {
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
    }
    this.flash.position.copy(from).addScaledVector(dir, 2);
    this.flash.intensity = 60;
    this.flashT = 0.06;
    state.audio.shoot();
    this.raycaster.set(from, dir);
    this.raycaster.far = w.range;
    const meshes = this.enemies.map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && !this.enemies.some((e) => e.mesh === obj)) obj = obj.parent;
      const enemy = this.enemies.find((e) => e.mesh === obj);
      if (enemy) {
        enemy.health -= w.damage;
        state.audio.hit();
        this._tracer(from, hits[0].point);
        if (enemy.health <= 0) this._kill(enemy, state);
      }
    } else {
      const end = from.clone().addScaledVector(dir, w.range);
      this._tracer(from, end);
    }
  }

  _melee(state) {
    const p = state.player;
    this.cooldown = 1 / WEAPONS[0].rate;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    for (const e of [...this.enemies]) {
      const dx = e.x - p.pos.x;
      const dz = e.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < WEAPONS[0].range && (dx * fx + dz * fz) / d > 0.5) {
        e.health -= WEAPONS[0].damage;
        state.audio.hit();
        if (e.health <= 0) this._kill(e, state);
      }
    }
  }

  _kill(enemy, state) {
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    this.scene.remove(enemy.mesh);
    state.player.cash += 25;
    state.wanted = Math.min(WANTED.maxStars, state.wanted + (enemy.isBoss ? 0 : 1));
    if (enemy.isBoss) state.missions.say('Dario Flint is down. The Ebb is finished.', null);
  }

  update(dt, state) {
    const p = state.player;
    const input = state.input;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.intensity = 0;
    }
    for (const t of [...this.tracers]) {
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(this.tracers.indexOf(t), 1);
      }
    }
    if (state.screen === 'play' && p.onFoot) {
      const w = WEAPONS[p.weapon];
      const wantFire = w.auto ? input.mouseDown : input.consumeClick();
      if (wantFire && this.cooldown <= 0) {
        if (p.weapon === 0) this._melee(state);
        else this._shoot(state);
      }
    }
    for (const e of [...this.enemies]) {
      const dx = p.pos.x - e.x;
      const dz = p.pos.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.2) {
        const step = Math.min(dist - 1.2, e.speed * dt);
        let nx = e.x + (dx / dist) * step;
        let nz = e.z + (dz / dist) * step;
        const fixed = collideCircle(state.world.colliders, nx, nz, 0.5);
        e.x = fixed.x;
        e.z = fixed.z;
      }
      e.phase += dt * 4;
      e.mesh.position.set(e.x, Math.abs(Math.sin(e.phase)) * 0.05, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.mesh.userData.marker.rotation.y += dt * 3;
      e.mesh.userData.marker.position.y = 2.3 + Math.sin(state.time * 3) * 0.12;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 42 && p.onFoot) {
        e.shootTimer = this.rng.range(1.4, 2.6);
        const from = new THREE.Vector3(e.x, 1.5, e.z);
        const to = new THREE.Vector3(p.pos.x, 1.2, p.pos.z);
        this._tracer(from, to);
        if (this.rng.chance(0.45)) {
          p.health = Math.max(0, p.health - (e.isBoss ? 12 : 7));
          state.audio.hit();
        }
      }
    }
    if (p.health <= 0) {
      p.health = 100;
      p.cash = Math.max(0, p.cash - 200);
      state.wanted = 0;
      if (p.car) p.exitCar();
      p.pos.set(140, 0, 140);
      p.heading = Math.PI;
      state.missions.say('You woke up at the Hospital. $200 gone. Hale is still out there.', null);
    }
  }
}
