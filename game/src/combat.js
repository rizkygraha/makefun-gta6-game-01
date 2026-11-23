// Combat: four weapons, hitscan shooting at the mouse aim, enemy AI that
// closes in and shoots back, reloads and muzzle-flash/tracer effects.
import { WEAPONS, WEAPON_ORDER, WANTED } from './config.js';
import { ACTION_RELOAD, ACTION_W1, ACTION_W2, ACTION_W3, ACTION_W4 } from './input.js';
import { clampToCity, collideBuildings } from './world.js';
import { randRange } from './random.js';

let nextEnemyId = 1;

export function initCombat(G) {
  G.weapons = {
    current: 'pistol',
    mag: { pistol: 12, smg: 30, shotgun: 6, fists: Infinity },
    reserve: { pistol: 48, smg: 120, shotgun: 24, fists: Infinity },
    cooldown: 0,
    reloadT: 0,
  };
  G.enemies = [];
  G.fx = { muzzle: 0, muzzleX: 0, muzzleZ: 0, tracers: [], hitMark: 0 };
}

export function spawnEnemies(G, x, z, count, opts) {
  const names = ['EBB CREW', 'EBB CREW', 'EBB LOOKOUT', 'EBB ENFORCER'];
  for (let i = 0; i < count; i += 1) {
    const boss = opts && opts.boss && i === count - 1;
    G.enemies.push({
      id: `enemy-${nextEnemyId++}`,
      x: x + randRange(G.rng, -9, 9),
      z: z + randRange(G.rng, -9, 9),
      heading: randRange(G.rng, 0, Math.PI * 2),
      hp: boss ? 240 : 60,
      maxHp: boss ? 240 : 60,
      alive: true,
      boss,
      name: boss ? (G.mission.jobIndex >= 5 ? 'HALE\u2019S SQUAD LEADER' : 'DARIO FLINT') : names[i % names.length],
      shootT: randRange(G.rng, 0.5, 1.6),
      speed: boss ? 2.6 : randRange(G.rng, 2.2, 3.4),
    });
  }
}

/** Nearest living enemy to a ray; returns {enemy, dist} or null. */
function rayHitEnemy(G, ray, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const ox = e.x - ray.origin.x;
    const oy = 1.2 - ray.origin.y;
    const oz = e.z - ray.origin.z;
    const t = ox * ray.direction.x + oy * ray.direction.y + oz * ray.direction.z;
    if (t < 0 || t > bestD) continue;
    const cx = ray.origin.x + ray.direction.x * t;
    const cy = ray.origin.y + ray.direction.y * t;
    const cz = ray.origin.z + ray.direction.z * t;
    const d = Math.hypot(e.x - cx, 1.2 - cy, e.z - cz);
    if (d < 1.6) { best = e; bestD = t; }
  }
  return best ? { enemy: best, dist: bestD } : null;
}

function fireWeapon(G, input) {
  const w = G.weapons;
  const def = WEAPONS[w.current];
  if (w.cooldown > 0 || w.reloadT > 0) return;
  if (w.current !== 'fists' && w.mag[w.current] <= 0) {
    G.audio.sfx('empty');
    G.addMessage('Magazine empty — press R to reload.');
    w.cooldown = 0.3;
    return;
  }
  w.cooldown = def.rate;
  if (w.current !== 'fists') w.mag[w.current] -= 1;
  const P = G.player;
  G.fx.muzzle = 1;
  G.fx.muzzleX = P.x + Math.sin(P.heading) * 1.2;
  G.fx.muzzleZ = P.z + Math.cos(P.heading) * 1.2;
  G.audio.sfx(w.current === 'fists' ? 'punch' : 'shoot');
  if (w.current !== 'fists') G.police.addHeat(G, WANTED.shootHeat);

  // Fists: a short swing at the nearest enemy.
  if (w.current === 'fists') {
    let best = null;
    let bestD = def.range;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) damageEnemy(G, best, def.damage);
    return;
  }

  // Hitscan: one ray per pellet, with spread.
  const ray = G.renderer.screenRay(input.mouse.x, input.mouse.y);
  for (let p = 0; p < def.pellets; p += 1) {
    const dir = {
      x: ray.direction.x + (G.rng() - 0.5) * def.spread * 2,
      y: ray.direction.y + (G.rng() - 0.5) * def.spread * 2,
      z: ray.direction.z + (G.rng() - 0.5) * def.spread * 2,
    };
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    dir.x /= len; dir.y /= len; dir.z /= len;
    const hit = rayHitEnemy(G, { origin: ray.origin, direction: dir }, def.range);
    const endT = hit ? hit.dist : def.range;
    G.fx.tracers.push({
      x1: ray.origin.x, y1: ray.origin.y, z1: ray.origin.z,
      x2: ray.origin.x + dir.x * endT, y2: ray.origin.y + dir.y * endT, z2: ray.origin.z + dir.z * endT,
      t: 0.09,
    });
    if (hit) damageEnemy(G, hit.enemy, def.damage);
  }
}

function damageEnemy(G, enemy, dmg) {
  enemy.hp -= dmg;
  G.fx.hitMark = 0.25;
  if (enemy.hp <= 0 && enemy.alive) {
    enemy.alive = false;
    G.mission.kills += 1;
    G.police.addHeat(G, WANTED.killHeat);
    G.cash += 25;
    G.addMessage(`${enemy.name} down. +$25`);
    G.audio.sfx('down');
  }
}

export function updateCombat(G, input, actions, dt) {
  const w = G.weapons;
  if (w.cooldown > 0) w.cooldown -= dt;
  if (G.fx.muzzle > 0) G.fx.muzzle = Math.max(0, G.fx.muzzle - dt * 7);
  if (G.fx.hitMark > 0) G.fx.hitMark -= dt;
  for (const t of G.fx.tracers) t.t -= dt;
  G.fx.tracers = G.fx.tracers.filter((t) => t.t > 0);

  // Weapon switching and reload (on foot only; driving has no shooting).
  if (G.player.onFoot) {
    if (actions & ACTION_W1) w.current = 'fists';
    if (actions & ACTION_W2) w.current = 'pistol';
    if (actions & ACTION_W3) w.current = 'smg';
    if (actions & ACTION_W4) w.current = 'shotgun';
    if ((actions & ACTION_RELOAD) && w.reloadT <= 0) {
      const def = WEAPONS[w.current];
      if (w.current !== 'fists' && w.mag[w.current] < def.mag && w.reserve[w.current] > 0) {
        w.reloadT = 1.1;
        G.audio.sfx('reload');
      }
    }
    if (w.reloadT > 0) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) {
        const def = WEAPONS[w.current];
        const need = def.mag - w.mag[w.current];
        const take = Math.min(need, w.reserve[w.current]);
        w.mag[w.current] += take;
        w.reserve[w.current] -= take;
      }
    }
    const def = WEAPONS[w.current];
    const clicked = input.takeClick();
    if ((clicked && !def.auto) || (input.mouse.down && def.auto)) {
      fireWeapon(G, input);
    }
  } else {
    input.takeClick(); // swallow clicks while driving
  }

  // Enemy AI: close in, shoot back.
  const P = G.player;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = P.x - e.x;
    const dz = P.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    e.heading = Math.atan2(dx, dz);
    if (dist > 9) {
      const nx = e.x + Math.sin(e.heading) * e.speed * dt;
      const nz = e.z + Math.cos(e.heading) * e.speed * dt;
      const res = collideBuildings(G.world, nx, nz, 0.6);
      e.x = res.x;
      e.z = res.z;
      const c = clampToCity(e.x, e.z, 2);
      e.x = c.x;
      e.z = c.z;
    }
    e.shootT -= dt;
    if (e.shootT <= 0 && dist < 42 && dist > 2) {
      e.shootT = randRange(G.rng, 1.1, 2.1);
      G.fx.muzzle = 0.8;
      G.fx.muzzleX = e.x;
      G.fx.muzzleZ = e.z;
      G.fx.tracers.push({
        x1: e.x, y1: 1.4, z1: e.z,
        x2: P.x, y2: 1.2, z2: P.z, t: 0.08,
      });
      G.audio.sfx('enemyShoot');
      // Inaccurate at range; closer shots hurt more.
      const hitChance = dist < 14 ? 0.45 : dist < 26 ? 0.28 : 0.14;
      if (G.rng() < hitChance) {
        const dmg = e.boss ? 9 : 5;
        P.health -= dmg;
        G.addMessage(e.boss ? `${e.name} hit you hard!` : 'You took a hit.');
        if (P.health <= 0) {
          P.health = 0;
          G.screen = 'over';
        }
      }
    }
  }
}
