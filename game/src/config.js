// NEON TIDE — every tuning number, name and story datum in one place.
// The city is a grid: BLOCK metres of buildings, ROAD metres of street,
// GRID blocks a side, centred on the origin. Roads run along both axes at
// every grid line, so traffic can loop the whole city.

export const STEP = 1 / 60;
export const BLOCK = 36;
export const ROAD = 12;
export const GRID = 8;
export const PITCH = BLOCK + ROAD; // 48
export const CITY = GRID * BLOCK + (GRID + 1) * ROAD; // 396
export const HALF = CITY / 2; // 198

/** Road centre lines, one per grid line, from -192 to 192. */
export const ROAD_LINES = [];
for (let i = 0; i <= GRID; i += 1) ROAD_LINES.push(-HALF + ROAD / 2 + i * PITCH);
/** Block centres, from -168 to 168. */
export const BLOCK_LINES = [];
for (let i = 0; i < GRID; i += 1) BLOCK_LINES.push(-HALF + ROAD + BLOCK / 2 + i * PITCH);

export const PALETTE = {
  sky: 0x05070f,
  fog: 0x0a1020,
  asphalt: 0x14161d,
  sidewalk: 0x1d212b,
  curb: 0x2a2f3d,
  building: 0x232838,
  buildingDark: 0x181c28,
  windowWarm: 0xffd28a,
  windowCool: 0x9fd8ff,
  neonCyan: 0x22e6ff,
  neonMagenta: 0xff2e88,
  neonAmber: 0xffb020,
  neonGreen: 0x3dff8e,
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#ff4d5e',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Districts, looked up by (x, z). Each has a name, a colour and a short line. */
export function districtAt(x, z) {
  if (x >= 96 && z >= 48) return { name: 'MARINA', color: '#3dff8e' };
  if (x >= 96) return { name: 'THE CAUSEWAY', color: '#22e6ff' };
  if (x < -96 && z < -48) return { name: 'DOCKSIDE', color: '#ffb020' };
  if (z < -96) return { name: 'THE SPIRE', color: '#b78cff' };
  if (z >= 48 && x < 96) return { name: 'OLD CANNERY', color: '#ff9a5c' };
  return { name: 'NEON ROW', color: '#ff2e88' };
}

export const DISTRICTS = [
  { name: 'NEON ROW', cx: 0, cz: 0 },
  { name: 'DOCKSIDE', cx: -144, cz: -120 },
  { name: 'THE SPIRE', cx: 0, cz: -150 },
  { name: 'MARINA', cx: 150, cz: 120 },
  { name: 'THE CAUSEWAY', cx: 168, cz: -24 },
  { name: 'OLD CANNERY', cx: -24, cz: 150 },
];

/** The six story jobs. Stages are plain data; missions.js runs them. */
export const JOBS = [
  {
    id: 1, name: 'LOW WATER', pay: 1200,
    intro: { who: 'ILYA KANE', role: 'FIXER', text: 'Mara. You are back in Tidewater. First job is small: pick up the package at Pier 9 and bring it to the safehouse. No heat, no heroes.' },
    stages: [
      { type: 'goto', text: 'Drive to Pier 9', at: 'pier' },
      { type: 'interact', text: 'Pick up the package  [E]', at: 'pier' },
      { type: 'goto', text: 'Deliver to the safehouse', at: 'safehouse' },
      { type: 'interact', text: 'Drop the package  [E]', at: 'safehouse' },
    ],
  },
  {
    id: 2, name: 'COLD CARGO', pay: 2800,
    intro: { who: 'PIP', role: 'HACKER', text: 'The Ebb moved a truck of cold cargo through Dockside. It is parked, unguarded, and it is ours if you are fast. Take the truck.' },
    stages: [
      { type: 'goto', text: 'Reach the parked truck', at: 'dockside' },
      { type: 'steal', text: 'Steal the truck  [F]', at: 'dockside' },
      { type: 'goto', text: 'Drive it to the Cannery', at: 'cannery' },
      { type: 'interact', text: 'Hand over the cargo  [E]', at: 'cannery' },
    ],
  },
  {
    id: 3, name: 'RISING TIDE', pay: 3600,
    intro: { who: 'ILYA KANE', role: 'FIXER', text: 'Dario Flint is running his mouth in Neon Row. Remind him who drives this city. Take out his crew, then lose any heat.' },
    stages: [
      { type: 'goto', text: 'Reach Neon Row', at: 'neonrow' },
      { type: 'combat', text: 'Take out the Flint crew', count: 4, at: 'neonrow' },
      { type: 'escape', text: 'Lose the heat', at: 'neonrow' },
    ],
  },
  {
    id: 4, name: 'BLUE LIGHTS', pay: 4500,
    intro: { who: 'COMMISSIONER HALE', role: 'TIDEWATER PD', text: 'Voss. The Ebb owns the Marina and I am tired of it. Clear the docks for me and I will forget your name. For now.' },
    stages: [
      { type: 'goto', text: 'Reach the Marina docks', at: 'marina' },
      { type: 'combat', text: 'Clear the docks', count: 5, at: 'marina' },
      { type: 'goto', text: 'Get to the Spire', at: 'spire' },
      { type: 'interact', text: 'Meet the contact  [E]', at: 'spire' },
    ],
  },
  {
    id: 5, name: 'HARBOR LIGHTS', pay: 6000,
    intro: { who: 'JUNO REYES', role: 'WHEELWOMAN', text: 'Alarms are back! You have got the whole department coming — lose them before my scanner window closes. They can see you. Break line of sight!' },
    stages: [
      { type: 'goto', text: 'Reach the Causeway', at: 'causeway' },
      { type: 'escape', text: 'Lose the cops before the window closes', timed: 150, at: 'causeway' },
      { type: 'goto', text: 'Bring the money home', at: 'safehouse' },
    ],
  },
  {
    id: 6, name: 'LAST TIDE', pay: 8000,
    intro: { who: 'ILYA KANE', role: 'FIXER', text: 'One last job, Mara. The Ebb’s money boat leaves at midnight. Take the boat, take the money, and Tidewater is yours.' },
    stages: [
      { type: 'goto', text: 'Reach the Marina', at: 'marina' },
      { type: 'combat', text: 'Take out the Ebb guards', count: 6, at: 'marina' },
      { type: 'interact', text: 'Take the money boat  [E]', at: 'marina' },
      { type: 'escape', text: 'Lose the heat and get home', at: 'safehouse' },
    ],
  },
];

/** Named police units, dealt out in order as the wanted level grows. */
export const POLICE_UNITS = [
  'TIDE-11', 'SURGE-07', 'RIP-23', 'SWELL-31', 'EBB-19',
  'CURRENT-42', 'BREAK-08', 'UNDERT-15', 'FOAM-26', 'GALE-33',
];
export const HELI_UNIT = 'AIR-1';

/** Radio: three synth stations. Songs are invented; the music is WebAudio. */
export const RADIO = [
  { name: 'TIDE FM 91.7', show: 'Night Drive', track: 'Glass Harbour — Neon Mirage', bpm: 96, mood: 'synth' },
  { name: 'HARBOUR 88.3', show: 'Low Tide', track: 'Salt Static — Slow Current', bpm: 72, mood: 'lofi' },
  { name: 'STATIC 104.1', show: 'Surge', track: 'Breakwater — Full Moon Ferry', bpm: 124, mood: 'bass' },
];

/** The crew, shown on the title screen. */
export const CREW = [
  { name: 'Mara Voss', role: 'GETAWAY DRIVER', color: '#ff2e88' },
  { name: 'Ilya Kane', role: 'FIXER', color: '#22e6ff' },
  { name: 'Pip', role: 'HACKER', color: '#3dff8e' },
  { name: 'Dario Flint', role: 'RIVAL WHEELMAN', color: '#ffb020' },
  { name: 'Juno Reyes', role: 'WHEELWOMAN', color: '#b78cff' },
  { name: 'Commissioner Hale', role: 'TIDEWATER PD', color: '#8b93a3' },
];

export const PLAYER = {
  walkSpeed: 7,
  sprintSpeed: 11,
  radius: 0.9,
  health: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 12,
  maxSpeed: 42, // ~151 km/h
  turn: 1.9,
  grip: 6,
  driftGrip: 2.2,
  radius: 1.9,
  condition: 100,
};

export const WANTED = {
  decayPerSecond: 1.6, // heat points lost while clean
  stealHeat: 22,
  shootHeat: 14,
  killCopHeat: 30,
  maxUnits: 5,
  heliAtStars: 3,
};

export const WEAPONS = [
  { name: 'FISTS', slot: 0, damage: 25, rate: 2.2, range: 2.4, auto: false, ammo: Infinity, mag: Infinity },
  { name: 'PISTOL', slot: 1, damage: 34, rate: 3.5, range: 46, auto: false, ammo: 60, mag: 12 },
  { name: 'SMG', slot: 2, damage: 18, rate: 11, range: 40, auto: true, ammo: 160, mag: 32 },
  { name: 'SHOTGUN', slot: 3, damage: 22, rate: 1.1, range: 26, auto: false, ammo: 24, mag: 6, pellets: 6 },
];

export const TRAFFIC_CARS = 14;
export const PEDESTRIANS = 18;
export const TIDE_TAPES = 16;

/** Where saves live (this browser only). */
export const SAVE_KEY = 'neon-tide.save.v1';

/** Fixed places in the city, by name. */
export const PLACES = {
  // Every place sits ON a road (one coordinate on a road line), never at a
  // block centre: a goto/interact stage completes within 7 m, and a block
  // centre is often inside a building the player cannot enter.
  pier: { x: 168, z: 100, label: 'Pier 9' },
  safehouse: { x: 0, z: -24, label: 'Safehouse' },
  dockside: { x: -144, z: -120, label: 'Dockside' },
  cannery: { x: -24, z: 148, label: 'Old Cannery' },
  neonrow: { x: 0, z: 24, label: 'Neon Row' },
  marina: { x: 150, z: 100, label: 'Marina' },
  spire: { x: 0, z: -150, label: 'The Spire' },
  causeway: { x: 150, z: -24, label: 'The Causeway' },
  respray: { x: 54, z: -72, label: 'Respray' },
  hospital: { x: -54, z: 72, label: 'Hospital' },
};
