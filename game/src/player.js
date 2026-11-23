// Mara Voss, on foot and behind the wheel. On foot: camera-relative WASD with
// sprint. Driving: arcade car physics — accelerate, steer, handbrake drift —
// with building collision. F enters the nearest car and exits it again; the
// enter/exit lockout stops one press toggling twice in a frame.
import { PLAYER_TUNING as T, WANTED } from './config.js';
import { clampToCity, collideBuildings } from './world.js';
import { nearestCar } from './traffic.js';
import { ACTION_ENTER } from './input.js';

export function initPlayer(G) {
  const s = G.world.spawn;
  G.player = {
    x: s.x, z: s.z, heading: s.heading, speed: 0,
    onFoot: true, car: null, health: 100,
    enterLock: 0, vx: 0, vz: 0,
  };
}

function moveWithCollision(G, x, z, radius) {
  const c = clampToCity(x, z, 2);
  const hit = collideBuildings(G.world, c.x, c.z, radius);
  return { x: hit.x, z: hit.z, hit: hit.hit };
}

export function enterCar(G, car) {
  const P = G.player;
  const wasTraffic = car.driver === 'traffic';
  car.driver = 'player';
  car.speed = 0;
  P.onFoot = false;
  P.car = car;
  P.x = car.x;
  P.z = car.z;
  P.heading = car.heading;
  P.enterLock = 0.35;
  if (wasTraffic) {
    G.police.addHeat(G, WANTED.stealHeat);
    G.addMessage('Car stolen — the law noticed.');
  } else {
    G.addMessage('You climb back in.');
  }
}

export function exitCar(G) {
  const P = G.player;
  const car = P.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  P.onFoot = true;
  P.car = null;
  // Step out to the side of the car.
  const side = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  const out = moveWithCollision(G, car.x + side * 2.4, car.z + sideZ * 2.4, T.radius);
  P.x = out.x;
  P.z = out.z;
  P.heading = car.heading;
  P.speed = 0;
  P.enterLock = 0.35;
}

export function updatePlayer(G, input, actions, dt) {
  const P = G.player;
  if (P.enterLock > 0) P.enterLock -= dt;

  if (actions & ACTION_ENTER && P.enterLock <= 0) {
    if (P.onFoot) {
      const car = nearestCar(G, P.x, P.z, 4.6);
      if (car) enterCar(G, car);
      else G.addMessage('No car close enough — get nearer and press F.');
    } else {
      exitCar(G);
    }
  }

  if (P.onFoot) {
    const mv = input.move();
    const camH = G.camHeading || 0;
    // Camera-relative movement: forward is where the camera looks.
    const fx = Math.sin(camH);
    const fz = Math.cos(camH);
    const rx = Math.cos(camH);
    const rz = -Math.sin(camH);
    let mx = fx * mv.f + rx * mv.r;
    let mz = fz * mv.f + rz * mv.r;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      const targetSpeed = input.sprint() ? T.sprintSpeed : T.walkSpeed;
      P.vx += (mx * targetSpeed - P.vx) * Math.min(1, T.accel * dt / targetSpeed * 8);
      P.vz += (mz * targetSpeed - P.vz) * Math.min(1, T.accel * dt / targetSpeed * 8);
      P.heading = Math.atan2(mx, mz);
    } else {
      P.vx *= Math.max(0, 1 - 12 * dt);
      P.vz *= Math.max(0, 1 - 12 * dt);
    }
    const nx = P.x + P.vx * dt;
    const nz = P.z + P.vz * dt;
    const res = moveWithCollision(G, nx, nz, T.radius);
    // Slide along walls: if blocked, try each axis alone.
    if (res.hit) {
      const rx2 = moveWithCollision(G, nx, P.z, T.radius);
      const rz2 = moveWithCollision(G, P.x, nz, T.radius);
      if (!rx2.hit) { P.x = rx2.x; }
      else if (!rz2.hit) { P.z = rz2.z; }
      P.vx *= 0.4;
      P.vz *= 0.4;
    } else {
      P.x = res.x;
      P.z = res.z;
    }
    P.speed = Math.hypot(P.vx, P.vz);
  } else if (P.car) {
    const car = P.car;
    const mv = input.move();
    const forward = mv.f;
    const steer = mv.r;
    const handbrake = input.handbrake();
    // Accelerate / brake / reverse.
    if (forward > 0) car.speed += T.carAccel * dt;
    else if (forward < 0) {
      if (car.speed > 0.5) car.speed -= T.carBrake * dt;
      else car.speed -= T.carAccel * 0.6 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    }
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 20 * dt);
    car.speed = Math.max(-T.carReverseMax, Math.min(T.carMaxSpeed, car.speed));
    // Steering scales with speed and loosens with the handbrake.
    const grip = handbrake ? T.handbrakeGrip : T.carGrip;
    const steerRate = T.carSteer * Math.min(1, Math.abs(car.speed) / 12) * (handbrake ? 1.7 : 1);
    car.heading += steer * steerRate * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1) * (1 - Math.min(0.6, Math.abs(car.speed) / T.carMaxSpeed * 0.6));
    void grip;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const res = moveWithCollision(G, nx, nz, 1.6);
    if (res.hit) {
      car.speed *= 0.35;
      if (Math.abs(car.speed) > 6) {
        G.audio.sfx('crash');
        G.addMessage('You clipped a building.');
      }
      car.x = res.x;
      car.z = res.z;
    } else {
      car.x = res.x;
      car.z = res.z;
    }
    // Gentle car-vs-car bump: slow down instead of passing through.
    for (const other of G.cars) {
      if (other === car || other.driver === 'player') continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        car.x -= (dx / d) * push;
        car.z -= (dz / d) * push;
        car.speed *= 0.94;
      }
    }
    const c = clampToCity(car.x, car.z, 3);
    car.x = c.x;
    car.z = c.z;
    P.x = car.x;
    P.z = car.z;
    P.heading = car.heading;
    P.speed = Math.abs(car.speed);
    // Speeding past police adds heat.
    if (Math.abs(car.speed) > 26 && G.wanted > 0) G.police.addHeat(G, WANTED.speedHeat * dt);
  }
}
