// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused, map and game over.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|start|combat|map (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { JOBS, STEP } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MAP, ACTION_PAUSE, ACTION_RADIO_NEXT, ACTION_RADIO_PREV, createInput } from './input.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPlayer, updatePlayer } from './player.js';
import { initPolice, updatePolice } from './police.js';
import { initMissions, refreshObjective, updateMissions } from './missions.js';
import { initCombat, updateCombat } from './combat.js';
import { createHud, updateHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function createGame(seedValue) {
  const G = {
    seed: seedValue,
    rng: createRandom(seedValue),
    time: 0,
    day: 1,
    clock: 21.4, // 21:24 — night, neon on
    cash: 0,
    rep: 0,
    tapes: 0,
    screen: 'title',
    cameraMode: 'chase',
    camHeading: Math.PI,
    messages: [],
    radio: { station: 0 },
    cars: [],
    peds: [],
    enemies: [],
    policeUnits: [],
    heli: null,
    wanted: 0,
    heat: 0,
    lastCrime: -100,
    lastRam: -100,
  };
  G.addMessage = (text) => {
    const last = G.messages[G.messages.length - 1];
    if (last && last.text === text && G.time - last.t < 2.5) return;
    G.messages.push({ text, t: G.time });
    if (G.messages.length > 4) G.messages.shift();
  };
  G.world = createWorld(G.rng);
  G.input = createInput(canvas);
  G.audio = createAudio();
  G.renderer = createRenderer(canvas, G);
  G.hud = createHud(G);
  resetState(G);
  return G;
}

/** Fresh run state on the same city (new game, retry, continue). */
function resetState(G) {
  G.time = 0;
  G.day = 1;
  G.clock = 21.4;
  G.cash = 0;
  G.rep = 0;
  G.tapes = 0;
  G.messages = [];
  G.cameraMode = 'chase';
  G.heat = 0;
  G.wanted = 0;
  G.lastCrime = -100;
  G.lastRam = -100;
  G.heli = null;
  initTraffic(G);
  initPlayer(G);
  initPolice(G);
  initMissions(G);
  initCombat(G);
}

function startNewGame(G) {
  resetState(G);
  G.screen = 'play';
  const job = JOBS[0];
  G.addMessage(`New job: ${job.name} — $${job.payout.toLocaleString()}. ${job.brief}`);
  announce(`Playing. Job 1, ${job.name}.`);
}

function continueGame(G) {
  const save = loadSave();
  if (!save) { startNewGame(G); return; }
  resetState(G);
  G.mission.jobIndex = Math.min(save.jobIndex, JOBS.length - 1);
  G.cash = save.cash || 0;
  G.rep = save.rep || 0;
  G.tapes = save.tapes || 0;
  G.player.health = save.health || 100;
  G.day = save.day || 1;
  G.clock = save.clock || 21.4;
  G.world.tapes.slice(0, G.tapes).forEach((t) => { t.found = true; });
  refreshObjective(G);
  G.screen = 'play';
  const job = JOBS[G.mission.jobIndex];
  G.addMessage(`Welcome back, Mara. Job ${job.id}: ${job.name} — $${job.payout.toLocaleString()}.`);
  announce(`Continuing. Job ${job.id}, ${job.name}.`);
}

function announce(message) {
  status.textContent = message;
}

/** One fixed step of the live world. Shared by the loop and the shot staging. */
function stepWorld(G, input, actions, dt) {
  G.time += dt;
  if (G.screen === 'title') {
    updateTraffic(G, dt);
    return;
  }
  if (G.screen !== 'play') return;
  // One game minute per real second of play, so the clock visibly moves.
  G.clock += dt / 60;
  if (G.clock >= 24) { G.clock -= 24; G.day += 1; }
  if (actions & ACTION_RADIO_PREV) {
    G.radio.station = (G.radio.station + 2) % 3;
    G.addMessage(`Radio: ${['TIDE FM 88.1', 'HARBOUR JAZZ 94.6', 'STATIC TALK 101.3'][G.radio.station]}`);
  }
  if (actions & ACTION_RADIO_NEXT) {
    G.radio.station = (G.radio.station + 1) % 3;
    G.addMessage(`Radio: ${['TIDE FM 88.1', 'HARBOUR JAZZ 94.6', 'STATIC TALK 101.3'][G.radio.station]}`);
  }
  updatePlayer(G, input, actions, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updateMissions(G, actions, dt);
  updateCombat(G, input, actions, dt);
  G.audio.update(G, dt);
  if (G.player.health <= 0 && G.screen === 'play') {
    G.screen = 'over';
    announce('Flatlined. The tide takes another one.');
  }
}

const G = createGame(seed);

function wireButtons() {
  const save = loadSave();
  const btnContinue = document.getElementById('btn-continue');
  const saveSummary = document.getElementById('save-summary');
  if (save) {
    btnContinue.style.display = '';
    const job = JOBS[Math.min(save.jobIndex, JOBS.length - 1)];
    saveSummary.textContent = `Save found — Job ${job.id} ${job.name} · $${(save.cash || 0).toLocaleString()} · REP ${save.rep || 0} · Day ${save.day || 1}`;
  } else {
    btnContinue.style.display = 'none';
    saveSummary.textContent = 'No save yet — Tidewater is waiting.';
  }
  document.getElementById('btn-new').addEventListener('click', () => startNewGame(G));
  btnContinue.addEventListener('click', () => continueGame(G));
  document.getElementById('btn-howto').addEventListener('click', () => {
    document.getElementById('howto-panel').style.display = '';
  });
  document.getElementById('btn-howto-close').addEventListener('click', () => {
    document.getElementById('howto-panel').style.display = 'none';
  });
  document.getElementById('btn-resume').addEventListener('click', () => { G.screen = 'play'; announce('Playing.'); });
  document.getElementById('btn-restart').addEventListener('click', () => startNewGame(G));
  document.getElementById('btn-quit').addEventListener('click', () => { saveGame(G); G.screen = 'title'; wireButtons(); announce('Title screen.'); });
  document.getElementById('btn-retry').addEventListener('click', () => startNewGame(G));
  document.getElementById('btn-over-title').addEventListener('click', () => { G.screen = 'title'; wireButtons(); announce('Title screen.'); });
}

function runShot(name) {
  resetState(G);
  stageShot(name, G, stepWorld);
  G.snapCamera = true;
  let painted = 0;
  function paint() {
    G.renderer.sync(G, STEP);
    updateHud(G.hud, G);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  wireButtons();
  const input = G.input;
  let accumulator = 0;
  let last = performance.now();

  function handleActions() {
    const actions = input.takeActions();
    if (G.screen === 'title') {
      if (actions & ACTION_CONFIRM) startNewGame(G);
      return actions;
    }
    if (G.screen === 'play') {
      if (actions & ACTION_PAUSE) { G.screen = 'paused'; announce('Paused.'); }
      else if (actions & ACTION_MAP) { G.screen = 'map'; announce('City map.'); }
      else if (actions & ACTION_CAMERA) {
        G.cameraMode = G.cameraMode === 'chase' ? 'classic' : 'chase';
        G.addMessage(`Camera: ${G.cameraMode === 'chase' ? '3D chase' : 'classic high'}.`);
      }
      return actions;
    }
    if (G.screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { G.screen = 'play'; announce('Playing.'); }
      return 0;
    }
    if (G.screen === 'map') {
      if (actions & (ACTION_MAP | ACTION_PAUSE)) { G.screen = 'play'; announce('Playing.'); }
      return 0;
    }
    if (G.screen === 'over') {
      if (actions & ACTION_CONFIRM) startNewGame(G);
      return 0;
    }
    return 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (G.screen === 'title' || G.screen === 'play') {
      while (accumulator >= STEP && (G.screen === 'title' || G.screen === 'play')) {
        stepWorld(G, input, actions, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    G.renderer.sync(G, STEP);
    updateHud(G.hud, G);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('NEON TIDE. Press Enter or click NEW GAME to start.');
  requestAnimationFrame(frame);
}

window.__game = {
  state: G,
  get screen() { return G.screen; },
  version: 'neon-tide-round5',
  seed,
};

if (shot) runShot(shot);
else runGame();
