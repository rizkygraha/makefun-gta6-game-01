// NEON TIDE — config.js
// One place for every tuning constant: world layout, movement, weapons, radio,
// districts and palette. Nothing here knows about three.js; it is plain data.

export const CFG = {
  world: {
    half: 220,          // city spans x,z in [-220, 220]
    roadGap: 40,        // distance between parallel road centrelines
    roadWidth: 10,      // drivable asphalt width
    sidewalk: 4,        // sidewalk width each side of a road
    blockInset: 3,      // buildings sit this far inside their block
  },
  // Road centreline coordinates (both axes use the same set).
  roadLines: [-200, -160, -120, -80, -40, 0, 40, 80, 120, 160, 200],

  player: {
    walkSpeed: 6.5,
    sprintSpeed: 11,
    radius: 0.55,
    health: 100,
    enterRange: 4.5,    // how close a car must be to enter it
    collectRange: 3.0,  // tape pickup radius
  },
  car: {
    accel: 16,
    brake: 34,
    reverseMax: 13,
    maxSpeed: 38,       // ~137 km/h
    steerMax: 0.62,     // radians of front-wheel angle
    steerSpeed: 2.4,
    grip: 8.5,          // lateral velocity damping
    handbrakeGrip: 1.6,
    length: 4.4,
    width: 2.0,
  },
  traffic: {
    carCount: 14,
    pedCount: 26,
    carSpeedMin: 7,
    carSpeedMax: 13,
    pedSpeedMin: 1.1,
    pedSpeedMax: 2.2,
  },
  police: {
    unitSpeed: 34,      // a touch slower than the player's top speed
    ramRange: 9,        // inside this, a unit switches to RAMMING
    bustRange: 2.6,     // on foot, caught when a unit stays this close
    bustTime: 3.0,
    decaySeconds: 25,   // one star falls after this long without crime
    names: ['UNIT 7 — ROOK', 'UNIT 12 — HALE', 'UNIT 3 — VOSS', 'UNIT 9 — MARLOWE', 'UNIT 21 — KESTREL'],
    heliName: 'AIR-1 — FALCON',
  },
  weapons: [
    { key: '1', name: 'Fists',   damage: 30, range: 2.8,  mag: Infinity, reserve: Infinity, rate: 2.2, auto: false, spread: 0.0,  tracer: false },
    { key: '2', name: 'Pistol',  damage: 34, range: 70,   mag: 12, reserve: 96,  rate: 4.0, auto: false, spread: 0.012, tracer: true },
    { key: '3', name: 'SMG',     damage: 18, range: 48,   mag: 30, reserve: 180, rate: 10.0, auto: true,  spread: 0.035, tracer: true },
    { key: '4', name: 'Carbine', damage: 46, range: 95,   mag: 20, reserve: 100, rate: 3.0, auto: false, spread: 0.006, tracer: true },
  ],
  radio: [
    { name: 'NEON 104.6',  desc: 'synthwave drive', bpm: 112, wave: 'sawtooth', root: 55.0,  scale: [0, 3, 5, 7, 10, 12] },
    { name: 'TIDE FM 88.1', desc: 'harbour chill',  bpm: 84,  wave: 'triangle', root: 65.41, scale: [0, 2, 4, 7, 9, 12] },
    { name: 'EBB RADIO 97.3', desc: 'night hustle',  bpm: 128, wave: 'square',   root: 49.0,  scale: [0, 3, 5, 6, 10, 12] },
  ],
  districts: [
    { name: 'Neon Row',    cx: 0,    cz: 0,    r: 90,  color: 0xff2ea6, style: 'neon' },
    { name: 'Dockside',    cx: 0,    cz: 170,  r: 80,  color: 0xff9f1c, style: 'dock' },
    { name: 'Old Cannery', cx: -170, cz: 0,    r: 80,  color: 0xc96f2e, style: 'brick' },
    { name: 'The Spire',   cx: 140,  cz: -140, r: 90,  color: 0x35c4ff, style: 'tower' },
    { name: 'Marina',      cx: 170,  cz: 60,   r: 80,  color: 0x2effc4, style: 'marina' },
    { name: 'The Causeway',cx: -140, cz: -160, r: 80,  color: 0xb46bff, style: 'causeway' },
  ],
  tapesTotal: 16,
  palette: {
    sky: 0x070b1d,
    fog: 0x0a1024,
    ground: 0x0d0f16,
    sidewalk: 0x232833,
    buildingA: 0x141824,
    buildingB: 0x1a1420,
    buildingC: 0x101c22,
    neonPink: 0xff2ea6,
    neonCyan: 0x22e6ff,
    neonAmber: 0xffb020,
    neonGreen: 0x2effc4,
    neonPurple: 0xb46bff,
    policeRed: 0xff2233,
    policeBlue: 0x2244ff,
    headlight: 0xfff2c0,
  },
  // Named places the missions and shots stand on. Each is a point on a road.
  spots: {
    spawn: [0, -20],
    safehouse: [40, -40],
    docksideMeet: [0, 180],
    neonDrop: [-40, 40],
    canneryGate: [-160, 0],
    marinaPier: [200, 80],
    spireRoof: [120, -160],
    causewayEnd: [-200, -160],
    raceStart: [0, 120],
    hospital: [-80, 120],
    respray: [80, -40],
    ebbBlock: [0, 40],
  },
};
