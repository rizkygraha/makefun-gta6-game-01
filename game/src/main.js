// NEON TIDE — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between five screens: title, play, map, paused and over.
//
// ?seed=N fixes the city. ?shot=chase|start|combat|map (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { PLACES, RADIO, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import {
  ACTION_CAMERA, ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT,
  ACTION_MAP, ACTION_PAUSE, ACTION_RADIO, ACTION_RELOAD, createInput,
} from './input.js';
import { createPlayer, tryEnterCar, updatePlayer } from './player.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions, startJob, tryInteract, tryStealStage, updateMissions } from './missions.js';
import { reloadWeapon, updateCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function createGame(seedValue) {
  const random = createRandom(seedValue);
  const world = createWorld(random);
  const playerCar = {
    id: 'player-car', kind: 'player', wasTraffic: false,
    // Parked on the x=0 road, facing south along it: W drives straight
    // down an open road, never into a building.
    x: 0, z: -18, angle: 0, speed: 0, velX: 0, velZ: 0,
    color: 0x19c2d8, condition: 100,
  };
  const game = {
    seed: seedValue,
    random,
    world,
    player: createPlayer({ x: 0, z: -24 }),
    playerCar,
    cars: [playerCar],
    peds: [],
    enemies: [],
    police: createPolice(),
    mission: createMissions(),
    radio: { station: 0 },
    audio: createAudio(),
    hud: createHud(),
    screen: 'title',
    day: 1,
    clock: 21 * 3600, // 21:00 on day one
    cash: 0,
    rep: 0,
    stats: { tapes: 0, properties: 0, jobsDone: 0 },
    cameraMode: 'chase',
    fx: { muzzle: null, tracers: [] },
    hudMessage: null,
  };
  spawnTraffic(game);
  return game;
}

const game = createGame(seed);
window.__game = game; // for debugging and automated smoke tests
const renderer = createRenderer(canvas);
renderer.buildCity(game.world);
const input = createInput(canvas);

function announce(message) {
  status.textContent = message;
}

function applySave(save) {
  if (!save) return;
  game.cash = save.cash ?? 0;
  game.rep = save.rep ?? 0;
  game.day = save.day ?? 1;
  game.clock = save.clock ?? 21 * 3600;
  game.stats.tapes = save.tapes ?? 0;
  game.stats.jobsDone = save.jobsDone ?? 0;
  game.mission.jobIndex = Math.max(0, Math.min(5, (save.jobIndex ?? 0)));
  startJob(game);
  game.hud.setDialog(game.mission.dialog);
}

function step(inp, dt) {
  game.clock += dt;
  if (game.clock >= 86400) {
    game.clock -= 86400;
    game.day += 1;
  }
  // Mouse aim: raycast onto the ground through the current camera.
  const m = inp.mouse();
  const aim = renderer.aimPoint(m.x, m.y);
  if (aim) {
    game.player.aim.x = aim.x;
    game.player.aim.z = aim.z;
  }
  updatePlayer(game, inp, dt);
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  updateCombat(game, inp, dt);
  const speed = game.player.inCar && game.player.car ? Math.abs(game.player.car.speed) : 0;
  game.audio.update(speed, game.police.stars);
  // The hospital heals Mara on foot.
  const h = PLACES.hospital;
  if (!game.player.inCar && Math.hypot(game.player.pos.x - h.x, game.player.pos.z - h.z) < 8) {
    game.player.health = Math.min(100, game.player.health + 6 * dt);
  }
}

function titleStep(dt) {
  game.clock += dt;
  if (game.clock >= 86400) {
    game.clock -= 86400;
    game.day += 1;
  }
  updateTraffic(game, dt);
}

function startNewGame() {
  clearSave();
  game.audio.ensure();
  startJob(game);
  game.screen = 'play';
  game.hud.showScreen('play');
  game.hud.setDialog(game.mission.dialog);
  announce('Playing. Job 1: Low Water.');
}

function continueGame() {
  const save = loadSave();
  if (!save) return false;
  game.audio.ensure();
  applySave(save);
  game.screen = 'play';
  game.hud.showScreen('play');
  announce('Continuing. Job ' + (save.jobIndex + 1) + '.');
  return true;
}

let lastJobsDone = 0;

function handleActions() {
  const actions = input.takeActions();
  const weapon = input.takeWeapon();
  if (weapon >= 0) {
    const locked = (weapon === 2 && game.mission.jobIndex < 2) || (weapon === 3 && game.mission.jobIndex < 4);
    if (!locked) game.player.weapon = weapon;
  }
  if (game.screen === 'title') {
    if (actions & ACTION_CONFIRM) startNewGame();
    return;
  }
  if (game.screen === 'over') {
    if (actions & ACTION_CONFIRM) window.location.reload();
    return;
  }
  if (actions & ACTION_PAUSE) {
    if (game.screen === 'play') {
      game.screen = 'paused';
      game.hud.showScreen('paused');
      writeSave(game);
      announce('Paused.');
    } else if (game.screen === 'paused') {
      game.screen = 'play';
      game.hud.showScreen('play');
      announce('Playing.');
    } else if (game.screen === 'map') {
      game.screen = 'play';
      game.hud.showScreen('play');
    }
    return;
  }
  if (game.screen === 'paused') return;
  if (actions & ACTION_MAP) {
    if (game.screen === 'play') {
      game.screen = 'map';
      game.hud.drawMap(game);
      game.hud.showScreen('map');
      announce('City map.');
    } else if (game.screen === 'map') {
      game.screen = 'play';
      game.hud.showScreen('play');
    }
    return;
  }
  if (game.screen !== 'play') return;
  if (actions & ACTION_CAMERA) {
    game.cameraMode = game.cameraMode === 'chase' ? 'classic' : 'chase';
  }
  if (actions & ACTION_RADIO) {
    game.audio.ensure();
    const station = game.audio.nextStation();
    game.radio.station = RADIO.indexOf(station);
    game.hudMessage = { text: station.name + ' — ' + station.track, ttl: 2 };
  }
  if (actions & ACTION_RELOAD) reloadWeapon(game);
  if (actions & ACTION_ENTER) {
    // A steal stage takes priority: advance the job, then get in the car.
    // A successful enter/exit cuts the camera to the new view at once:
    // lerping from the on-foot camera would swing through the car.
    tryStealStage(game);
    if (tryEnterCar(game)) renderer.snapCamera(game);
  }
  if (actions & ACTION_INTERACT) tryInteract(game);
  if (actions & ACTION_CONFIRM) game.audio.ensure();
  // Autosave when a job lands.
  if (game.stats.jobsDone !== lastJobsDone) {
    lastJobsDone = game.stats.jobsDone;
    writeSave(game);
  }
}

function runShot(name) {
  const scene = stageShot(name, game, step);
  game.screen = scene;
  game.hud.showScreen(scene);
  if (scene === 'map') game.hud.drawMap(game);
  if (game.mission.dialog) game.hud.setDialog(game.mission.dialog);
  renderer.snapCamera(game);
  let painted = 0;
  function paint() {
    renderer.draw(game, STEP, game.clock);
    game.hud.update(game, STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const save = loadSave();
  game.hud.setContinue(save);
  game.hud.showScreen('title');
  announce('NEON TIDE. Press Enter or click to start.');

  document.getElementById('btn-continue').addEventListener('click', () => {
    if (!continueGame()) startNewGame();
  });
  document.getElementById('btn-new').addEventListener('click', () => startNewGame());
  document.getElementById('btn-controls').addEventListener('click', () => {
    document.getElementById('howto').classList.toggle('hidden');
  });
  document.getElementById('btn-sound').addEventListener('click', (event) => {
    const on = event.currentTarget.textContent.includes('ON');
    event.currentTarget.innerHTML = on ? 'SOUND: OFF<small>Radio and effects</small>' : 'SOUND: ON<small>Radio and effects</small>';
  });
  document.getElementById('btn-retry').addEventListener('click', () => window.location.reload());
  window.addEventListener('pointerdown', () => game.audio.ensure(), { once: true });
  window.addEventListener('keydown', () => game.audio.ensure(), { once: true });

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (game.screen === 'play') {
      while (accumulator >= STEP) {
        step(input, STEP);
        accumulator -= STEP;
      }
    } else if (game.screen === 'title') {
      while (accumulator >= STEP) {
        titleStep(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, STEP, game.clock);
    game.hud.update(game, STEP);
  }

  function resize() {
    renderer.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      game.hud.showScreen('paused');
      writeSave(game);
      announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
