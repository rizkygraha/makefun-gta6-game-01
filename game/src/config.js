// config.js — NEON TIDE constants: city layout, districts, jobs, weapons,
// radio stations, police call-signs and driving tuning. Pure data, no code
// that runs the game; every system reads from here so tuning lives in one place.

export const CFG = {
  seed: 20261119,

  // The city is a grid of square blocks. Roads run every `roadEvery` units
  // along x and z; the drivable road surface is `roadWidth` wide.
  city: {
    half: 450,
    roadEvery: 90,
    roadWidth: 14,
    block: 76,
    waterZ: 470, // south edge: the harbor water starts here
    causewayX: 0, // the bridge leaves the city at this x, heading south
    causewayEndZ: 640,
  },

  // Six districts, each a rectangle with its own building heights and neon hue.
  // Order matters: districtAt() returns the first rectangle containing a point.
  districts: [
    { name: 'The Spire', x0: -450, z0: -450, x1: 450, z1: -150, hMin: 55, hMax: 120, hue: 0x7dd3fc, sign: 'SPIRE' },
    { name: 'Old Cannery', x0: -450, z0: -150, x1: -150, z1: 150, hMin: 9, hMax: 22, hue: 0xffb020, sign: 'CANNERY' },
    { name: 'Neon Row', x0: -150, z0: -150, x1: 150, z1: 150, hMin: 24, hMax: 58, hue: 0xff2d78, sign: 'NEON ROW' },
    { name: 'Marina', x0: 150, z0: -150, x1: 450, z1: 150, hMin: 12, hMax: 30, hue: 0x39ff88, sign: 'MARINA' },
    { name: 'Dockside', x0: -450, z0: 150, x1: 450, z1: 450, hMin: 10, hMax: 26, hue: 0x22d3ee, sign: 'DOCKSIDE' },
  ],

  // The six story jobs. `stages` are objective steps; each stage has a short
  // objective line and a target point (or null for timed / combat stages).
  jobs: [
    {
      id: 1, name: 'LOW WATER', payout: 1200, giver: 'Ilya Kane',
      intro: 'Mara. You are back. Good. A package waits at Pier 9 — bring it to Neon Row, no questions.',
      stages: [
        { objective: 'Drive to Pier 9, Dockside', target: [0, 380], kind: 'drive' },
        { objective: 'Pick up the package', target: [0, 380], kind: 'interact' },
        { objective: 'Deliver the package to Neon Row', target: [-45, 45], kind: 'drive' },
        { objective: 'Lose the tail', target: null, kind: 'escape' },
      ],
    },
    {
      id: 2, name: 'COLD CARGO', payout: 2800, giver: 'Pip',
      intro: 'There is a car in the Cannery with a cold engine and a warm trunk. Take it. The Ebb will notice.',
      stages: [
        { objective: 'Steal the marked car in Old Cannery', target: [-225, -45], kind: 'steal' },
        { objective: 'Drive the cargo to the Cannery yard', target: [-315, 135], kind: 'drive' },
        { objective: 'Clear the yard — the Ebb is waiting', target: [-315, 135], kind: 'combat', foes: 3 },
        { objective: 'Drop the cargo and walk away', target: [-315, 135], kind: 'interact' },
      ],
    },
    {
      id: 3, name: 'RISING TIDE', payout: 3600, giver: 'Ilya Kane',
      intro: 'Dario thinks he owns the streets. Beat his time through three checkpoints and the streets are yours.',
      stages: [
        { objective: 'Checkpoint 1/3 — Marina gate', target: [225, -225], kind: 'drive', timed: 45 },
        { objective: 'Checkpoint 2/3 — Cannery bend', target: [-225, 225], kind: 'drive', timed: 45 },
        { objective: 'Checkpoint 3/3 — Spire approach', target: [45, -315], kind: 'drive', timed: 45 },
        { objective: 'Lose the heat', target: null, kind: 'escape' },
      ],
    },
    {
      id: 4, name: 'BLUE LIGHTS', payout: 4500, giver: 'Ilya Kane',
      intro: 'Hale turned the whole precinct loose on Neon Row. Clear the block, then get out before the helicopter finds you.',
      stages: [
        { objective: 'Get to the getaway car', target: [45, -45], kind: 'steal' },
        { objective: 'Reach the safehouse, Dockside', target: [-135, 225], kind: 'drive' },
        { objective: 'Clear the block in Neon Row', target: [45, -45], kind: 'combat', foes: 5 },
      ],
    },
    {
      id: 5, name: 'HARBOR LIGHTS', payout: 6000, giver: 'Pip',
      intro: 'The Marina terminal logs every container. Stand in the yard, let my hack run, then take the truck south.',
      stages: [
        { objective: 'Reach the Marina terminal', target: [315, 45], kind: 'drive' },
        { objective: 'Hold the yard while the hack runs', target: [315, 45], kind: 'hold', holdSec: 10 },
        { objective: 'Take the truck to the Causeway', target: [0, 540], kind: 'drive' },
      ],
    },
    {
      id: 6, name: 'LAST TIDE', payout: 8000, giver: 'Ilya Kane',
      intro: 'Dario is at the Spire with everything he has. End this, Mara. Then drive until the city is behind you.',
      stages: [
        { objective: 'Reach the Spire plaza', target: [135, -315], kind: 'drive' },
        { objective: 'Face Dario Flint', target: [135, -315], kind: 'boss' },
        { objective: 'Escape across the Causeway', target: [0, 540], kind: 'drive' },
      ],
    },
  ],

  weapons: [
    { name: 'Fists', key: '1', damage: 12, rate: 2.0, mag: Infinity, range: 2.4, auto: false },
    { name: 'Pistol', key: '2', damage: 26, rate: 3.0, mag: 12, range: 60, auto: false },
    { name: 'SMG', key: '3', damage: 15, rate: 9.0, mag: 30, range: 45, auto: true },
    { name: 'Carbine', key: '4', damage: 22, rate: 5.0, mag: 24, range: 80, auto: true },
  ],

  radio: [
    { name: 'NEON FM', desc: 'synthwave', bpm: 112, wave: 'sawtooth', bass: [55, 55, 65.4, 49], lead: [220, 261.6, 329.6, 392] },
    { name: 'TIDE 101', desc: 'lo-fi', bpm: 84, wave: 'triangle', bass: [65.4, 58.3, 49, 55], lead: [196, 220, 246.9, 196] },
    { name: 'STATIC', desc: 'night talk', bpm: 96, wave: 'square', bass: [49, 49, 55, 43.7], lead: [174.6, 220, 174.6, 261.6] },
  ],

  policeNames: ['Unit 7 — Kestrel', 'Unit 12 — Brine', 'Unit 4 — Gull', 'Unit 21 — Anchor', 'Unit 9 — Tempest', 'Unit 3 — Kite'],
  heliNames: ['Heli 1 — Nighthawk', 'Heli 2 — Stormcrow'],

  tuning: {
    walkSpeed: 4.4,
    sprintSpeed: 7.2,
    carAccel: 16,
    carReverse: 10,
    carBrake: 26,
    carMaxSpeed: 34,
    carSteer: 0.55,
    carGrip: 6.0,
    handbrakeGrip: 1.1,
    trafficSpeed: 9,
    pedSpeed: 1.6,
    wantedDecay: 0.12, // heat lost per second while unseen and quiet
    resprayCost: 200,
    tapeCount: 16,
    playerHealth: 100,
    foeHealth: 60,
    bossHealth: 220,
  },

  colors: {
    sky: 0x05070f,
    fog: 0x0a0f1e,
    asphalt: 0x0d0f14,
    sidewalk: 0x171a21,
    water: 0x06222e,
    neonPink: 0xff2d78,
    neonCyan: 0x22d3ee,
    neonAmber: 0xffb020,
    neonGreen: 0x39ff88,
    policeBlue: 0x2244ff,
    policeRed: 0xff2233,
  },

  // Collectible "Tide Tapes": glowing cassettes hidden around the city.
  tapeSpots: [
    [-405, -405], [-225, -315], [-45, -405], [135, -315], [315, -405], [405, -225],
    [-405, -135], [-315, 45], [45, -225], [225, -135], [405, -45], [-135, 135],
    [45, 225], [225, 135], [405, 225], [-315, 315],
  ],

  // Street race start, safehouse, respray garage and hospital.
  raceStart: [135, 135],
  safehouse: [-135, 225],
  respray: [225, 315],
  hospital: [-225, -225],
};

/** The district containing point (x, z), or null outside the city. */
export function districtAt(x, z) {
  for (const d of CFG.districts) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return null;
}

/** The nearest road coordinate (avenue or street line) to a value. */
export function nearestRoad(v) {
  const { roadEvery } = CFG.city;
  return Math.round(v / roadEvery) * roadEvery;
}
