// NEON TIDE — the city of Tidewater, generated from a seed. This module
// owns the city's DATA: buildings, colliders, neon signs, streetlights,
// collectible spots and the road graph traffic drives on. render.js turns
// this data into three.js meshes; nothing here touches the renderer.

import { BLOCK, BLOCK_LINES, CITY, GRID, HALF, PITCH, PLACES, ROAD, ROAD_LINES, TIDE_TAPES } from './config.js';
import { pick, range } from './random.js';

const SIGN_TEXTS = [
  { text: 'NEON ROW', color: '#ff2e88' },
  { text: 'TIDE FM 91.7', color: '#22e6ff' },
  { text: 'DOCKSIDE', color: '#ffb020' },
  { text: 'HOTEL MARINA', color: '#3dff8e' },
  { text: 'OLD CANNERY', color: '#ff9a5c' },
  { text: 'PIER 9', color: '#22e6ff' },
  { text: 'CLUB SURGE', color: '#ff2e88' },
  { text: 'THE SPIRE', color: '#b78cff' },
  { text: 'HARBOUR', color: '#3dff8e' },
  { text: 'TIDE TAPES', color: '#ffd166' },
  { text: 'CAUSEWAY', color: '#22e6ff' },
  { text: 'NOODLE BAR', color: '#ff9a5c' },
];

/** A point on a road, snapped to the nearest lane centre. */
export function snapToRoad(x, z) {
  const snap = (v) => ROAD_LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  return { x: snap(x), z: snap(z) };
}

/** The nearest road-line coordinate to a value. */
export function nearestRoad(v) {
  return ROAD_LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

/** True when (x, z) is on a road (not inside a block). */
export function isOnRoad(x, z) {
  const inRoad = (v) => ROAD_LINES.some((line) => Math.abs(v - line) <= ROAD / 2 + 0.5);
  return inRoad(x) || inRoad(z);
}

export function createWorld(random) {
  const buildings = [];
  const colliders = [];
  const signs = [];
  const streetlights = [];
  const parks = [];

  // One building per block, sometimes split into two, sometimes a park.
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      const cx = BLOCK_LINES[bx];
      const cz = BLOCK_LINES[bz];
      const roll = random();
      // The Spire district (north rows) gets the towers.
      const tall = cz < -96;
      if (roll < 0.12) {
        parks.push({ x: cx, z: cz, size: BLOCK - 4 });
        continue;
      }
      const split = roll < 0.45;
      const slots = split
        ? [
          { x: cx - BLOCK / 4, z: cz, w: BLOCK / 2 - 3, d: BLOCK - 6 },
          { x: cx + BLOCK / 4, z: cz, w: BLOCK / 2 - 3, d: BLOCK - 6 },
        ]
        : [{ x: cx, z: cz, w: BLOCK - 6, d: BLOCK - 6 }];
      for (const slot of slots) {
        const h = tall ? range(random, 28, 62) : range(random, 8, 30);
        const warm = random() < 0.55;
        buildings.push({
          x: slot.x, z: slot.z, w: slot.w, d: slot.d, h,
          warm, roof: random() < 0.25,
        });
        colliders.push({
          minX: slot.x - slot.w / 2, maxX: slot.x + slot.w / 2,
          minZ: slot.z - slot.d / 2, maxZ: slot.z + slot.d / 2,
        });
      }
    }
  }

  // Neon signs on a dozen buildings, facing a road.
  const signSpots = [];
  for (const b of buildings) {
    if (b.h >= 14 && random() < 0.35) signSpots.push(b);
  }
  for (let i = 0; i < Math.min(SIGN_TEXTS.length, signSpots.length); i += 1) {
    const b = signSpots[i];
    const spec = SIGN_TEXTS[i];
    const face = pick(random, ['north', 'south', 'east', 'west']);
    const y = Math.min(b.h - 3, range(random, 8, 18));
    let x = b.x;
    let z = b.z;
    let ry = 0;
    if (face === 'south') { z = b.z + b.d / 2 + 0.3; ry = 0; }
    if (face === 'north') { z = b.z - b.d / 2 - 0.3; ry = Math.PI; }
    if (face === 'east') { x = b.x + b.w / 2 + 0.3; ry = Math.PI / 2; }
    if (face === 'west') { x = b.x - b.w / 2 - 0.3; ry = -Math.PI / 2; }
    signs.push({ x, y, z, ry, w: Math.min(16, b.w * 0.8), h: 2.6, text: spec.text, color: spec.color });
  }

  // Streetlights at every second intersection.
  for (let ix = 0; ix <= GRID; ix += 2) {
    for (let iz = 0; iz <= GRID; iz += 2) {
      streetlights.push({ x: ROAD_LINES[ix] + ROAD / 2 - 1, z: ROAD_LINES[iz] + ROAD / 2 - 1 });
    }
  }

  // Tide Tapes: 16 collectibles spread over the districts.
  const tapes = [];
  // Tide Tapes: 16 collectibles spread over the districts. Same rule as
  // PLACES: every spot sits on a road, so the 2.5 m pickup radius is
  // always reachable (a block centre is often inside a building).
  const tapeSpots = [
    [168, 100], [-144, -120], [48, 24], [150, 100], [0, -150], [150, -24],
    [-24, 148], [-54, 72], [54, -72], [-150, 24], [24, -150], [120, -102],
    [-120, 102], [54, 72], [-24, -54], [102, 72],
  ];
  for (const [x, z] of tapeSpots) tapes.push({ x, z, taken: false });

  // The road graph: every intersection is a node; edges run along roads.
  const nodes = [];
  const nodeIndex = new Map();
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      nodeIndex.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z });
    }
  }
  const edges = [];
  const cols = ROAD_LINES.length;
  for (let ix = 0; ix < cols; ix += 1) {
    for (let iz = 0; iz < cols; iz += 1) {
      const here = ix * cols + iz;
      if (ix + 1 < cols) edges.push([here, (ix + 1) * cols + iz]);
      if (iz + 1 < cols) edges.push([here, ix * cols + iz + 1]);
    }
  }
  const adjacency = nodes.map(() => []);
  for (const [a, b] of edges) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  return {
    buildings, colliders, signs, streetlights, parks, tapes,
    nodes, adjacency, nodeIndex,
    bounds: { min: -HALF, max: HALF },
    // A random road node, for spawning cars and pedestrians.
    randomNode() {
      return nodes[Math.floor(random() * nodes.length)];
    },
    // The node nearest to a point.
    nearestNode(x, z) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < nodes.length; i += 1) {
        const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    },
    // The place data, as world coordinates.
    places: PLACES,
    citySize: CITY,
  };
}

/**
 * Push a circle (x, z, radius) out of every building collider it overlaps.
 * Returns the corrected position. Used by the player, cars and police.
 */
export function resolveCollisions(world, x, z, radius) {
  let px = x;
  let pz = z;
  for (const c of world.colliders) {
    const cx = Math.max(c.minX, Math.min(px, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        // Inside the box: push out along the smallest penetration axis.
        const pushL = px - c.minX + radius;
        const pushR = c.maxX - px + radius;
        const pushU = pz - c.minZ + radius;
        const pushD = c.maxZ - pz + radius;
        const min = Math.min(pushL, pushR, pushU, pushD);
        if (min === pushL) px = c.minX - radius;
        else if (min === pushR) px = c.maxX + radius;
        else if (min === pushU) pz = c.minZ - radius;
        else pz = c.maxZ + radius;
      } else {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * radius;
        pz = cz + (dz / d) * radius;
      }
    }
  }
  // Keep everything inside the city.
  px = Math.max(-HALF + 2, Math.min(HALF - 2, px));
  pz = Math.max(-HALF + 2, Math.min(HALF - 2, pz));
  return { x: px, z: pz };
}
