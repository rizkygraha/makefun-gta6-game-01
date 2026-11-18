// NEON TIDE — combat.js
// Weapons, shooting and the Ebb. Four weapons on keys 1-4, R reloads, the
// mouse (or J) fires down the crosshair. Enemies close in and shoot back;
// running one over in a car counts too. A muzzle flash and a tracer mark
// every shot.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

function makeFoe(isBoss) {
  const g = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color: isBoss ? 0x5c0f0f : 0x3a0f16 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xb98a68 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14141a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.3), dark);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.36), coat);
  torso.position.y = 1.22;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.76;
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.7), dark);
  gun.position.set(0.3, 1.3, 0.3);
  g.add(gun);
  if (isBoss) {
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    hat.position.y = 1.98;
    g.add(hat);
  }
  // Health bar: dark back + green-to-red front, both thin boxes overhead.
  const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  barBg.position.y = 2.25;
  g.add(barBg);
  const barFg = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: 0x37d67a }));
  barFg.position.y = 2.25;
  g.add(barFg);
  g.userData.barFg = barFg;
  return g;
}

export class Combat {
  constructor(game) {
    this.g = game;
    this.weapons = CFG.weapons;
    this.current = 1; // pistol by default
    this.mag = this.weapons.map((w) => (w.mag === Infinity ? Infinity : w.mag));
    this.reserve = this.weapons.map((w) => w.reserve);
    this.enemies = [];
    this.foesDown = 0;
    this.cooldown = 0;
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this.muzzle = new THREE.PointLight(0xffc46b, 0, 14, 1.8);
    game.scene.add(this.muzzle);
    this.muzzleT = 0;
  }

  get weapon() { return this.weapons[this.current]; }

  spawnFoes(pos, n, boss) {
    const g = this.g;
    // Clear any leftovers first.
    for (const e of this.enemies) g.scene.remove(e.mesh);
    this.enemies = [];
    for (let i = 0; i < n; i++) {
      const isBoss = boss && i === 0;
      const a = (i / n) * Math.PI * 2 + g.rng.range(-0.4, 0.4);
      const r = g.rng.range(6, 16);
      const x = pos.x + Math.sin(a) * r;
      const z = pos.z + Math.cos(a) * r;
      const fixed = g.world.collideCircle(x, z, 1);
      const mesh = makeFoe(isBoss);
      mesh.position.set(fixed.x, 0, fixed.z);
      g.scene.add(mesh);
      const hp = isBoss ? 320 : 100;
      this.enemies.push({
        mesh, hp, maxHp: hp, isBoss,
        speed: g.rng.range(2.2, 3.4),
        shootT: g.rng.range(1, 2.5),
        dead: false, deadT: 0,
        strafeDir: g.rng.sign(),
      });
    }
    g.hud.flashObjective('Hostiles: ' + n + (boss ? ' — Dario Flint is here' : ''));
  }

  reload() {
    const w = this.weapon;
    if (w.mag === Infinity) return;
    const need = w.mag - this.mag[this.current];
    if (need <= 0 || this.reserve[this.current] <= 0) return;
    const take = Math.min(need, this.reserve[this.current]);
    this.mag[this.current] += take;
    this.reserve[this.current] -= take;
    this.g.audio.sfx('reload');
  }

  _fire() {
    const g = this.g;
    const w = this.weapon;
    if (this.cooldown > 0) return;
    this.cooldown = 1 / w.rate;
    if (w.mag !== Infinity) {
      if (this.mag[this.current] <= 0) { g.audio.sfx('dry'); this.reload(); return; }
      this.mag[this.current]--;
    }
    const cam = g.render.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    // Spread.
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.y += (Math.random() - 0.5) * w.spread * 2;
    dir.z += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();
    const origin = cam.position.clone();
    this.raycaster.set(origin, dir);
    this.raycaster.far = w.range;
    const targets = this.enemies.filter((e) => !e.dead).map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    let end;
    if (hits.length > 0) {
      const hit = hits[0];
      end = hit.point.clone();
      // Walk up to the foe group that owns this mesh.
      let foe = null;
      for (const e of this.enemies) {
        if (e.mesh === hit.object || e.mesh.children.includes(hit.object) || this._owns(e.mesh, hit.object)) { foe = e; break; }
      }
      if (foe) this._damageFoe(foe, w.damage);
    } else {
      end = origin.clone().addScaledVector(dir, w.range);
    }
    // Muzzle flash at the player's gun + a tracer to the end point.
    const gunPos = g.player.pos.clone();
    gunPos.y = 1.45;
    gunPos.addScaledVector(dir, 0.8);
    this.muzzle.position.copy(gunPos);
    this.muzzle.intensity = 40;
    this.muzzleT = 0.06;
    if (w.tracer) this._tracer(gunPos, end);
    g.audio.sfx('shoot');
    g.hud.hitMarker(hits.length > 0);
  }

  _owns(group, obj) {
    let o = obj;
    while (o) { if (o === group) return true; o = o.parent; }
    return false;
  }

  _tracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.g.scene.add(line);
    this.tracers.push({ line, t: 0.09 });
  }

  _damageFoe(foe, dmg) {
    const g = this.g;
    foe.hp -= dmg;
    const bar = foe.mesh.userData.barFg;
    const frac = Math.max(0, foe.hp / foe.maxHp);
    bar.scale.x = frac;
    bar.material.color.setHex(frac > 0.5 ? 0x37d67a : frac > 0.25 ? 0xffb020 : 0xff3344);
    if (foe.hp <= 0 && !foe.dead) {
      foe.dead = true;
      foe.deadT = 0;
      foe.mesh.rotation.x = -Math.PI / 2;
      foe.mesh.position.y = 0.25;
      this.foesDown++;
      g.missions.foesDown++;
      g.cash += 25;
      g.audio.sfx('down');
    }
  }

  update(dt) {
    const g = this.g;
    const c = g.controls;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      if (this.muzzleT <= 0) this.muzzle.intensity = 0;
    }
    // Weapon switching and reload.
    for (let i = 0; i < this.weapons.length; i++) {
      if (c.weapon === i) this.current = i;
    }
    if (c.reload) this.reload();
    // Fire: click, J, or hold for automatic weapons.
    const wantFire = c.shoot || (this.weapon.auto && c.shootHeld);
    if (wantFire && g.player.mode === 'foot' && g.state === 'play') this._fire();
    // Tracers fade.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t -= dt;
      t.line.material.opacity = Math.max(0, t.t / 0.09) * 0.9;
      if (t.t <= 0) {
        g.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // ---- enemy AI ----
    const p = g.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        e.deadT += dt;
        if (e.deadT > 2) {
          g.scene.remove(e.mesh);
          this.enemies.splice(i, 1);
        }
        continue;
      }
      const ex = e.mesh.position.x, ez = e.mesh.position.z;
      const dx = p.pos.x - ex, dz = p.pos.z - ez;
      const dist = Math.hypot(dx, dz) || 0.01;
      // Run over: a car flattens a foe.
      if (p.mode === 'car' && dist < 2.6) {
        this._damageFoe(e, 999);
        g.addWanted(1);
        g.audio.sfx('crash');
        continue;
      }
      // Close in, keep some distance, strafe a little.
      let mx = 0, mz = 0;
      if (dist > 20) { mx = dx / dist; mz = dz / dist; }
      else if (dist < 8) { mx = -dx / dist; mz = -dz / dist; }
      const px = -dz / dist * e.strafeDir * 0.4, pz = dx / dist * e.strafeDir * 0.4;
      const nx = ex + (mx + px) * e.speed * dt;
      const nz = ez + (mz + pz) * e.speed * dt;
      const fixed = g.world.collideCircle(nx, nz, 0.6);
      e.mesh.position.set(fixed.x, 0, fixed.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      // Shoot back.
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < 42) {
        e.shootT = g.rng.range(1.4, 2.6);
        const hitChance = dist < 15 ? 0.5 : dist < 30 ? 0.3 : 0.15;
        if (g.rng.f() < hitChance) {
          const dmg = p.mode === 'car' ? 3 : g.rng.range(6, 12);
          p.damage(dmg, 'shot');
          g.audio.sfx('hit');
        } else {
          g.audio.sfx('whizz');
        }
        // A red tracer back at Mara.
        const from = e.mesh.position.clone();
        from.y = 1.4;
        const to = p.pos.clone();
        to.y = 1.3;
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.8 }));
        g.scene.add(line);
        this.tracers.push({ line, t: 0.09 });
      }
    }
  }
}
