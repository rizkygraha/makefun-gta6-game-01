// NEON TIDE — the player: Mara Voss on foot and behind the wheel.
// On foot she moves with WASD, faces the mouse aim point and shoots on
// click. In a car she drives arcade-style (throttle, steering, handbrake
// drift) and F gets her in and out. F near a traffic car steals it.

import { CAR, PLAYER, WEAPONS } from './config.js';
import { resolveCollisions } from './world.js';

export function createPlayer(spawn) {
  return {
    pos: { x: spawn.x, z: spawn.z },
    angle: 0, // facing; forward = (sin(angle), cos(angle)) on the ground
    inCar: false,
    car: null,
    health: PLAYER.health,
    weapon: 1, // pistol
    ammo: WEAPONS.map((w) => w.ammo),
    mag: WEAPONS.map((w) => w.mag),
    walkPhase: 0,
    speed: 0,
    aim: { x: spawn.x, z: spawn.z + 5 },
  };
}

function driveCar(game, car, input, dt) {
  const throttle = input.throttle();
  const steer = input.steer();
  const drifting = input.handbrake();
  // Forward speed along the car's heading.
  const fwdX = Math.sin(car.angle);
  const fwdZ = Math.cos(car.angle);
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * 6 * dt;
  if (Math.abs(car.speed) < 0.15 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  const grip = drifting ? CAR.driftGrip : CAR.grip;
  const turnRate = CAR.turn * (drifting ? 1.7 : 1) * Math.min(1, Math.abs(car.speed) / 8);
  car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);
  // Velocity is mostly forward, with a sideways slide that grip bleeds off.
  car.velX = (car.velX ?? 0) + (fwdX * car.speed - (car.velX ?? 0)) * Math.min(1, grip * dt);
  car.velZ = (car.velZ ?? 0) + (fwdZ * car.speed - (car.velZ ?? 0)) * Math.min(1, grip * dt);
  const nx = car.x + car.velX * dt;
  const nz = car.z + car.velZ * dt;
  const fixed = resolveCollisions(game.world, nx, nz, CAR.radius);
  const hitWall = (fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 10;
  if (hitWall) {
    car.condition = Math.max(0, (car.condition ?? 100) - 2);
    car.speed *= 0.45;
    car.velX *= 0.3;
    car.velZ *= 0.3;
  }
  car.x = fixed.x;
  car.z = fixed.z;
  game.player.pos.x = car.x;
  game.player.pos.z = car.z;
  game.player.angle = car.angle;
  return hitWall;
}

export function updatePlayer(game, input, dt) {
  const p = game.player;
  if (p.inCar && p.car) {
    driveCar(game, p.car, input, dt);
    p.speed = Math.abs(p.car.speed);
    // Collect a Tide Tape by driving over it.
    for (const tape of game.world.tapes) {
      if (!tape.taken && Math.hypot(tape.x - p.pos.x, tape.z - p.pos.z) < 2.5) {
        tape.taken = true;
        game.stats.tapes += 1;
        game.cash += 50;
        game.hudMessage = { text: 'TIDE TAPE  ' + game.stats.tapes + ' / 16   +$50', ttl: 2.5 };
      }
    }
    return;
  }

  // On foot: WASD moves relative to the facing; the mouse aims.
  const fwdX = Math.sin(p.angle);
  const fwdZ = Math.cos(p.angle);
  const rightX = Math.cos(p.angle);
  const rightZ = -Math.sin(p.angle);
  const moveX = fwdX * input.throttle() + rightX * input.steer();
  const moveZ = fwdZ * input.throttle() + rightZ * input.steer();
  const len = Math.hypot(moveX, moveZ);
  const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (len > 0.01) {
    const nx = p.pos.x + (moveX / len) * speed * dt;
    const nz = p.pos.z + (moveZ / len) * speed * dt;
    const fixed = resolveCollisions(game.world, nx, nz, PLAYER.radius);
    p.pos.x = fixed.x;
    p.pos.z = fixed.z;
    p.speed = speed;
    p.walkPhase += dt * speed * 1.6;
  } else {
    p.speed = 0;
  }
  // Face the mouse aim point (raycast onto y=0 happens in main.js).
  const dx = p.aim.x - p.pos.x;
  const dz = p.aim.z - p.pos.z;
  if (Math.hypot(dx, dz) > 0.5) p.angle = Math.atan2(dx, dz);

  // Collect a Tide Tape on foot.
  for (const tape of game.world.tapes) {
    if (!tape.taken && Math.hypot(tape.x - p.pos.x, tape.z - p.pos.z) < 2) {
      tape.taken = true;
      game.stats.tapes += 1;
      game.cash += 50;
      game.hudMessage = { text: 'TIDE TAPE  ' + game.stats.tapes + ' / 16   +$50', ttl: 2.5 };
    }
  }
}

/** F pressed: get in the nearest car, or out of the one being driven. */
export function tryEnterCar(game) {
  const p = game.player;
  if (p.inCar && p.car) {
    if (Math.abs(p.car.speed) > 2) return false;
    p.inCar = false;
    p.pos.x = p.car.x + Math.cos(p.car.angle) * 3;
    p.pos.z = p.car.z - Math.sin(p.car.angle) * 3;
    p.car = null;
    return true;
  }
  let best = null;
  let bestD = 4.5;
  for (const car of game.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - p.pos.x, car.z - p.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return false;
  p.inCar = true;
  p.car = best;
  best.kind = 'player';
  if (best.wasTraffic) {
    best.wasTraffic = false;
    game.police.addHeat(22, 'steal');
    game.hudMessage = { text: 'CAR STOLEN — the law noticed', ttl: 2.5 };
  }
  game.audio?.engineStart?.();
  return true;
}
