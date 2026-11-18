// NEON TIDE — combat on foot: weapons, hitscan shooting, enemies.
// The player aims with the mouse (raycast onto the ground in main.js) and
// clicks to fire; SMG fires while held. Enemies close in and shoot back
// with poor aim. Kills during a combat stage count toward the mission.

import { WEAPONS } from './config.js';
import { reportKill } from './missions.js';

let enemyId = 0;

/** Spawn `count` gang enemies around a point, facing the player. When a
 * facing is given, they spawn in an arc in front of it (for screenshots). */
export function spawnEnemies(game, x, z, count, facing = null) {
  for (let i = 0; i < count; i += 1) {
    const a = facing === null ? game.random() * Math.PI * 2 : facing + (game.random() - 0.5) * 1.3;
    const d = facing === null ? 9 + game.random() * 10 : 7 + game.random() * 4;
    game.enemies.push({
      id: 'enemy-' + (enemyId += 1),
      x: x + Math.sin(a) * d,
      z: z + Math.cos(a) * d,
      angle: 0,
      health: 100,
      walkPhase: game.random() * 6,
      shootTimer: 0.8 + game.random(),
      speed: 3.2 + game.random() * 1.2,
    });
  }
}

/** Distance from a point to the segment (ax,az)-(bx,bz), in the ground plane. */
function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

function fireWeapon(game) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.mag[p.weapon] <= 0) return;
  p.mag[p.weapon] -= 1;
  const from = { x: p.pos.x, y: 1.4, z: p.pos.z };
  const to = { x: p.aim.x, y: 1.2, z: p.aim.z };
  game.fx.muzzle = { x: from.x, y: from.y, z: from.z, ttl: 0.07 };
  game.fx.tracers.push({ from, to, ttl: 0.09 });
  game.audio?.shoot?.(w.name);
  game.police.addHeat(3, 'shoot');
  // Hitscan: the nearest enemy close to the firing line takes the damage.
  let best = null;
  let bestD = Infinity;
  for (const en of game.enemies) {
    const dLine = distToSegment(en.x, en.z, from.x, from.z, to.x, to.z);
    const dPlayer = Math.hypot(en.x - p.pos.x, en.z - p.pos.z);
    if (dLine < 1.6 && dPlayer <= w.range && dPlayer < bestD) {
      bestD = dPlayer;
      best = en;
    }
  }
  if (best) {
    const pellets = w.pellets ?? 1;
    best.health -= w.damage * pellets;
    if (best.health <= 0) {
      game.enemies = game.enemies.filter((e) => e !== best);
      reportKill(game);
      game.cash += 25;
    }
  }
}

export function reloadWeapon(game) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (!Number.isFinite(w.mag) || p.mag[p.weapon] >= w.mag) return;
  const need = w.mag - p.mag[p.weapon];
  const take = Math.min(need, p.ammo[p.weapon]);
  if (take <= 0) return;
  p.ammo[p.weapon] -= take;
  p.mag[p.weapon] += take;
  game.audio?.reload?.();
}

function updateEnemies(game, dt) {
  const p = game.player;
  for (const en of [...game.enemies]) {
    const dx = p.pos.x - en.x;
    const dz = p.pos.z - en.z;
    const dist = Math.hypot(dx, dz);
    en.angle = Math.atan2(dx, dz);
    if (dist > 14) {
      en.x += Math.sin(en.angle) * en.speed * dt;
      en.z += Math.cos(en.angle) * en.speed * dt;
      en.walkPhase += dt * en.speed * 2.2;
    }
    en.shootTimer -= dt;
    if (en.shootTimer <= 0 && dist < 34) {
      en.shootTimer = 1.1 + game.random() * 0.9;
      game.fx.tracers.push({
        from: { x: en.x, y: 1.4, z: en.z },
        to: { x: p.pos.x + (game.random() - 0.5) * 3, y: 1.2, z: p.pos.z + (game.random() - 0.5) * 3 },
        ttl: 0.09,
      });
      game.audio?.enemyShot?.();
      // Poor aim: about one shot in five lands.
      if (game.random() < 0.18) {
        p.health = Math.max(0, p.health - 4 - game.random() * 3);
        game.hudMessage = { text: 'HIT — health ' + Math.round(p.health), ttl: 1 };
      }
    }
  }
}

export function updateCombat(game, input, dt) {
  const p = game.player;
  if (p.inCar) return;
  const w = WEAPONS[p.weapon];
  p.fireTimer = (p.fireTimer ?? 0) - dt;
  const wantFire = w.auto ? input.mouseHeld() : input.takeClick();
  if (wantFire && p.fireTimer <= 0 && p.mag[p.weapon] > 0) {
    fireWeapon(game);
    p.fireTimer = 1 / w.rate;
  }
  // Fists: a close enemy takes damage without ammo.
  if (p.weapon === 0 && wantFire && p.fireTimer <= 0) {
    for (const en of [...game.enemies]) {
      if (Math.hypot(en.x - p.pos.x, en.z - p.pos.z) < w.range) {
        en.health -= w.damage;
        if (en.health <= 0) {
          game.enemies = game.enemies.filter((e) => e !== en);
          reportKill(game);
        }
        break;
      }
    }
    p.fireTimer = 1 / w.rate;
  }
  updateEnemies(game, dt);
  if (p.health <= 0) {
    game.screen = 'over';
    game.audio?.gameOver?.();
  }
}
