// NEON TIDE — tuning, world layout and named data for the whole game.
// One place for every number the systems share, so a tweak lands everywhere.

export const WORLD = {
  half: 240,
  block: 40,
  roadWidth: 12,
  sidewalk: 3,
  maxBuildingsPerBlock: 4,
};

export const DISTRICTS = [
  { name: 'Neon Row', color: 0xff2d78, accent: '#ff2d78', x0: -40, z0: -80, x1: 80, z1: 40 },
  { name: 'Dockside', color: 0x2de2ff, accent: '#2de2ff', x0: -240, z0: 80, x1: -40, z1: 240 },
  { name: 'Old Cannery', color: 0xff9a2d, accent: '#ff9a2d', x0: -240, z0: -240, x1: -40, z1: -80 },
  { name: 'The Spire', color: 0x8f7bff, accent: '#8f7bff', x0: -40, z0: -240, x1: 80, z1: -80 },
  { name: 'Marina', color: 0x2dff8f, accent: '#2dff8f', x0: 80, z0: 80, x1: 240, z1: 240 },
  { name: 'The Causeway', color: 0xffe62d, accent: '#ffe62d', x0: 80, z0: -240, x1: 240, z1: 80 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[0];
}

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  turnSpeed: 9,
  health: 100,
  carAccel: 16,
  carBrake: 30,
  carReverse: 8,
  carMaxSpeed: 42,
  carMaxReverse: 12,
  carTurn: 1.9,
  carGrip: 6,
};

export const WEAPONS = [
  { name: 'Fists', damage: 12, rate: 2.2, range: 2.4, ammo: Infinity, auto: false, spread: 0 },
  { name: 'Pistol', damage: 34, rate: 3.5, range: 60, ammo: 24, auto: false, spread: 0.012 },
  { name: 'SMG', damage: 16, rate: 11, range: 55, ammo: 90, auto: true, spread: 0.035 },
  { name: 'Carbine', damage: 55, rate: 1.6, range: 90, ammo: 18, auto: false, spread: 0.004 },
];

export const POLICE_UNITS = [
  'UNIT 07 RIPTIDE',
  'UNIT 12 HARBOR',
  'UNIT 03 BREAKWATER',
  'UNIT 21 UNDERTOW',
  'UNIT 09 LOWTIDE',
  'UNIT 18 GULLWING',
  'UNIT 25 SIREN',
  'UNIT 31 EDDY',
];

export const RADIO = [
  { name: 'WAVE 88.1 — TIDE FM', hue: 0 },
  { name: 'NEON 104.6 — NIGHT DRIVE', hue: 1 },
  { name: 'HARBOUR 97.3 — RAIN STATIC', hue: 2 },
];

export const WANTED = {
  decayPerSecond: 0.12,
  steal: 1,
  hitPed: 2,
  shoot: 1,
  kill: 2,
  maxStars: 5,
  heliAt: 3,
  unitsAtStar: [0, 1, 2, 3, 4, 5],
};

export const ECONOMY = {
  startCash: 420,
  tapeTotal: 16,
};

export const COLORS = {
  night: 0x070a18,
  fog: 0x0a0f22,
  road: 0x11131c,
  lane: 0x8a8f4d,
  sidewalk: 0x1c1f2a,
  water: 0x06283a,
  rain: 0x9fb4ff,
  beacon: 0x2de2ff,
  marker: 0xffe62d,
};
