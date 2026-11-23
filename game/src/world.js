// City generation: districts, the road grid, buildings, neon signs, props and
// collectibles. Pure data — no three.js here — built once from the seeded RNG,
// so the same seed always builds the same Tidewater.
import { CITY, DISTRICTS, TAPES_TOTAL } from './config.js';
import { randInt, randPick, randRange } from './random.js';

const SIGN_TEXTS = [
  { text: 'NEON ROW', color: '#ff2e88' },
  { text: 'TIDE BAR', color: '#2ec5ff' },
  { text: 'HOTEL MERIDIAN', color: '#ffd23f' },
  { text: 'PIER 9', color: '#37e0a0' },
  { text: '24H NOODLES', color: '#ff9f1c' },
  { text: 'CASINO TIDE', color: '#b967ff' },
  { text: 'THE EBB', color: '#ff3355' },
  { text: 'FERRY TERMINAL', color: '#2ec5ff' },
];

const BUILDING_COLORS = ['#232842', '#2c2f4a', '#1f2438', '#33283f', '#26334a', '#3a2f3a', '#24303c', '#2e2a3d'];

export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.cx;
    const dz = z - d.cz;
    const dd = dx * dx + dz * dz;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function roadLines() {
  const lines = [];
  for (let v = -CITY.half; v <= CITY.half; v += CITY.roadGap) lines.push(v);
  return lines;
}

/** Snap a point to the nearest road centre line (used for spawn points). */
export function nearestRoadPoint(x, z) {
  const lines = roadLines();
  let bx = lines[0];
  let bz = lines[0];
  for (const v of lines) {
    if (Math.abs(v - x) < Math.abs(bx - x)) bx = v;
    if (Math.abs(v - z) < Math.abs(bz - z)) bz = v;
  }
  // Choose the axis whose line is closer.
  if (Math.abs(bx - x) <= Math.abs(bz - z)) return { x: bx, z, axis: 'z', heading: 0 };
  return { x, z: bz, axis: 'x', heading: Math.PI / 2 };
}

export function createWorld(rng) {
  const lines = roadLines();
  const buildings = [];
  const signs = [];
  const lamps = [];

  // One block per cell between roads; 1-3 buildings per block.
  for (let ix = 0; ix < lines.length - 1; ix += 1) {
    for (let iz = 0; iz < lines.length - 1; iz += 1) {
      const x0 = lines[ix] + CITY.roadHalf + 4;
      const z0 = lines[iz] + CITY.roadHalf + 4;
      const x1 = lines[ix + 1] - CITY.roadHalf - 4;
      const z1 = lines[iz + 1] - CITY.roadHalf - 4;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const district = districtAt(cx, cz);
      const count = randInt(rng, 1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = randRange(rng, 10, Math.min(20, x1 - x0 - 2));
        const d = randRange(rng, 10, Math.min(20, z1 - z0 - 2));
        const bx = randRange(rng, x0 + w / 2, x1 - w / 2);
        const bz = randRange(rng, z0 + d / 2, z1 - d / 2);
        const h = district.tall
          ? randRange(rng, 34, 92)
          : randRange(rng, 8, district.id === 'dock' ? 20 : 30);
        buildings.push({
          x: bx, z: bz, w, d, h,
          color: randPick(rng, BUILDING_COLORS),
          district: district.id,
          rot: rng() < 0.12 ? Math.PI / 2 : 0,
        });
      }
      // Neon signs on tall / neon-district blocks.
      if ((district.id === 'neon' || district.id === 'spire') && rng() < 0.75) {
        const sign = randPick(rng, SIGN_TEXTS);
        const b = buildings[buildings.length - 1];
        if (b) {
          signs.push({
            x: b.x, z: b.z + b.d / 2 + 0.3, y: Math.min(b.h * 0.75, 26),
            text: sign.text, color: sign.color, w: 14, h: 3.2, face: 'south',
          });
        }
      }
    }
  }

  // Street lamps at road intersections (every other one, to keep the count sane).
  for (let ix = 0; ix < lines.length; ix += 1) {
    for (let iz = 0; iz < lines.length; iz += 1) {
      if ((ix + iz) % 2 === 0) {
        lamps.push({ x: lines[ix] + CITY.roadHalf + 1.2, z: lines[iz] + CITY.roadHalf + 1.2 });
      }
    }
  }

  // Tide Tapes: 16 collectibles on sidewalks near roads.
  const tapes = [];
  for (let i = 0; i < TAPES_TOTAL; i += 1) {
    const x = randPick(rng, lines) + randRange(rng, -CITY.roadHalf - 3, CITY.roadHalf + 3);
    const z = randRange(rng, -CITY.half + 20, CITY.half - 20);
    tapes.push({ x, z, found: false });
  }

  // Player starts on foot in Neon Row, on the road.
  const spawn = nearestRoadPoint(-120, -120);

  return {
    lines, buildings, signs, lamps, tapes,
    spawn: { x: spawn.x, z: spawn.z + 4, heading: Math.PI },
    size: CITY.half * 2,
  };
}

/** Circle-vs-building push-out. Returns true when a collision happened. */
export function collideBuildings(world, x, z, radius) {
  let hit = false;
  for (const b of world.buildings) {
    const hw = b.w / 2 + radius;
    const hd = b.d / 2 + radius;
    const dx = x - b.x;
    const dz = z - b.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const px = hw - Math.abs(dx);
      const pz = hd - Math.abs(dz);
      if (px < pz) x = b.x + (dx > 0 ? hw : -hw);
      else z = b.z + (dz > 0 ? hd : -hd);
      hit = true;
    }
  }
  return { x, z, hit };
}

export function clampToCity(x, z, margin) {
  const lim = CITY.half - margin;
  return {
    x: Math.max(-lim, Math.min(lim, x)),
    z: Math.max(-lim, Math.min(lim, z)),
  };
}
