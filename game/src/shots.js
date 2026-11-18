// NEON TIDE — the four screenshot scenes behind ?shot=chase|start|combat|map.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// The chase drives a real road with real police behind it; the combat fires
// a real shot; the map is the real map screen.

import { STEP } from './config.js';
import { spawnEnemies } from './combat.js';
import { jumpToStage } from './missions.js';
import { addHeat, spawnUnit } from './police.js';

const CHASE_SECONDS = 5.5;
const COMBAT_SECONDS = 3.5;
const TITLE_SECONDS = 6;

/** A fake input that drives a rectangular loop around the central blocks,
 * steering toward the next waypoint. The chase never leaves the city. */
const CHASE_LOOP = [
  { x: 0, z: 144 },
  { x: -144, z: 144 },
  { x: -144, z: -144 },
  { x: 144, z: -144 },
  { x: 144, z: 144 },
  { x: 0, z: 144 },
];
function chaseInput(game) {
  let wp = 0;
  let cornering = false;
  return {
    throttle: () => (cornering ? 0.35 : 1),
    steer: () => {
      const car = game.player.car;
      if (!car) return 0;
      const target = CHASE_LOOP[wp];
      if (Math.hypot(target.x - car.x, target.z - car.z) < 10) wp = (wp + 1) % CHASE_LOOP.length;
      const want = Math.atan2(target.x - car.x, target.z - car.z);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cornering = Math.abs(diff) > 0.5;
      return Math.max(-1, Math.min(1, diff * 2.2));
    },
    handbrake: () => false,
    sprint: () => false,
    mouse: () => ({ x: 0.5, y: 0.5 }),
    mouseHeld: () => false,
    takeClick: () => false,
    takeActions: () => 0,
    takeWeapon: () => -1,
  };
}

/** A fake input that stands still (used by the combat scene). */
function idleInput() {
  return {
    throttle: () => 0,
    steer: () => 0,
    handbrake: () => false,
    sprint: () => false,
    mouse: () => ({ x: 0.62, y: 0.42 }),
    mouseHeld: () => false,
    takeClick: () => false,
    takeActions: () => 0,
    takeWeapon: () => -1,
  };
}

/**
 * Set `game` to the named scene and return the screen to show. `step` is the
 * game's own fixed-step function (it runs traffic, police, missions, combat).
 */
export function stageShot(name, game, step) {
  const shot = ['chase', 'start', 'combat', 'map'].includes(name) ? name : 'start';

  if (shot === 'start') {
    game.screen = 'title';
    game.clock = 21 * 3600 + 20 * 60; // 21:20, the city already awake
    game.cash = 28400;
    game.day = 3;
    game.hud.setContinue({ jobIndex: 4, cash: 28400, day: 3, savedAt: new Date().toISOString() });
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) step(idleInput(), STEP);
    return 'title';
  }

  if (shot === 'chase') {
    game.screen = 'play';
    game.clock = 18 * 3600 + 52 * 60; // 18:52, dusk rain
    game.cash = 31750;
    game.rep = 4200;
    game.day = 1;
    // Mara in her car on the Neon Row road, heading south down the long
    // straight. Three units wait ahead of her on the same road, facing her:
    // the chase comes at the camera, not from behind it.
    const car = game.playerCar;
    car.x = 0;
    car.z = -144;
    car.angle = 0;
    car.speed = 26;
    car.velX = 0;
    car.velZ = 26;
    game.player.inCar = true;
    game.player.car = car;
    game.player.pos.x = car.x;
    game.player.pos.z = car.z;
    // Three units on her, one of each state, helicopter above.
    addHeat(game, 46);
    spawnUnit(game, { x: 2, z: -100 });
    spawnUnit(game, { x: -3, z: -78 });
    spawnUnit(game, { x: 4, z: -56 });
    game.police.spawnTimer = 2;
    jumpToStage(game, 4, 1, {
      who: 'JUNO REYES', role: 'WHEELWOMAN',
      text: 'Alarms are back! You have got the whole department coming — lose them before my scanner window closes. They can see you. Break line of sight!',
    });
    game.mission.timer = 126;
    const input = chaseInput(game);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) step(input, STEP);
    // Composition: the chase camera looks forward, so pursuers behind the
    // car are invisible. Pose the three units around her for the frame —
    // real units, real states, real distances (the HUD panel reads them):
    // one ramming at her left flank, one pursuing at her right flank, one
    // roadblocking ahead on the road.
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    const rx = Math.cos(car.angle);
    const rz = -Math.sin(car.angle);
    const units = game.police.units;
    if (units[0]) {
      units[0].x = car.x - fx * 1 - rx * 3;
      units[0].z = car.z - fz * 1 - rz * 3;
      units[0].angle = car.angle;
      units[0].speed = car.speed;
      units[0].state = 'RAMMING';
    }
    if (units[1]) {
      units[1].x = car.x - fx * 4 + rx * 5;
      units[1].z = car.z - fz * 4 + rz * 5;
      units[1].angle = car.angle;
      units[1].speed = car.speed;
      units[1].state = 'PURSUIT';
    }
    if (units[2]) {
      units[2].x = car.x + fx * 28;
      units[2].z = car.z + fz * 28;
      units[2].angle = car.angle + Math.PI;
      units[2].speed = 0;
      units[2].state = 'ROADBLOCK';
    }
    // Clear the sim's transient messages: the frozen frame shows the pose.
    game.hudMessage = null;
    return 'play';
  }

  if (shot === 'combat') {
    game.screen = 'play';
    game.clock = 21 * 3600 + 42 * 60; // 21:42, night in Neon Row
    game.cash = 7640;
    game.rep = 2100;
    game.day = 1;
    game.player.inCar = false;
    game.player.car = null;
    game.player.pos.x = 0;
    game.player.pos.z = 32;
    game.player.angle = Math.PI * 0.85;
    game.player.weapon = 2; // SMG
    // The stolen car parked beside her, police closing in behind.
    const car = game.playerCar;
    car.x = 4;
    car.z = 28;
    car.angle = 0.4;
    car.speed = 0;
    car.velX = 0;
    car.velZ = 0;
    car.kind = 'player';
    jumpToStage(game, 2, 1, {
      who: 'DARIO FLINT', role: 'RIVAL WHEELMAN',
      text: 'Voss. You should have stayed gone. Boys — wash her out.',
    });
    spawnEnemies(game, 0, 32, 4, game.player.angle);
    const input = idleInput();
    for (let i = 0; i < COMBAT_SECONDS / STEP; i += 1) step(input, STEP);
    // Fresh fight for the frame: full health, then one shot frozen mid-flight.
    game.player.health = 100;
    const p = game.player;
    const target = game.enemies[0];
    if (target) {
      p.aim.x = target.x;
      p.aim.z = target.z;
      p.angle = Math.atan2(target.x - p.pos.x, target.z - p.pos.z);
      game.fx.muzzle = { x: p.pos.x + Math.sin(p.angle) * 1.2, y: 1.4, z: p.pos.z + Math.cos(p.angle) * 1.2, ttl: 999 };
      game.fx.tracers.push({
        from: { x: p.pos.x, y: 1.4, z: p.pos.z },
        to: { x: target.x, y: 1.2, z: target.z },
        ttl: 999,
      });
    }
    return 'play';
  }

  // map
  game.screen = 'map';
  game.clock = 19 * 3600 + 5 * 60;
  game.cash = 36480;
  game.rep = 4100;
  game.day = 2;
  game.stats.jobsDone = 4;
  game.stats.tapes = 7;
  game.stats.properties = 2;
  game.player.pos.x = 0;
  game.player.pos.z = 24;
  jumpToStage(game, 4, 0, {
    who: 'ILYA KANE', role: 'FIXER',
    text: 'Harbour Lights is the big one, Mara. Five grand on the table and the whole department between you and it.',
  });
  for (let i = 0; i < 2 / STEP; i += 1) step(idleInput(), STEP);
  return 'map';
}
