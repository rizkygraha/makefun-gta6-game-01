// NEON TIDE — traffic and pedestrians. Civilian cars loop the road graph
// (intersection to intersection, never the way they came); pedestrians walk
// the sidewalks. Both stay near the player: anything far away is moved to
// a road near her, so the city always feels alive around the camera.

import { PEDESTRIANS, TRAFFIC_CARS } from './config.js';
import { resolveCollisions } from './world.js';

const CAR_COLORS = [0x8a94a6, 0x3a4a6b, 0x6b3a3a, 0x2e4a3a, 0x5a5a5a, 0x7a6a3a, 0x39424e];
const SHIRTS = [0x4a6a8a, 0x8a4a4a, 0x4a8a5a, 0x8a7a3a, 0x6a4a8a, 0x9a9a9a, 0x3a7a7a];

export function spawnTraffic(game) {
  const world = game.world;
  const random = game.random;
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const node = world.randomNode();
    game.cars.push({
      id: 'traffic-' + i,
      kind: 'traffic',
      wasTraffic: true,
      x: node.x, z: node.z,
      angle: random() * Math.PI * 2,
      speed: 8 + random() * 6,
      velX: 0, velZ: 0,
      color: CAR_COLORS[i % CAR_COLORS.length],
      condition: 100,
      node: world.nearestNode(node.x, node.z),
      prevNode: -1,
    });
  }
  for (let i = 0; i < PEDESTRIANS; i += 1) {
    const node = world.randomNode();
    game.peds.push({
      id: 'ped-' + i,
      x: node.x + 5, z: node.z + 5,
      angle: random() * Math.PI * 2,
      speed: 1.1 + random() * 0.9,
      shirt: SHIRTS[i % SHIRTS.length],
      pants: 0x1a1d24,
      walkPhase: random() * 6,
      node: world.nearestNode(node.x, node.z),
      prevNode: -1,
    });
  }
}

/** Drive a traffic car toward its target node; pick a new one on arrival. */
function driveTrafficCar(game, car, dt) {
  const world = game.world;
  const target = world.nodes[car.node];
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    const options = world.adjacency[car.node].filter((n) => n !== car.prevNode);
    const next = options.length ? options[Math.floor(game.random() * options.length)] : world.adjacency[car.node][0];
    car.prevNode = car.node;
    car.node = next;
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  // Slow for the player's car ahead.
  let speed = car.speed;
  const pc = game.player.car;
  if (pc && Math.hypot(pc.x - car.x, pc.z - car.z) < 10) speed = Math.min(speed, 3);
  car.x += Math.sin(car.angle) * speed * dt;
  car.z += Math.cos(car.angle) * speed * dt;
  const fixed = resolveCollisions(game.world, car.x, car.z, 1.9);
  car.x = fixed.x;
  car.z = fixed.z;
}

function walkPedestrian(game, ped, dt) {
  const world = game.world;
  const target = world.nodes[ped.node];
  // Walk on the sidewalk: 5 m off the road centre, toward the node.
  const dx = target.x - ped.x;
  const dz = target.z - ped.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 4) {
    const options = world.adjacency[ped.node].filter((n) => n !== ped.prevNode);
    const next = options.length ? options[Math.floor(game.random() * options.length)] : world.adjacency[ped.node][0];
    ped.prevNode = ped.node;
    ped.node = next;
    return;
  }
  const want = Math.atan2(dx, dz);
  ped.angle = want;
  ped.x += Math.sin(want) * ped.speed * dt;
  ped.z += Math.cos(want) * ped.speed * dt;
  ped.walkPhase += dt * ped.speed * 2.4;
}

export function updateTraffic(game, dt) {
  const p = game.player.pos;
  for (const car of game.cars) {
    if (car.kind !== 'traffic') continue;
    driveTrafficCar(game, car, dt);
    // Keep the city alive around the player: teleport far cars nearby.
    if (Math.hypot(car.x - p.x, car.z - p.z) > 260) {
      const node = game.world.nodes[game.world.nearestNode(p.x + (game.random() - 0.5) * 160, p.z + (game.random() - 0.5) * 160)];
      car.x = node.x;
      car.z = node.z;
      car.node = game.world.nearestNode(node.x, node.z);
      car.prevNode = -1;
    }
  }
  for (const ped of game.peds) {
    walkPedestrian(game, ped, dt);
    if (Math.hypot(ped.x - p.x, ped.z - p.z) > 200) {
      const node = game.world.nodes[game.world.nearestNode(p.x + (game.random() - 0.5) * 120, p.z + (game.random() - 0.5) * 120)];
      ped.x = node.x + 5;
      ped.z = node.z + 5;
      ped.node = game.world.nearestNode(node.x, node.z);
      ped.prevNode = -1;
    }
  }
}
