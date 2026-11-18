// NEON TIDE — shots.js
// The four staged scenes for the screenshots. Each one sets the game up with
// the real systems (missions, police, combat, HUD), then plays the real rules
// forward with a scripted autopilot — no faked poses. main.js renders twice
// after staging and sets window.__shotReady.

import * as THREE from '../vendor/three.module.min.js';

function runSteps(game, n, controls) {
  for (let i = 0; i < n; i++) {
    game.autopilot = controls;
    game.step(1 / 60);
  }
  game.autopilot = null;
}

function baseControls() {
  return {
    forward: false, back: false, left: false, right: false,
    sprint: false, brake: false, enter: false, interact: false,
    reload: false, shoot: false, shootHeld: false, mouseDX: 0, mouseDY: 0,
    weapon: -1, map: false, radio: false, cam: false, pause: false,
  };
}

export function stageShot(game, name) {
  const g = game;
  if (name === 'chase') {
    // Night rain chase: Mara's car down the avenue, three police units, a
    // helicopter, three stars, a job objective ahead.
    g.state = 'play';
    g.hud.hideTitle();
    g.cash = 6420;
    g.rep = 40;
    g.radioStation = 0;
    g.missions.setForShot(0, 1); // LOW WATER, stage 2: drive to Neon Row
    g.missions.dialogue = [];
    g.hud.showDialogue('Ilya Kane', 'The package is in the trunk. Do not stop for anyone.');
    const p = g.player;
    p.pos.set(0, 0, -60);
    p.heading = 0; // driving south, +Z, toward the city
    p.mode = 'car';
    p.car = p.ownCar;
    p.ownCar.mesh.position.set(0, 0, -60);
    p.ownCar.mesh.rotation.y = 0;
    p.ownCar.heading = 0;
    p.speed = 24;
    p.mesh.visible = false;
    g.police.wanted = 3;
    g.police.heat = 0;
    g.police.lastCrimeAt = g.time;
    // Spawn the units, then place them by hand for the frame.
    g.police.update(0.01);
    if (g.police.units[0]) {
      g.police.units[0].mesh.position.set(0, 0, -8);
      g.police.units[0].heading = Math.PI;
      g.police.units[0].state = 'ROADBLOCK';
    }
    if (g.police.units[1]) {
      g.police.units[1].mesh.position.set(-6, 0, -92);
      g.police.units[1].heading = 0;
      g.police.units[1].state = 'PURSUIT';
    }
    if (g.police.units[2]) {
      g.police.units[2].mesh.position.set(6, 0, -96);
      g.police.units[2].heading = 0;
      g.police.units[2].state = 'PURSUIT';
    }
    g.render.setMode('chase');
    const c = baseControls();
    c.forward = true;
    runSteps(g, 100, c);
    // Place the three pursuit units in a tight tail behind Mara so the
    // chase reads in one frame, then frame it from ahead: the camera sits
    // south of her car and looks back north, so her car and the units
    // behind it are both in frame (a plain chase camera looks forward, and
    // the pursuit behind it would be invisible).
    const pz = g.player.pos.z;
    const tail = [[-3, pz - 12], [4, pz - 18], [0, pz - 26]];
    g.police.units.forEach((u, i) => {
      if (!tail[i]) return;
      u.mesh.position.set(tail[i][0], 0, tail[i][1]);
      u.heading = 0;
      u.state = 'PURSUIT';
    });
    const fwd = new THREE.Vector3(Math.sin(g.player.heading), 0, Math.cos(g.player.heading));
    const camPos = g.player.pos.clone().addScaledVector(fwd, 16);
    camPos.y = 6;
    const camLook = g.player.pos.clone().addScaledVector(fwd, -12);
    camLook.y = 2;
    g.render.setFixed(camPos, camLook);
    g.render.update(0.016);
    g.hud.update(0.016);
  } else if (name === 'start') {
    // Title screen over the rainy skyline.
    g.state = 'title';
    g.saveData = { cash: 6420, rep: 40, jobIndex: 1, tapes: 3, day: 2, timeMinutes: 22 * 60 + 15, chapter: 2 };
    g.cash = 6420;
    g.day = 2;
    g.timeMinutes = 22 * 60 + 15;
    g.render.setFixed(new THREE.Vector3(95, 40, 135), new THREE.Vector3(0, 14, 0));
    g.hud.showTitle(g.saveData);
    g.render.update(0.016);
  } else if (name === 'combat') {
    // On-foot shootout in Neon Row: five Ebb foes ahead, a stolen car beside
    // Mara, a police unit closing in, Dario talking.
    g.state = 'play';
    g.hud.hideTitle();
    g.cash = 6420;
    g.rep = 40;
    g.missions.setForShot(3, 0); // BLUE LIGHTS, stage 1: clear the block
    g.missions.dialogue = [];
    g.hud.showDialogue('Dario Flint', 'You picked the wrong block, Voss. Boys — light her up.');
    const p = g.player;
    p.pos.set(0, 0, 20);
    p.heading = 0; // facing south (+Z), toward the foes
    p.mode = 'foot';
    p.mesh.visible = true;
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = 0;
    g.combat.current = 2; // SMG
    g.combat.mag[2] = 28;
    // A stolen car parked beside Mara (both modes in one frame).
    const stolen = g.traffic.cars[0];
    if (stolen) {
      g.traffic.stealCar(stolen);
      stolen.mesh.position.set(4.5, 0, 26);
      stolen.mesh.rotation.y = 0;
    }
    g.police.wanted = 2;
    g.police.heat = 0;
    g.police.lastCrimeAt = g.time;
    g.police.update(0.01);
    if (g.police.units[0]) {
      g.police.units[0].mesh.position.set(-8, 0, 62);
      g.police.units[0].heading = Math.PI;
    }
    g.render.setMode('chase');
    // Autopilot: walk forward a little, then fire at the nearest foe.
    const walk = baseControls();
    walk.forward = true;
    runSteps(g, 40, walk);
    const fire = baseControls();
    fire.shootHeld = true;
    fire.shoot = true;
    runSteps(g, 3, fire);
    // Snap the camera to the over-the-shoulder pose behind Mara (the render
    // camera lerps, and one update would leave it at its start pose).
    const cfwd = new THREE.Vector3(Math.sin(g.player.heading), 0, Math.cos(g.player.heading));
    const cPos = g.player.pos.clone().addScaledVector(cfwd, -7.5);
    cPos.y = 3.5;
    const cLook = g.player.pos.clone().addScaledVector(cfwd, 8);
    cLook.y = 1.5;
    g.render.setFixed(cPos, cLook);
    g.render.update(0.016);
    g.hud.update(0.016);
  } else if (name === 'map') {
    // City map: two jobs done, one active, route line, tapes and legend.
    g.state = 'map';
    g.cash = 6420;
    g.rep = 40;
    g.tapes = 3;
    let taken = 0;
    for (const t of g.world.tapes) {
      if (taken >= 3) break;
      t.taken = true;
      t.mesh.visible = false;
      taken++;
    }
    g.missions.setForShot(2, 0); // RISING TIDE, stage 1
    g.missions.dialogue = [];
    g.player.pos.set(0, 0, -20);
    g.player.heading = Math.PI;
    g.render.setMode('map');
    g.hud.showMap(true);
    g.hud.update(0.1);
  }
}
