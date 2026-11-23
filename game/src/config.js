// NEON TIDE — every tuning number, name and story beat in one place.
// Tidewater is a rain-soaked neon harbour city at night. Original names only.
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-tide.save.v1';

export const CITY = {
  half: 240, // city spans -240..240 on x and z
  roadGap: 60, // roads every 60 units
  roadHalf: 7, // half-width of a road
};

export const DISTRICTS = [
  { id: 'neon', name: 'Neon Row', cx: -150, cz: -150, color: '#ff2e88', tall: false },
  { id: 'dock', name: 'Dockside', cx: -150, cz: 150, color: '#ff9f1c', tall: false },
  { id: 'cannery', name: 'Old Cannery', cx: 30, cz: -150, color: '#8a6d4b', tall: false },
  { id: 'spire', name: 'The Spire', cx: 30, cz: 30, color: '#2ec5ff', tall: true },
  { id: 'marina', name: 'Marina', cx: 180, cz: 30, color: '#37e0a0', tall: false },
  { id: 'causeway', name: 'The Causeway', cx: 90, cz: 180, color: '#b967ff', tall: false },
];

export const CREW = {
  mara: 'Mara Voss',
  ilya: 'Ilya Kane',
  pip: 'Pip',
  dario: 'Dario Flint',
  hale: 'Commissioner Hale',
};

export const POLICE_NAMES = [
  'UNIT 7 — SGT. OKAFOR',
  'UNIT 12 — OFF. REYES',
  'UNIT 3 — DET. MARLOWE',
  'UNIT 21 — OFF. CHEN',
  'UNIT 9 — SGT. IBARRA',
  'UNIT 5 — OFF. KOVAC',
];
export const HELI_NAME = "AIR-1 — 'NIGHTHAWK'";

// Six jobs. Each has three stages. Stage kinds:
// goto (reach the marker), talk (reach + press E), fight (down N Ebb crew),
// escape (reach the marker while wanted), deliver (reach to get paid).
export const JOBS = [
  {
    id: 1, name: 'LOW WATER', payout: 1200,
    brief: 'Back in Tidewater after three years. Ilya has a quiet first job.',
    stages: [
      { kind: 'goto', x: -180, z: -180, label: 'Meet Ilya in Neon Row', dialog: { who: 'Ilya Kane', text: 'Mara. Three years, and you still park like a tourist. The job is simple: lift the courier car, no noise.' } },
      { kind: 'talk', x: -180, z: -180, label: 'Talk to Ilya (E)', dialog: { who: 'Ilya Kane', text: 'Keys are in the glovebox. Bring it to the Spire garage and we are square. Stay off the main drag.' } },
      { kind: 'deliver', x: 60, z: 60, label: 'Deliver the car to the Spire garage', dialog: { who: 'Pip', text: 'Garage door is open. Nice and clean, Mara. First run in three years and you did not even scratch it.' } },
    ],
  },
  {
    id: 2, name: 'COLD CARGO', payout: 2800,
    brief: 'The Ebb are moving crates through Dockside. Take the shipment.',
    stages: [
      { kind: 'goto', x: -180, z: 120, label: 'Reach the Dockside warehouse', dialog: { who: 'Ilya Kane', text: 'The Ebb run this pier. The crates are marked with a blue tide-line. Get in, get them, get out.' } },
      { kind: 'fight', x: -180, z: 120, label: 'Clear the Ebb crew (0/4 down)', count: 4, dialog: { who: 'Ebb Lookout', text: 'Hey! That one is not ours! Get her!' } },
      { kind: 'deliver', x: -60, z: -60, label: 'Drop the cargo at the Old Cannery', dialog: { who: 'Pip', text: 'Cargo scanned, clean. Hale will be furious. That is the point.' } },
    ],
  },
  {
    id: 3, name: 'RISING TIDE', payout: 3600,
    brief: 'Dario Flint is showing off at the Marina. Take his prize car.',
    stages: [
      { kind: 'goto', x: 180, z: 60, label: 'Reach the Marina meet', dialog: { who: 'Dario Flint', text: 'Well, well. The ghost of Tidewater. You want my car, Mara? Come and take it from my boys.' } },
      { kind: 'fight', x: 180, z: 60, label: 'Down Dario\u2019s crew (0/5 down)', count: 5, dialog: { who: 'Dario Flint', text: 'Five of my best, and you walk through them? Fine. Take the car. I will take it back twice over.' } },
      { kind: 'deliver', x: 120, z: -120, label: 'Stash the prize car uptown', dialog: { who: 'Ilya Kane', text: 'A Flint car, in our garage. That hurts him more than the money. Good work.' } },
    ],
  },
  {
    id: 4, name: 'BLUE LIGHTS', payout: 4500,
    brief: 'Hale put a price on you. Lose the heat, then make the drop.',
    stages: [
      { kind: 'goto', x: 0, z: 60, label: 'Reach the Spire dead drop', dialog: { who: 'Pip', text: 'Hale has every unit looking for you. Grab the package and do NOT stop for anyone.' } },
      { kind: 'escape', x: 240, z: 0, label: 'Lose the heat — reach the east gate (stay wanted)', dialog: { who: 'Commissioner Hale', text: 'All units, Voss is in the Spire. I want her in cuffs before the tide turns.' } },
      { kind: 'deliver', x: -180, z: -180, label: 'Drop the package in Neon Row', dialog: { who: 'Ilya Kane', text: 'You outran half the department. The package is safe. Hale is going to lose sleep over you.' } },
    ],
  },
  {
    id: 5, name: 'HARBOR LIGHTS', payout: 6000,
    brief: 'The Ebb light the harbour on fire every night. End the arson run.',
    stages: [
      { kind: 'goto', x: 120, z: 180, label: 'Reach the Causeway fuel depot', dialog: { who: 'Pip', text: 'The Ebb are torching fuel drums on the Causeway. If that fire reaches the marina tanks, half the city goes up.' } },
      { kind: 'fight', x: 120, z: 180, label: 'Stop the arson crew (0/6 down)', count: 6, boss: true, dialog: { who: 'Dario Flint', text: 'Hale pays me to burn it, Mara. You really want to stand in front of that fire?' } },
      { kind: 'deliver', x: -120, z: 180, label: 'Escort the fire crew out at Dockside', dialog: { who: 'Ilya Kane', text: 'Fire is out, crew is safe. The harbour owes you one, Mara.' } },
    ],
  },
  {
    id: 6, name: 'LAST TIDE', payout: 8000,
    brief: 'Hale himself is waiting at the Spire. Finish this tonight.',
    stages: [
      { kind: 'goto', x: 60, z: 0, label: 'Confront Hale at the Spire', dialog: { who: 'Commissioner Hale', text: 'Voss. Three years I waited for you to come home. This city is mine — the tide, the docks, all of it.' } },
      { kind: 'fight', x: 60, z: 0, label: 'Break Hale\u2019s squad (0/8 down)', count: 8, boss: true, dialog: { who: 'Commissioner Hale', text: 'Take her down! Nobody walks out of my city!' } },
      { kind: 'deliver', x: -180, z: 180, label: 'Meet Ilya at the Marina safehouse', dialog: { who: 'Ilya Kane', text: 'It is over, Mara. Hale is finished, the Ebb are scattered. Tidewater is yours again — welcome home.' } },
    ],
  },
];

export const WEAPONS = {
  fists: { name: 'Fists', slot: 1, damage: 22, range: 2.6, mag: Infinity, auto: false, rate: 0.45, spread: 0, pellets: 1, kick: 0 },
  pistol: { name: 'Pistol', slot: 2, damage: 26, range: 55, mag: 12, auto: false, rate: 0.28, spread: 0.02, pellets: 1, kick: 0.6 },
  smg: { name: 'SMG', slot: 3, damage: 13, range: 45, mag: 30, auto: true, rate: 0.09, spread: 0.05, pellets: 1, kick: 0.35 },
  shotgun: { name: 'Shotgun', slot: 4, damage: 9, range: 26, mag: 6, auto: false, rate: 0.8, spread: 0.09, pellets: 6, kick: 1.6 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export const RADIO_STATIONS = [
  { name: 'TIDE FM 88.1', desc: 'Neon Waves — synth', wave: 'sawtooth', bpm: 104, root: 45 },
  { name: 'HARBOUR JAZZ 94.6', desc: 'Late-night brass', wave: 'triangle', bpm: 76, root: 41 },
  { name: 'STATIC TALK 101.3', desc: 'The Tide Report', wave: 'square', bpm: 60, root: 38 },
];

export const PLAYER_TUNING = {
  walkSpeed: 6.2, sprintSpeed: 10.5, accel: 40, radius: 0.7,
  carAccel: 26, carBrake: 34, carMaxSpeed: 40, carReverseMax: 14,
  carSteer: 1.9, carGrip: 6.5, handbrakeGrip: 1.6,
};

export const WANTED = {
  maxStars: 5, heatPerStar: 34, decayPerSec: 1.1, stealHeat: 22,
  shootHeat: 12, killHeat: 16, speedHeat: 0.4,
};

export const PALETTE = {
  sky: '#070a18', fog: '#0a0e22', ground: '#101223', road: '#1b1e30',
  neonPink: '#ff2e88', neonCyan: '#2ec5ff', neonYellow: '#ffd23f',
  neonGreen: '#37e0a0', text: '#e8ecf7', muted: '#9aa3bd',
  panel: 'rgba(8, 11, 26, 0.82)', panelBorder: 'rgba(46, 197, 255, 0.35)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TAPES_TOTAL = 16;
export const REP_PER_JOB = [60, 90, 110, 130, 160, 200];
