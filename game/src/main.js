// NEON TIDE — main.js
// Boot, the fixed-timestep loop, the screens (title / play / map / pause) and
// the game object every system shares. Shot mode (?shot=chase|start|combat|map)
// stages one scene with the real rules, paints twice and sets
// window.__shotReady for the screenshot capture.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { buildWorld } from './world.js';
import { RenderSys } from './render.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot') || null;

// ---- the game object every system shares ----
const saved = loadSave();
const base = saved || defaultSave();
const G = {
  seed,
  rng: new RNG(seed),
  state: 'title', // 'title' | 'play' | 'map' | 'pause'
  time: 0,
  day: base.day,
  timeMinutes: base.timeMinutes,
  cash: base.cash,
  rep: base.rep,
  tapes: base.tapes || 0,
  radioStation: 0,
  cameraMode: 'chase',
  shot: shotName,
  saveData: saved,
  autopilot: null,
  controls: {
    forward: false, back: false, left: false, right: false,
    sprint: false, brake: false, enter: false, interact: false,
    reload: false, shoot: false, shootHeld: false, mouseDX: 0, mouseDY: 0,
    weapon: -1, map: false, radio: false, cam: false, pause: false,
  },
  addWanted(n) { this.police.addWanted(n); },
  addCash(n) { this.cash += n; },
  addRep(n) { this.rep += n; },
  banner(text, sub) { this.hud.banner(text, sub); },
  saveProgress() {
    const taken = [];
    this.world.tapes.forEach((t, i) => { if (t.taken) taken.push(i); });
    writeSave({
      cash: this.cash, rep: this.rep,
      jobIndex: this.missions.jobIndex,
      tapes: this.tapes, tapesFound: taken,
      day: this.day, timeMinutes: this.timeMinutes,
      chapter: Math.min(this.missions.jobIndex + 1, 6),
    });
  },
  showTitle() {
    this.state = 'title';
    this.render.setMode('title');
    this.hud.showTitle(this.saveData);
    this.input.unlockPointer();
  },
  startNewGame() {
    clearSave();
    this.saveData = null;
    this.cash = 420;
    this.rep = 0;
    this.tapes = 0;
    this.day = 1;
    this.timeMinutes = 22 * 60 + 15;
    // Reset the world: tapes back, foes gone, heat gone.
    for (const t of this.world.tapes) { t.taken = false; t.mesh.visible = true; }
    for (const e of this.combat.enemies) this.scene.remove(e.mesh);
    this.combat.enemies = [];
    this.combat.foesDown = 0;
    this.police.clearWanted();
    this.player.health = CFG.player.health;
    this.player.mode = 'foot';
    this.player.car = null;
    this.player.mesh.visible = true;
    const s = this.world.spots.spawn;
    this.player.pos.set(s.x, 0, s.z);
    this.player.heading = Math.PI;
    this.player.mesh.position.copy(this.player.pos);
    this.missions.jobIndex = 0;
    this.missions._startJob(0, true);
    this.hud.hideTitle();
    this.hud.showPause(false);
    this.state = 'play';
    this.render.setMode(this.cameraMode);
  },
  startFromSave() {
    if (!this.saveData) { this.startNewGame(); return; }
    this.hud.hideTitle();
    this.hud.showPause(false);
    this.state = 'play';
    this.render.setMode(this.cameraMode);
  },
  togglePause() {
    if (this.state === 'play') {
      this.state = 'pause';
      this.hud.showPause(true);
      this.input.unlockPointer();
    } else if (this.state === 'pause') {
      this.state = 'play';
      this.hud.showPause(false);
    }
  },
};

// ---- build the systems, in dependency order ----
const container = document.getElementById('game-container');
G.render = new RenderSys(G, container);
G.scene = G.render.scene;
G.input = new Input();
G.input.attach(G.render.renderer.domElement);
G.world = buildWorld(G);
// Restore collected tapes from the save.
if (saved && Array.isArray(saved.tapesFound)) {
  for (const i of saved.tapesFound) {
    const t = G.world.tapes[i];
    if (t) { t.taken = true; t.mesh.visible = false; }
  }
  G.tapes = saved.tapesFound.length;
}
G.traffic = new Traffic(G);
G.player = new Player(G);
G.police = new Police(G);
G.audio = new AudioSys(G);
G.hud = new HUD(G);
G.combat = new Combat(G);
G.missions = new Missions(G);

// First gesture unlocks audio (and pointer lock on canvas click).
let audioStarted = false;
function firstGesture() {
  if (audioStarted) return;
  audioStarted = true;
  G.audio.ensure();
}
window.addEventListener('keydown', firstGesture);
window.addEventListener('mousedown', firstGesture);
G.render.renderer.domElement.addEventListener('click', () => {
  if (G.state === 'play') G.input.lockPointer();
});

// ---- one fixed step of the simulation ----
function buildControlsFromInput() {
  const inp = G.input;
  const c = G.controls;
  c.forward = inp.isDown('KeyW') || inp.isDown('ArrowUp');
  c.back = inp.isDown('KeyS') || inp.isDown('ArrowDown');
  c.left = inp.isDown('KeyA') || inp.isDown('ArrowLeft');
  c.right = inp.isDown('KeyD') || inp.isDown('ArrowRight');
  c.sprint = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
  c.brake = inp.isDown('Space');
  c.enter = inp.wasPressed('KeyF');
  c.interact = inp.wasPressed('KeyE');
  c.reload = inp.wasPressed('KeyR');
  c.shoot = inp.mouseClicked || inp.wasPressed('KeyJ');
  c.shootHeld = inp.mouseDown || inp.isDown('KeyJ');
  c.mouseDX = inp.mouseDX;
  c.mouseDY = inp.mouseDY;
  c.weapon = -1;
  for (let i = 0; i < 4; i++) {
    if (inp.wasPressed('Digit' + (i + 1))) c.weapon = i;
  }
  c.map = inp.wasPressed('KeyM');
  c.radio = inp.wasPressed('KeyQ');
  c.cam = inp.wasPressed('KeyV');
  c.pause = inp.wasPressed('KeyP') || inp.wasPressed('Escape');
  // Edges are consumed by the first step that reads them: a frame can run
  // up to 16 steps, and a single press must never be re-read by the later
  // ones (F would enter and leave the car in the same frame).
  inp.pressed.clear();
  inp.mouseClicked = false;
  inp.mouseDX = 0;
  inp.mouseDY = 0;
  return c;
}

function stepGame(dt) {
  // Controls are built first, so the screen toggles (map, pause) work from
  // any state — a step that returns early must still see the key that was
  // pressed, or the game could never leave the map or pause screens.
  if (G.autopilot) {
    G.controls = G.autopilot;
  } else {
    buildControlsFromInput();
  }
  const c = G.controls;
  if (c.pause) { G.togglePause(); return; }
  if (G.state === 'title') {
    G.traffic.update(dt);
    G.world.update(dt, G.time);
    G.time += dt;
    return;
  }
  if (G.state === 'pause') return;
  if (G.state === 'map') {
    if (c.map) {
      G.state = 'play';
      G.render.setMode(G.cameraMode);
      G.hud.showMap(false);
    }
    return;
  }
  if (c.map) {
    G.state = 'map';
    G.render.setMode('map');
    G.hud.showMap(true);
    return;
  }
  if (c.radio) {
    G.radioStation = (G.radioStation + 1) % CFG.radio.length;
    G.audio.setStation(G.radioStation);
    G.hud.flashObjective('♪ ' + CFG.radio[G.radioStation].name + ' — ' + CFG.radio[G.radioStation].desc);
  }
  if (c.cam) {
    G.cameraMode = G.cameraMode === 'chase' ? 'classic' : 'chase';
    G.render.setMode(G.cameraMode);
  }
  G.time += dt;
  G.timeMinutes += dt * 0.5;
  if (G.timeMinutes >= 24 * 60) { G.timeMinutes -= 24 * 60; G.day++; }
  G.player.update(dt);
  G.traffic.update(dt);
  G.police.update(dt);
  G.missions.update(dt);
  G.combat.update(dt);
  G.world.update(dt, G.time);
  G.hud.update(dt);
}
G.step = stepGame;

// ---- boot ----
window.__game = G;
window.__shotReady = false;

if (shotName) {
  stageShot(G, shotName);
  G.render.render();
  G.render.render();
  window.__shotReady = true;
} else {
  G.showTitle();
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 16) {
      stepGame(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 16) acc = 0;
    G.render.update(dt);
    G.render.render();
    G.input.endFrame();
  }
  requestAnimationFrame(frame);
}
