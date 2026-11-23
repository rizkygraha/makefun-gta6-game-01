// Civilian traffic and pedestrians. Cars drive the road grid and turn at
// intersections; pedestrians wander the sidewalks. Both stay out of buildings
// because they never leave the roads.
import { CITY } from './config.js';
import { randInt, randPick, randRange } from './random.js';

const CAR_COLORS = [0xc23b3b, 0x3b6ec2, 0xd8a13b, 0x4a9e6a, 0x8a5fc2, 0xc2c2c2, 0x2b2b33, 0xd86a3b];
const PED_COLORS = [0xd8d3c8, 0x6a7fc2, 0xc26a8a, 0x7fc26a, 0xc2a13b, 0x9a8ac2];
const TRAFFIC_CARS = 14;
const PEDS = 18;

let nextId = 1;

export function makeCar(x, z, heading, color, driver) {
  return {
    id: `car-${nextId++}`,
    x, z, heading, speed: 0, color,
    driver: driver || 'traffic', // traffic | player | police | parked
    police: false, name: null, state: null,
    cruise: 11,
    turnAt: null,
  };
}

export function initTraffic(G) {
  const rng = G.rng;
  G.cars = [];
  G.peds = [];
  const lines = G.world.lines;
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = randPick(rng, lines);
    const along = randRange(rng, -CITY.half + 20, CITY.half - 20);
    let heading;
    let x;
    let z;
    if (axis === 'x') {
      // On an east-west road: drive east or west, in the right-hand lane.
      const east = rng() < 0.5;
      heading = east ? Math.PI / 2 : -Math.PI / 2;
      x = along;
      z = line + (east ? 3.5 : -3.5);
    } else {
      // On a north-south road: drive south or north, in the right-hand lane.
      const south = rng() < 0.5;
      heading = south ? 0 : Math.PI;
      x = line + (south ? -3.5 : 3.5);
      z = along;
    }
    const car = makeCar(x, z, heading, randPick(rng, CAR_COLORS), 'traffic');
    car.cruise = randRange(rng, 8, 14);
    car.speed = car.cruise;
    G.cars.push(car);
  }
  for (let i = 0; i < PEDS; i += 1) {
    const line = randPick(rng, lines);
    G.peds.push({
      id: `ped-${nextId++}`,
      x: line + randPick(rng, [-CITY.roadHalf - 2.5, CITY.roadHalf + 2.5]),
      z: randRange(rng, -CITY.half + 20, CITY.half - 20),
      heading: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 1.0, 1.9),
      color: randPick(rng, PED_COLORS),
      wander: randRange(rng, 2, 8),
    });
  }
}

/** The nearest drivable car to a point (traffic or parked), within maxDist. */
export function nearestCar(G, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'police') continue;
    const dx = car.x - x;
    const dz = car.z - z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function nearestLine(lines, v) {
  let best = lines[0];
  for (const l of lines) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
  return best;
}

export function updateTraffic(G, dt) {
  const lines = G.world.lines;
  const P = G.player;
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    // At an intersection, sometimes turn left or right onto the crossing road,
    // snapping into that road's right-hand lane.
    const nx = nearestLine(lines, car.x);
    const nz = nearestLine(lines, car.z);
    const distToCross = Math.hypot(car.x - nx, car.z - nz);
    if (distToCross < 4 && !car.turnAt) {
      car.turnAt = true;
      if (G.rng() < 0.35) {
        car.heading += (G.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        // Right-hand lane of the new road: right = (-cos h, sin h).
        car.x = nx + -Math.cos(car.heading) * 3.5;
        car.z = nz + Math.sin(car.heading) * 3.5;
      }
    }
    if (distToCross > 8) car.turnAt = false;
    // Slow for the car ahead (including the player's car).
    let target = car.cruise;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 11 && side < 3) { target = 0; break; }
    }
    // Slow for the player on foot crossing.
    if (P.onFoot) {
      const dx = P.x - car.x;
      const dz = P.z - car.z;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 9 && side < 3) target = 0;
    }
    car.speed += Math.max(-22 * dt, Math.min(10 * dt, target - car.speed));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Wrap around the city edge so traffic never runs out.
    if (car.x > CITY.half - 4) car.x = -CITY.half + 6;
    if (car.x < -CITY.half + 4) car.x = CITY.half - 6;
    if (car.z > CITY.half - 4) car.z = -CITY.half + 6;
    if (car.z < -CITY.half + 4) car.z = CITY.half - 6;
  }
  for (const ped of G.peds) {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = randRange(G.rng, 2, 9);
      ped.heading += randRange(G.rng, -1.2, 1.2);
    }
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    if (Math.abs(ped.x) > CITY.half - 8 || Math.abs(ped.z) > CITY.half - 8) {
      ped.heading += Math.PI;
      ped.x = Math.max(-CITY.half + 10, Math.min(CITY.half - 10, ped.x));
      ped.z = Math.max(-CITY.half + 10, Math.min(CITY.half - 10, ped.z));
    }
  }
}
