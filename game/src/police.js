// NEON TIDE — the wanted level and the Tidewater PD. Heat rises when Mara
// commits crimes and cools when she stays clean; stars follow heat. Named
// police units spawn at a distance and chase her with a state each —
// PURSUIT, RAMMING or ROADBLOCK — and a helicopter joins at three stars.
// A respray clears the heat, for a price.

import { HELI_UNIT, PLACES, POLICE_UNITS, WANTED } from './config.js';
import { resolveCollisions } from './world.js';

const STAR_AT = [0, 8, 22, 40, 60, 80];

export function createPolice() {
  return {
    heat: 0,
    stars: 0,
    crimeTimer: 0,
    units: [], // the police cars, which also live in game.cars
    heli: { active: false },
    spawnTimer: 0,
    message: null,
  };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let s = 1; s <= 5; s += 1) if (heat >= STAR_AT[s]) stars = s;
  return stars;
}

export function addHeat(game, amount) {
  const police = game.police;
  police.heat = Math.min(100, police.heat + amount);
  police.crimeTimer = 6;
  police.stars = starsForHeat(police.heat);
}

export function spawnUnit(game, at = null) {
  const police = game.police;
  const p = game.player.pos;
  const index = police.units.length;
  const angle = game.random() * Math.PI * 2;
  const dist = 70 + game.random() * 40;
  const x = at ? at.x : p.x + Math.sin(angle) * dist;
  const z = at ? at.z : p.z + Math.cos(angle) * dist;
  const snapped = { x: Math.max(-190, Math.min(190, x)), z: Math.max(-190, Math.min(190, z)) };
  const car = {
    id: 'police-' + POLICE_UNITS[index % POLICE_UNITS.length],
    kind: 'police',
    unitName: POLICE_UNITS[index % POLICE_UNITS.length],
    state: 'PURSUIT',
    x: snapped.x, z: snapped.z,
    angle: Math.atan2(p.x - snapped.x, p.z - snapped.z),
    speed: 0,
    velX: 0, velZ: 0,
    color: 0xe8ecf2, // white patrol car: reads at night
    condition: 100,
    stateTimer: 4 + game.random() * 4,
    target: { x: p.x, z: p.z },
  };
  game.cars.push(car);
  police.units.push(car);
  return car;
}

function driveUnit(game, car, dt) {
  const p = game.player;
  const pCar = p.car;
  const targetX = pCar ? pCar.x : p.pos.x;
  const targetZ = pCar ? pCar.z : p.pos.z;
  car.stateTimer -= dt;
  if (car.stateTimer <= 0) {
    car.stateTimer = 3 + game.random() * 4;
    const dist = Math.hypot(targetX - car.x, targetZ - car.z);
    if (dist < 22) car.state = game.random() < 0.55 ? 'RAMMING' : 'PURSUIT';
    else if (dist > 55 && game.random() < 0.35) car.state = 'ROADBLOCK';
    else car.state = 'PURSUIT';
  }
  // Where this unit wants to go.
  let tx = targetX;
  let tz = targetZ;
  if (car.state === 'RAMMING') {
    tx = targetX + Math.sin(p.angle) * 6;
    tz = targetZ + Math.cos(p.angle) * 6;
  } else if (car.state === 'ROADBLOCK') {
    // Get ahead of the player's path and stop across it.
    const speed = pCar ? Math.abs(pCar.speed) : 0;
    tx = targetX + Math.sin(p.angle) * Math.max(18, speed * 1.2);
    tz = targetZ + Math.cos(p.angle) * Math.max(18, speed * 1.2);
  }
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const wantSpeed = car.state === 'ROADBLOCK' && dist < 8 ? 0 : (car.state === 'RAMMING' ? 24 : 20);
  car.speed += Math.max(-30 * dt, Math.min(24 * dt, wantSpeed - car.speed));
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const fixed = resolveCollisions(game.world, car.x, car.z, 1.9);
  car.x = fixed.x;
  car.z = fixed.z;
  // A ram that connects: shake the player's car and add a little heat.
  // One ram per unit per 1.5 s: without the cooldown a unit sitting on the
  // player's bumper would shred the car in a single second.
  car.ramTimer = (car.ramTimer ?? 0) - dt;
  if (dist < 4.2 && car.speed > 8 && car.ramTimer <= 0) {
    car.ramTimer = 1.5;
    if (pCar) {
      pCar.condition = Math.max(0, pCar.condition - 1);
      pCar.speed *= 0.92;
      game.hudMessage = { text: 'RAMMED BY ' + car.unitName, ttl: 1.2 };
    } else {
      p.health = Math.max(0, p.health - 4);
      game.hudMessage = { text: 'HIT BY ' + car.unitName, ttl: 1.2 };
    }
    car.speed *= 0.4;
  }
  return dist;
}

export function updatePolice(game, dt) {
  const police = game.police;
  police.crimeTimer = Math.max(0, police.crimeTimer - dt);
  // Heat cools when clean; the helicopter halves the cooling.
  if (police.crimeTimer <= 0 && police.heat > 0) {
    police.heat = Math.max(0, police.heat - WANTED.decayPerSecond * (police.heli.active ? 0.5 : 1) * dt);
  }
  police.stars = starsForHeat(police.heat);

  // Spawn units up to the wanted level, one at a time.
  const wanted = Math.min(police.stars, WANTED.maxUnits);
  police.spawnTimer -= dt;
  if (police.units.length < wanted && police.spawnTimer <= 0) {
    spawnUnit(game);
    police.spawnTimer = 1.6;
  }
  // Remove units when the heat drops.
  while (police.units.length > wanted) {
    const car = police.units.pop();
    game.cars = game.cars.filter((c) => c !== car);
  }
  for (const car of police.units) driveUnit(game, car, dt);

  police.heli.active = police.stars >= WANTED.heliAtStars;

  // Respray: drive slowly into the Respray and the heat is gone, for $200.
  const p = game.player;
  if (p.inCar && p.car) {
    const r = PLACES.respray;
    if (Math.hypot(p.car.x - r.x, p.car.z - r.z) < 7 && Math.abs(p.car.speed) < 6 && police.heat > 0) {
      if (game.cash >= 200) {
        game.cash -= 200;
        police.heat = 0;
        police.stars = 0;
        game.hudMessage = { text: 'RESPRAY — HEAT CLEARED  -$200', ttl: 2.5 };
      }
    }
  }
}
