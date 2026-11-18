// Boot, fixed-timestep loop, and screens. Title first, then play, M for
// the map. With ?shot=<name>&seed=N the game stages one screenshot instead
// of starting the loop: paint twice, then window.__shotReady.

import * as THREE from '../vendor/three.module.js';
import { RenderStage } from './render.js';
import { buildWorld } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { makeRng } from './random.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { RADIO } from './config.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot');

const rng = makeRng(seed);
const canvas = document.getElementById('game-canvas');
const render = new RenderStage(canvas);
const world = buildWorld(render.scene, rng);
const input = new Input();
input.attach();
const audio = new AudioSys();

const state = {
  time: 0,
  day: 1,
  dayTime: 21 * 60 + 24,
  wanted: 0,
  rep: 0,
  radioStation: 0,
  screen: 'title',
  camHeading: Math.PI,
  rng,
  render,
  world,
  input,
  audio,
  saveNow() {
    saveGame(state);
  },
};
state.traffic = new Traffic(render.scene, rng);
state.player = new Player(render.scene, world, rng);
state.police = new Police(render.scene, rng);
state.missions = new Missions(render.scene, world);
state.combat = new Combat(render.scene, rng);
state.hud = new HUD();
state.player.cash = 420;

state.hud.onNewGame = () => {
  clearSave();
  startPlay();
};
state.hud.onContinue = () => {
  const s = loadGame();
  if (s) applySave(s);
  startPlay();
};
state.hud.onResume = () => {
  state.screen = 'play';
  state.hud.hideMap();
};

function applySave(s) {
  state.player.cash = s.cash;
  state.rep = s.rep;
  state.missions.jobIndex = s.jobIndex;
  state.missions.jobsDone = s.jobsDone;
  state.missions.tapes = s.tapes;
  state.day = s.day;
  state.player.pos.set(s.px, 0, s.pz);
  for (let i = 0; i < Math.min(s.tapes, world.tapes.length); i++) {
    world.tapes[i].taken = true;
    state.missions.tapeMeshes[i].visible = false;
  }
}

function startPlay() {
  state.screen = 'play';
  state.hud.hideTitle();
  audio.ensure();
  audio.startRadio();
}

function stepSim(dt) {
  state.time += dt;
  state.dayTime += dt * 0.5;
  if (state.dayTime >= 24 * 60) {
    state.dayTime -= 24 * 60;
    state.day += 1;
  }
  state.traffic.update(dt, state);
  state.player.update(dt, state);
  state.police.update(dt, state);
  state.missions.update(dt, state);
  state.combat.update(dt, state);
  render.updateRain(dt, state.player.pos.x, state.player.pos.z);
  state.camHeading = state.player.heading;
  render.follow(dt, state.player.pos, state.player.heading, state.player.speed, !state.player.onFoot);
  state.hud.update(state);
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (state.screen === 'title') {
    const a = state.time * 0.04;
    render.setView(
      new THREE.Vector3(Math.cos(a) * 130, 46, Math.sin(a) * 130),
      new THREE.Vector3(0, 10, 0)
    );
    render.updateRain(dt, 0, 0);
    state.time += dt;
    render.render();
    return;
  }
  if (state.screen === 'map') {
    if (input.pressed('Escape') || input.pressed('KeyM')) {
      state.screen = 'play';
      state.hud.hideMap();
    }
    render.render();
    return;
  }
  acc += dt;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 5) {
    stepSim(1 / 60);
    acc -= 1 / 60;
    steps += 1;
  }
  if (steps === 5) acc = 0;
  if (input.pressed('KeyM')) {
    state.screen = 'map';
    state.hud.showMap();
    state.hud.update(state);
  }
  if (input.pressed('KeyV')) {
    render.mode = render.mode === 'chase' ? 'classic' : 'chase';
  }
  if (input.pressed('KeyQ')) {
    state.radioStation = (state.radioStation + 1) % RADIO.length;
    audio.setStation(state.radioStation);
    state.hud.update(state);
  }
  render.render();
}

window.addEventListener('keydown', () => {
  audio.ensure();
  if (state.screen === 'play') audio.startRadio();
}, { once: true });

if (shotName) {
  const ok = stageShot(shotName, state, (dt) => stepSim(dt));
  state.hud.update(state);
  render.render();
  render.render();
  window.__shotReady = !!ok;
  window.__shotError = ok ? null : `unknown shot ${shotName}`;
} else {
  state.hud.showTitle(loadGame());
  requestAnimationFrame(frame);
}
