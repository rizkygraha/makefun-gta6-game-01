// The screenshot scenes behind ?shot=chase|start|combat|map. Each one plays
// the real rules forward from a fresh game for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { spawnEnemies } from './combat.js';
import { makeCar } from './traffic.js';
import { enterCar } from './player.js';

/** A fake input the autopilot drives: same shape as the real one. */
function fakeInput() {
  const f = {
    fwd: 0, right: 0, sprinting: false, brake: false,
    mouse: { x: 512, y: 320, down: false, clicked: false },
    move() { return { f: f.fwd, r: f.right }; },
    sprint() { return f.sprinting; },
    handbrake() { return f.brake; },
    takeClick() { const c = f.mouse.clicked; f.mouse.clicked = false; return c; },
    takeActions() { return 0; },
  };
  return f;
}

function runSteps(G, stepWorld, input, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) stepWorld(G, input, 0, STEP);
}

/** Put Mara in a car on the Causeway, wanted, police closing in. */
function stageChase(G, stepWorld) {
  const input = fakeInput();
  G.screen = 'play';
  G.cash = 2450;
  G.rep = 130;
  G.mission.jobIndex = 0;
  G.mission.stageIndex = 1;
  G.mission.objective = { x: 60, z: 60, label: 'Deliver the car to the Spire garage' };
  G.mission.dialogue = { who: 'Ilya Kane', text: 'Keys are in the glovebox. Bring it to the Spire garage and we are square. Stay off the main drag.' };
  G.mission.dialogueT = 6;
  // Player car on the east road, heading east.
  const car = makeCar(60, 180, Math.PI / 2, 0xc23b3b, 'traffic');
  car.speed = 18;
  G.cars.push(car);
  G.player.x = car.x;
  G.player.z = car.z;
  enterCar(G, car);
  G.player.car.speed = 20;
  // Three stars of heat, then let the police spawn and close in.
  G.heat = 3 * 34 + 12;
  G.lastCrime = 0;
  G.wanted = 3;
  runSteps(G, stepWorld, input, 1.5);
  // Pull the units in close so the frame shows the chase, not empty road.
  const P = G.player;
  G.policeUnits.forEach((u, i) => {
    const behind = -14 - i * 9;
    u.x = P.x + Math.sin(P.heading) * behind + (i === 1 ? -5 : i === 2 ? 5 : 0);
    u.z = P.z + Math.cos(P.heading) * behind;
    u.heading = P.heading;
    u.speed = 26;
    u.state = i === 0 ? 'RAMMING' : 'PURSUIT';
  });
  if (G.heli) { G.heli.x = P.x + 8; G.heli.z = P.z - 14; }
  // Autopilot: full throttle, steer to stay on the road at z = 180.
  input.fwd = 1;
  for (let i = 0; i < Math.round(6 / STEP); i += 1) {
    const c = G.player.car;
    const headingErr = Math.PI / 2 - c.heading;
    const laneErr = (180 - c.z) * 0.06;
    input.right = Math.max(-1, Math.min(1, headingErr * 2.2 + laneErr));
    stepWorld(G, input, 0, STEP);
  }
  // Pin the frame: exactly 3 stars, three units in view, heli overhead.
  G.heat = 3 * 34 + 10;
  G.wanted = 3;
  while (G.policeUnits.length > 3) {
    const gone = G.policeUnits.pop();
    const idx = G.cars.indexOf(gone);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  G.policeUnits.forEach((u, i) => {
    // Unit 0 runs a roadblock ahead of the player (visible in the frame);
    // the others chase from behind.
    const behind = -13 - (i - 1) * 9;
    const along = i === 0 ? 26 : behind;
    u.x = P.x + Math.sin(P.heading) * along + (i === 1 ? -5 : i === 2 ? 5 : 0);
    u.z = P.z + Math.cos(P.heading) * along;
    u.heading = i === 0 ? P.heading + Math.PI : P.heading;
    u.speed = 26;
    u.dist = Math.hypot(u.x - P.x, u.z - P.z);
    u.state = i === 0 ? 'ROADBLOCK' : i === 1 ? 'RAMMING' : 'PURSUIT';
  });
  if (G.heli) { G.heli.x = P.x + 8; G.heli.z = P.z - 14; }
  G.player.car.speed = 30;
  G.radio.station = 0;
  G.snapCamera = true;
}

function stageStart(G, stepWorld) {
  const input = fakeInput();
  G.screen = 'title';
  // Let the title backdrop breathe: traffic rolls, the camera orbits.
  runSteps(G, stepWorld, input, 6);
}

function stageCombat(G, stepWorld) {
  const input = fakeInput();
  G.screen = 'play';
  G.cash = 3120;
  G.rep = 175;
  G.player.health = 82;
  G.mission.jobIndex = 2;
  G.mission.stageIndex = 1;
  G.mission.kills = 2;
  G.mission.objective = { x: 180, z: 60, label: 'Down Dario\u2019s crew (2/5 down)' };
  G.mission.dialogue = { who: 'Dario Flint', text: 'Five of my best, and you walk through them? Fine. Take the car. I will take it back twice over.' };
  G.mission.dialogueT = 6;
  // Mara on foot in the Marina, next to a stolen car, crew closing in.
  G.player.x = 170;
  G.player.z = 60;
  G.player.heading = Math.PI / 2;
  const stolen = makeCar(166, 66, Math.PI / 2, 0xd8a13b, 'parked');
  G.cars.push(stolen);
  spawnEnemies(G, 182, 60, 5, { boss: false });
  G.heat = 2 * 34 + 8;
  G.lastCrime = 0;
  G.wanted = 2;
  G.weapons.current = 'pistol';
  // One real shot from Mara toward the nearest enemy, then the fight runs.
  runSteps(G, stepWorld, input, 0.6);
  const e = G.enemies.find((en) => en.alive);
  if (e) {
    input.mouse.x = 512 + 40;
    input.mouse.y = 300;
    input.mouse.clicked = true;
    G.fx.muzzle = 1;
    G.fx.muzzleX = G.player.x + 1;
    G.fx.muzzleZ = G.player.z;
    G.fx.tracers.push({ x1: G.player.x, y1: 1.4, z1: G.player.z, x2: e.x, y2: 1.2, z2: e.z, t: 0.12 });
  }
  runSteps(G, stepWorld, input, 1.4);
  // Pin the frame: police closing in at a distance (not parked on Mara),
  // health readable, camera settled.
  const P2 = G.player;
  G.policeUnits.forEach((u, i) => {
    const angle = Math.PI / 2 + (i - 1) * 0.7;
    u.x = P2.x + Math.sin(angle) * (24 + i * 6);
    u.z = P2.z + Math.cos(angle) * (24 + i * 6);
    u.heading = Math.atan2(P2.x - u.x, P2.z - u.z);
    u.speed = 18;
    u.dist = Math.hypot(u.x - P2.x, u.z - P2.z);
    u.state = 'PURSUIT';
  });
  G.player.health = 82;
  G.snapCamera = true;
}

function stageMap(G, stepWorld) {
  const input = fakeInput();
  G.screen = 'map';
  G.cash = 4120;
  G.rep = 210;
  G.mission.jobIndex = 2;
  G.mission.stageIndex = 0;
  G.mission.objective = { x: 180, z: 60, label: 'Reach the Marina meet' };
  G.mission.dialogue = null;
  G.player.x = 60;
  G.player.z = 60;
  G.player.heading = Math.PI;
  G.wanted = 1;
  G.heat = 40;
  // Five tapes already collected.
  G.world.tapes.slice(0, 5).forEach((t) => { t.found = true; });
  G.tapes = 5;
  runSteps(G, stepWorld, input, 0.5);
  G.snapCamera = true;
}

/**
 * Set `G` to the named scene (chase, start, combat or map; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, G, stepWorld) {
  if (name === 'chase') stageChase(G, stepWorld);
  else if (name === 'combat') stageCombat(G, stepWorld);
  else if (name === 'map') stageMap(G, stepWorld);
  else stageStart(G, stepWorld);
  return G.screen;
}
