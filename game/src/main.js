// main.js — boots NEON TIDE, runs the fixed-timestep loop and the state
// machine (title / play / pause / map / endcard), and stages screenshots
// when ?shot= is on the URL. Everything the game does goes through here.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { createWorld } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, saveGame, clearSave, defaultSave } from './save.js';
import { stageShot, SHOT_STEPS } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') ?? '', 10) || CFG.seed;
const shotName = params.get('shot');

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const canvas = document.getElementById('game');
const input = new Input(canvas);
input.attach();
const rng = makeRng(seed);
const renderer = new Renderer(canvas);
const world = createWorld(renderer.scene, rng);
const traffic = new Traffic(renderer.scene, world, rng);
const player = new Player(renderer.scene, world, traffic);
const police = new Police(renderer.scene, world, rng);
const missions = new Missions(renderer.scene, world);
const combat = new Combat(renderer.scene, world, rng);
const hud = new Hud();
const audio = new AudioSys();

const G = {
  state: 'title',
  time: 0,
  day: 1,
  properties: 0,
  frozen: false,
  renderer,
  world,
  traffic,
  player,
  police,
  missions,
  combat,
  hud,
  input,
  rng,
};

function clockStr() {
  const totalMin = 21 * 60 + 40 + Math.floor(G.time / 1);
  const day = 1 + Math.floor(totalMin / 1440);
  const mins = totalMin % 1440;
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  G.day = day;
  return `${hh}:${mm}`;
}

function writeSave() {
  const tapesGot = world.tapes.filter((t) => t.taken).length;
  saveGame({
    chapter: missions.jobs.filter((j) => j.state === 'done').length + 1,
    cash: player.cash,
    day: G.day,
    time: clockStr(),
    rep: player.rep,
    jobsDone: missions.jobs.filter((j) => j.state === 'done').map((j) => j.id),
    tapes: tapesGot,
    properties: G.properties,
  });
}

function applySave(s) {
  if (!s) return;
  player.cash = s.cash ?? 320;
  player.rep = s.rep ?? 1;
  G.properties = s.properties ?? 0;
  for (const id of s.jobsDone ?? []) {
    const j = missions.jobs.find((jj) => jj.id === id);
    if (j) j.state = 'done';
  }
  const next = missions.jobs.find((j) => j.state !== 'done');
  if (next) next.state = 'available';
  for (let i = 0; i < (s.tapes ?? 0); i++) {
    if (world.tapes[i]) world.tapes[i].taken = true;
  }
  for (const t of world.tapes) t.mesh.visible = !t.taken;
}

// A street race: three checkpoints against the clock, $600 at the end.
const race = { active: false, idx: 0, timer: 0, points: [[225, -225], [-225, 225], [45, -315]] };

function startRace() {
  race.active = true;
  race.idx = 0;
  race.timer = 75;
  hud.showToast('Street race — hit all 3 checkpoints in 75s', G.time);
  missions.target = [...race.points[0]];
  missions.beacon.position.set(race.points[0][0], 17, race.points[0][1]);
  missions.beacon.visible = true;
  missions.diamond.position.set(race.points[0][0], 8, race.points[0][1]);
  missions.diamond.visible = true;
}

function updateRace(dt) {
  if (!race.active) return;
  race.timer -= dt;
  const p = race.points[race.idx];
  const d = Math.hypot(player.x - p[0], player.z - p[1]);
  if (d < 14) {
    race.idx += 1;
    if (race.idx >= race.points.length) {
      race.active = false;
      player.addCash(600);
      hud.showToast('Race won — $600', G.time);
      missions.beacon.visible = false;
      missions.diamond.visible = false;
      return;
    }
    const np = race.points[race.idx];
    missions.target = [...np];
    missions.beacon.position.set(np[0], 17, np[1]);
    missions.diamond.position.set(np[0], 8, np[1]);
  }
  if (race.timer <= 0) {
    race.active = false;
    hud.showToast('Race lost — too slow', G.time);
    missions.beacon.visible = false;
    missions.diamond.visible = false;
  }
}

function respawn(kind) {
  player.x = CFG.hospital[0];
  player.z = CFG.hospital[1];
  player.yaw = 0;
  player.health = CFG.tuning.playerHealth;
  player.cash = Math.max(0, player.cash - 300);
  player.onFoot = true;
  player.figure.position.set(player.x, 0, player.z);
  player.figure.visible = true;
  police.heat = 0;
  police.wanted = 0;
  hud.hideEndcard();
  G.state = 'play';
}

hud.onMenu = (action) => {
  audio.unlock();
  if (action === 'continue') {
    applySave(loadSave());
    hud.hideTitle();
    G.state = 'play';
  } else if (action === 'new') {
    clearSave();
    hud.hideTitle();
    G.state = 'play';
  } else if (action === 'controls' || action === 'howto') {
    hud.showControls();
  } else if (action === 'close-controls') {
    hud.hideControls();
  } else if (action === 'resume') {
    hud.hidePause();
    G.state = 'play';
  } else if (action === 'quit') {
    hud.hidePause();
    hud.showTitle(loadSave());
    G.state = 'title';
  } else if (action === 'close-map') {
    hud.hideMap();
    G.state = 'play';
  } else if (action === 'endcard') {
    respawn('card');
  }
};

function step(dt) {
  G.time += dt;
  const focus = player.focus();
  world.update(dt, G.time);
  renderer.update(dt);

  if (G.state === 'title') {
    renderer.orbit(dt, G.time);
    traffic.update(dt, { x: 0, z: 0, inCar: false }, 0, null);
    return;
  }

  if (G.state === 'map') {
    traffic.update(dt, focus, police.wanted, null);
    if (input.pressed('KeyM') || input.pressed('Escape')) {
      hud.hideMap();
      G.state = 'play';
    }
    renderer.follow(dt, focus, focus.heading, !player.onFoot);
    input.endFrame();
    return;
  }

  if (G.state === 'pause') {
    if (input.pressed('Escape')) {
      hud.hidePause();
      G.state = 'play';
    }
    input.endFrame();
    return;
  }

  if (G.state === 'endcard') {
    if (input.pressed('KeyE') || input.pressed('Enter')) respawn('key');
    input.endFrame();
    return;
  }

  // ---- play ----
  // First gesture starts the audio.
  if (input.pressed('KeyW') || input.pressed('KeyA') || input.pressed('KeyS') || input.pressed('KeyD') || input.clicked()) audio.unlock();

  if (input.pressed('KeyM')) {
    hud.showMap({ player, police, missions, world, properties: G.properties });
    G.state = 'map';
    input.endFrame();
    return;
  }
  if (input.pressed('Escape')) {
    hud.showPause();
    G.state = 'pause';
    input.endFrame();
    return;
  }
  if (input.pressed('KeyV')) {
    renderer.camMode = renderer.camMode === 'chase' ? 'classic' : 'chase';
  }
  if (input.pressed('KeyQ')) {
    audio.setStation(audio.station + 1);
  }

  let interactPressed = false;
  let stoleCar = false;
  if (input.pressed('KeyF')) {
    if (player.onFoot) {
      const res = player.tryEnterCar();
      if (res) {
        stoleCar = res.stolen;
        if (res.stolen) {
          police.addHeat(12);
          hud.showToast('Car stolen — the heat is on', G.time);
        }
      }
    } else {
      player.exitCar();
    }
  }
  if (input.pressed('KeyE')) interactPressed = true;

  // E at the race marker starts a race; at the safehouse it saves; at the
  // respray it clears the heat for $200.
  if (interactPressed) {
    const dRace = Math.hypot(player.x - CFG.raceStart[0], player.z - CFG.raceStart[1]);
    const dSafe = Math.hypot(player.x - CFG.safehouse[0], player.z - CFG.safehouse[1]);
    const dRespray = Math.hypot(player.x - CFG.respray[0], player.z - CFG.respray[1]);
    if (dRace < 10 && !race.active && !missions.current) startRace();
    else if (dSafe < 10 && player.onFoot) {
      player.heal(100);
      writeSave();
      hud.showToast('Saved at the safehouse', G.time);
    } else if (dRespray < 10 && !player.onFoot && police.wanted > 0 && player.cash >= CFG.tuning.resprayCost) {
      player.addCash(-CFG.tuning.resprayCost);
      police.heat = 0;
      hud.showToast('Respray — the heat is gone', G.time);
    }
  }

  player.update(dt, input);
  updateRace(dt);

  // Tide Tapes: walk over one to collect it.
  for (const t of world.tapes) {
    if (t.taken) continue;
    if (Math.hypot(player.x - t.x, player.z - t.z) < 2.2) {
      t.taken = true;
      t.mesh.visible = false;
      player.addCash(50);
      const got = world.tapes.filter((tt) => tt.taken).length;
      hud.showToast(`Tide Tape ${got}/${CFG.tuning.tapeCount} — +$50`, G.time);
      audio.blip(1180);
    }
  }

  const ctx = {
    player,
    police,
    combat,
    traffic,
    interactPressed,
    stoleCar,
    time: G.time,
    onJobDone: () => {
      audio.missionDone();
      writeSave();
    },
  };
  missions.update(dt, ctx);
  for (const ev of missions.drainEvents()) {
    if (ev.type === 'dialogue') hud.setDialogue(ev.speaker, ev.text, G.time);
    if (ev.type === 'toast') hud.showToast(ev.text, G.time);
  }

  police.update(dt, player);
  combat.update(dt, {
    player,
    input,
    camera: renderer.camera,
    canvas,
    onPlayerHit: (dmg) => {
      if (player.damage(dmg) <= 0) {
        hud.showEndcard('wasted');
        G.state = 'endcard';
      } else {
        hud.damageFlash();
      }
    },
  });

  // Busted: a unit catches Mara on foot while the heat is on.
  if (player.onFoot && police.wanted > 0) {
    for (const u of police.units) {
      if (Math.hypot(u.mesh.position.x - player.x, u.mesh.position.z - player.z) < 3.2) {
        hud.showEndcard('busted');
        G.state = 'endcard';
        break;
      }
    }
  }

  const gunfireAt = input.clicked() || input.mouse.down ? [player.x, player.z] : null;
  traffic.update(dt, focus, police.wanted, gunfireAt);
  audio.engine(player.inCar ? player.speed : 0, !player.onFoot);
  audio.siren(dt, police.wanted);

  renderer.follow(dt, focus, focus.heading, !player.onFoot);
  hud.update({
    player,
    police,
    missions,
    combat,
    station: audio.stationName,
    day: G.day,
    clock: clockStr(),
    now: G.time,
    world,
  });
  input.endFrame();
}

// ---- boot ----
const saved = loadSave();
hud.showTitle(saved);

// Shot mode: stage the scene, play it forward, paint twice, signal ready.
if (shotName && ['chase', 'start', 'combat', 'map'].includes(shotName)) {
  hud.hideTitle();
  G.state = 'play';
  const autopilot = stageShot(shotName, G);
  const steps = SHOT_STEPS[shotName] ?? 120;
  for (let i = 0; i < steps; i++) {
    autopilot(1 / 60, i, steps);
    step(1 / 60);
    input.endFrame();
  }
  renderer.render();
  renderer.render();
  G.frozen = true;
  window.__shotReady = true;
}

window.__game = G;

// ---- main loop ----
// One render per animation frame, after all the simulation steps for that
// frame. step() never renders: at low frame rates the game used to paint
// once per step, so rendering (the slow part on a software rasteriser)
// capped how fast the simulation could run and the game fell into slow
// motion. The simulation now runs up to 16 steps a frame and keeps up
// with real time down to about 4 fps; the cap stops a backgrounded tab
// from spiralling when it comes back.
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (G.frozen) {
    renderer.render();
    return;
  }
  acc += dt;
  let n = 0;
  while (acc >= 1 / 60 && n < 16) {
    step(1 / 60);
    acc -= 1 / 60;
    n += 1;
  }
  if (n === 16) acc = 0;
  renderer.render();
}
requestAnimationFrame(frame);
