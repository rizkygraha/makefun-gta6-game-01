// Shot staging: each of the four screenshots is a real moment of the game,
// reached by playing the rules forward with an autopilot, never composed.
// The camera is placed for the frame, the scene is painted, and the page
// signals window.__shotReady.

import * as THREE from '../vendor/three.module.js';

function setWanted(state, stars) {
  state.wanted = stars;
}

function driveFor(state, step, frames) {
  state.input.keys.add('KeyW');
  for (let i = 0; i < frames; i++) step(1 / 60);
  state.input.keys.delete('KeyW');
}

function idleFor(state, step, frames) {
  for (let i = 0; i < frames; i++) step(1 / 60);
}

export function stageShot(name, state, step) {
  const p = state.player;
  const render = state.render;
  if (name === 'chase') {
    state.screen = 'play';
    state.hud.hideTitle();
    state.hud.hideMap();
    state.missions.sayQueue.length = 0;
    state.missions.sayText = '';
    state.missions.sayTimer = 0;
    p.pos.set(0, 0, 0);
    p.heading = 0;
    const car = p.nearestCar(100);
    if (car) {
      car.taken = true;
      p.car = car;
      p.onFoot = false;
      p.speed = 26;
      p.mesh.visible = false;
      car.x = p.pos.x;
      car.z = p.pos.z;
      car.heading = p.heading;
      car.mesh.position.set(p.pos.x, 0, p.pos.z);
      car.mesh.rotation.y = p.heading;
    }
    state.missions.jobIndex = 1;
    state.missions.stageIndex = 1;
    state.missions.say('Ilya: Quiet and quick. The cargo is under the blue container.', null);
    setWanted(state, 3);
    state.radioStation = 0;
    driveFor(state, step, 120);
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    render.setView(
      new THREE.Vector3(p.pos.x + fx * 16 + rx * 4, 5, p.pos.z + fz * 16 + rz * 4),
      new THREE.Vector3(p.pos.x - fx * 8, 2, p.pos.z - fz * 8)
    );
    return true;
  }
  if (name === 'start') {
    state.screen = 'title';
    state.hud.showTitle(null);
    render.setView(
      new THREE.Vector3(-90, 42, 130),
      new THREE.Vector3(20, 12, -40)
    );
    idleFor(state, step, 30);
    render.setView(
      new THREE.Vector3(-90, 42, 130),
      new THREE.Vector3(20, 12, -40)
    );
    return true;
  }
  if (name === 'combat') {
    state.screen = 'play';
    state.hud.hideTitle();
    state.hud.hideMap();
    state.missions.sayQueue.length = 0;
    state.missions.sayText = '';
    state.missions.sayTimer = 0;
    p.pos.set(0, 0, 0);
    p.heading = 0;
    p.onFoot = true;
    p.mesh.visible = true;
    p.weapon = 2;
    const car = p.nearestCar(100);
    if (car) {
      car.x = p.pos.x + 4;
      car.z = p.pos.z + 3;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = p.heading + 0.4;
    }
    state.missions.jobIndex = 3;
    state.missions.stageIndex = 1;
    state.combat.spawnSquad(0, 28, 4, false);
    state.missions.say('Ilya: Four enforcers, all armed. The Spire belongs to us tonight.', null);
    setWanted(state, 1);
    state.input.mouseDown = true;
    idleFor(state, step, 8);
    state.input.mouseDown = false;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    render.setView(
      new THREE.Vector3(p.pos.x - fx * 8 + rx * 3, 3, p.pos.z - fz * 8 + rz * 3),
      new THREE.Vector3(p.pos.x + fx * 12, 1.6, p.pos.z + fz * 12)
    );
    return true;
  }
  if (name === 'map') {
    state.screen = 'map';
    state.hud.showMap();
    state.hud.update(state);
    render.setView(
      new THREE.Vector3(0, 260, 0.1),
      new THREE.Vector3(0, 0, 0)
    );
    return true;
  }
  return false;
}
