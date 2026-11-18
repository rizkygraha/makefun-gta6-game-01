// combat.js — weapons, shooting and the Ebb. Enemies walk at the player
// and shoot back; the player answers with a raycast through the crosshair.
// Muzzle flash, tracers and a health bar over every foe.

import * as THREE from 'three';
import { CFG } from './config.js';

function foeMesh(rng, boss) {
  const g = new THREE.Group();
  const scale = boss ? 1.18 : 1;
  const coat = new THREE.MeshStandardMaterial({ color: boss ? 0x3b0f0f : 0x5a1f1f, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.38), coat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.74;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.9 }));
  legL.position.set(-0.16, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  // A gun in the hand.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  gun.position.set(0.35, 1.1, 0.3);
  g.add(body);
  g.add(head);
  g.add(legL);
  g.add(legR);
  g.add(gun);
  g.scale.setScalar(scale);
  g.userData.legs = [legL, legR];
  g.userData.isEnemy = true;
  // Health bar: a sprite that always faces the camera.
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: boss ? 0xff2233 : 0xff5533 }));
  bar.scale.set(1.1, 0.12, 1);
  bar.position.y = 2.15;
  g.add(bar);
  g.userData.bar = bar;
  return g;
}

export class Combat {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.weapons = CFG.weapons;
    this.weaponIdx = 1; // pistol
    this.ammo = this.weapons.map((w) => (w.mag === Infinity ? Infinity : w.mag));
    this.cooldown = 0;
    this.reloadT = 0;
    this.enemies = [];
    this.boss = null;
    this.bossDown = false;
    this.raycaster = new THREE.Raycaster();
    this.flash = new THREE.PointLight(0xffc861, 0, 18, 2);
    this.scene.add(this.flash);
    // Tracer line, reused for every shot.
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    this.tracer.frustumCulled = false;
    this.scene.add(this.tracer);
    this.tracerLife = 0;
  }

  get weapon() {
    return this.weapons[this.weaponIdx];
  }

  spawnFoes(n, center) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(7, 18);
      const mesh = foeMesh(this.rng, false);
      const x = center[0] + Math.cos(a) * d;
      const z = center[1] + Math.sin(a) * d;
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const foe = { mesh, health: CFG.tuning.foeHealth, maxHealth: CFG.tuning.foeHealth, shootT: this.rng.range(0.5, 1.5), walkPhase: this.rng.range(0, 6), dead: false, deadT: 0 };
      mesh.userData.enemy = foe;
      this.enemies.push(foe);
    }
  }

  spawnBoss(center) {
    const mesh = foeMesh(this.rng, true);
    mesh.position.set(center[0] + 6, 0, center[1] - 4);
    this.scene.add(mesh);
    this.boss = { mesh, health: CFG.tuning.bossHealth, maxHealth: CFG.tuning.bossHealth, shootT: 1, walkPhase: 0, dead: false, name: 'Dario Flint' };
    mesh.userData.enemy = this.boss;
    this.bossDown = false;
  }

  foesAlive() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  switchWeapon(idx) {
    if (idx < 0 || idx >= this.weapons.length) return;
    this.weaponIdx = idx;
    this.reloadT = 0;
  }

  startReload() {
    const w = this.weapon;
    if (w.mag === Infinity || this.reloadT > 0) return;
    if (this.ammo[this.weaponIdx] === w.mag) return;
    this.reloadT = 0.9;
  }

  /** Fire one shot from the camera through the mouse position. */
  fire(camera, mouse, canvas, player) {
    const w = this.weapon;
    if (this.cooldown > 0 || this.reloadT > 0) return null;
    if (this.ammo[this.weaponIdx] <= 0) {
      this.startReload();
      return null;
    }
    if (w.mag !== Infinity) this.ammo[this.weaponIdx] -= 1;
    this.cooldown = 1 / w.rate;
    const ndcX = (mouse.x / canvas.clientWidth) * 2 - 1;
    const ndcY = -(mouse.y / canvas.clientHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    this.raycaster.far = w.range;
    const targets = [];
    for (const e of this.enemies) if (!e.dead) targets.push(e.mesh);
    if (this.boss && !this.boss.dead) targets.push(this.boss.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    // Muzzle flash at the camera, tracer to the hit (or the far point).
    const from = camera.position.clone();
    from.y -= 0.4;
    let to = this.raycaster.ray.at(w.range, new THREE.Vector3());
    let hitEnemy = null;
    if (hits.length > 0) {
      to = hits[0].point.clone();
      let o = hits[0].object;
      while (o && !o.userData.isEnemy) o = o.parent;
      hitEnemy = o ? o.userData.enemy : null;
    }
    this.flash.position.copy(from);
    this.flash.intensity = 60;
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.tracerLife = 0.07;
    if (hitEnemy) {
      hitEnemy.health -= w.damage;
      hitEnemy.mesh.userData.bar.scale.x = Math.max(0.01, 1.1 * (hitEnemy.health / hitEnemy.maxHealth));
      if (hitEnemy.health <= 0) this._kill(hitEnemy, player);
      return { hit: true, point: to };
    }
    return { hit: false, point: to };
  }

  /** Fists: a short swing at whatever is right in front. */
  melee(player) {
    if (this.cooldown > 0) return;
    this.cooldown = 1 / this.weapon.rate;
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.mesh.position.x - player.x;
      const dz = e.mesh.position.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.6 && (dx * fx + dz * fz) / d > 0.5) {
        e.health -= this.weapon.damage;
        e.mesh.userData.bar.scale.x = Math.max(0.01, 1.1 * (e.health / e.maxHealth));
        if (e.health <= 0) this._kill(e, player);
        return;
      }
    }
    if (this.boss && !this.boss.dead) {
      const dx = this.boss.mesh.position.x - player.x;
      const dz = this.boss.mesh.position.z - player.z;
      if (Math.hypot(dx, dz) < 2.8) {
        this.boss.health -= this.weapon.damage;
        if (this.boss.health <= 0) this._kill(this.boss, player);
      }
    }
  }

  _kill(e, player) {
    e.dead = true;
    e.deadT = 0;
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.3;
    e.mesh.userData.bar.visible = false;
    if (e === this.boss) {
      this.bossDown = true;
      if (player) player.addCash(500);
    } else if (player) {
      player.addCash(this.rng.int(40, 120));
    }
  }

  update(dt, ctx) {
    const { player, input, camera, canvas } = ctx;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo[this.weaponIdx] = this.weapon.mag;
      }
    }
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 500);
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      if (this.tracerLife <= 0) this.tracer.material.opacity = 0;
    }

    // Weapon keys and reload, on foot only.
    if (player.onFoot) {
      for (let i = 0; i < 4; i++) {
        if (input.pressed(`Digit${i + 1}`)) this.switchWeapon(i);
      }
      if (input.pressed('KeyR')) this.startReload();
      const w = this.weapon;
      const wantFire = w.auto ? input.mouse.down : input.clicked();
      if (wantFire) {
        if (w.name === 'Fists') this.melee(player);
        else this.fire(camera, input.mouse, canvas, player);
      }
    }

    // Enemies walk at the player and shoot back.
    const all = [...this.enemies];
    if (this.boss) all.push(this.boss);
    for (const e of all) {
      if (e.dead) {
        e.deadT += dt;
        if (e.deadT > 3) {
          this.scene.remove(e.mesh);
          if (e !== this.boss) this.enemies.splice(this.enemies.indexOf(e), 1);
        }
        continue;
      }
      const dx = player.x - e.mesh.position.x;
      const dz = player.z - e.mesh.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const speed = e === this.boss ? 3.4 : 2.6;
      if (dist > 9) {
        e.mesh.position.x += (dx / dist) * speed * dt;
        e.mesh.position.z += (dz / dist) * speed * dt;
        e.walkPhase += dt * 7;
        const swing = Math.sin(e.walkPhase) * 0.4;
        e.mesh.userData.legs[0].rotation.x = swing;
        e.mesh.userData.legs[1].rotation.x = -swing;
      }
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < 42) {
        e.shootT = e === this.boss ? 0.9 : 1.6;
        // A shot back: a hit is a coin toss weighted by distance.
        const hitChance = Math.max(0.12, 0.55 - dist * 0.01);
        if (this.rng.chance(hitChance)) {
          const dmg = e === this.boss ? 12 : 7;
          if (ctx.onPlayerHit) ctx.onPlayerHit(dmg);
        }
        // Their muzzle flash.
        this.flash.position.set(e.mesh.position.x, 1.4, e.mesh.position.z);
        this.flash.intensity = 30;
      }
    }
  }
}
