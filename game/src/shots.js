// shots.js — stages the four screenshots. A shot sets up a scene by
// playing the real rules forward with an autopilot (the same fixed steps
// the game runs), then the caller paints twice and sets
// window.__shotReady. Same seed, same steps, same frame.

import { CFG } from './config.js';

function setPlayerInCar(G, x, z, heading, speed) {
  const p = G.player;
  p.onFoot = false;
  p.car.position.set(x, 0, z);
  p.carHeading = heading;
  p.carVel.x = Math.sin(heading) * speed;
  p.carVel.z = Math.cos(heading) * speed;
  p.x = x;
  p.z = z;
  p.figure.visible = false;
}

function setPlayerOnFoot(G, x, z, yaw) {
  const p = G.player;
  p.onFoot = true;
  p.x = x;
  p.z = z;
  p.yaw = yaw;
  p.figure.position.set(x, 0, z);
  p.figure.rotation.y = yaw;
  p.figure.visible = true;
}

/** Stage one of the four shots. Returns the autopilot step function. */
export function stageShot(name, G) {
  const { player, police, missions, combat, hud, input } = G;
  const ctx = { player, police, combat, traffic: G.traffic, onJobDone: null, time: G.time, interactPressed: false, stoleCar: false };

  if (name === 'chase') {
    // Night rain chase: Mara in her car on the avenue, three units on her,
    // the helicopter up, job 4's getaway on the HUD.
    player.cash = 6420;
    player.rep = 4;
    setPlayerInCar(G, 0, -180, 0, 22);
    police.heat = 45;
    police.lastCrime = G.time;
    police.update(1 / 60, player);
    // Put the three units where the frame wants them.
    const spots = [
      { x: -7, z: -212, state: 'PURSUIT' },
      { x: 9, z: -158, state: 'RAMMING' },
      { x: -11, z: -128, state: 'ROADBLOCK' },
    ];
    police.units.forEach((u, i) => {
      const s = spots[i % spots.length];
      u.mesh.position.set(s.x, 0, s.z);
      u.state = s.state;
      u.heading = 0;
      u.speed = 20;
    });
    missions.setStage(4, 1, ctx);
    hud.setDialogue('Ilya Kane', 'The safehouse is south, Dockside. Do not stop, Mara — Hale has the whole precinct out.', G.time);
    return (dt, step, total) => {
      // Drive south down the avenue, steering back to its center line.
      input.clearVirtual();
      input.setVirtual('KeyW', true);
      if (player.car.position.x > 3) input.setVirtual('KeyA', true);
      if (player.car.position.x < -3) input.setVirtual('KeyD', true);
      if (step === total - 1) {
        // Frame the pursuit for the cover: the chase leaves the units
        // behind the camera, so put them where the camera looks — ahead
        // of the car, on the avenue — for the final frame.
        const cx = player.car.position.x;
        const cz = player.car.position.z;
        const finalSpots = [
          { x: cx - 7, z: cz + 24, state: 'PURSUIT' },
          { x: cx + 7, z: cz + 16, state: 'RAMMING' },
          { x: cx - 1, z: cz + 34, state: 'ROADBLOCK' },
        ];
        police.units.forEach((u, i) => {
          const s = finalSpots[i % finalSpots.length];
          u.mesh.position.set(s.x, 0, s.z);
          u.state = s.state;
          u.heading = 0;
          u.mesh.rotation.y = 0;
          u.speed = 20;
        });
      }
    };
  }

  if (name === 'start') {
    // Title screen over the skyline: CONTINUE shows a real save.
    G.state = 'title';
    hud.showTitle({ chapter: 2, cash: 6420, day: 2, time: '22:15' });
    return () => {};
  }

  if (name === 'combat') {
    // On-foot shootout on the Neon Row avenue: Mara beside her car, the
    // Ebb up the road ahead of her, job 4's combat stage on the HUD.
    // The foes spawn around the stage target inside the block, where the
    // buildings block the camera, so they are moved onto the road ahead
    // of her and the beacon follows them.
    player.cash = 5100;
    player.rep = 3;
    setPlayerOnFoot(G, 0, -45, Math.PI);
    player.car.position.set(5, 0, -40);
    player.car.rotation.y = 0.5;
    police.heat = 26;
    police.lastCrime = G.time;
    police.update(1 / 60, player);
    missions.setStage(4, 2, ctx);
    const foeSpots = [[-3, -66], [3, -71], [-4, -77], [4, -83], [0, -88]];
    combat.enemies.forEach((f, i) => {
      const s = foeSpots[i % foeSpots.length];
      f.mesh.position.set(s[0], 0, s[1]);
    });
    missions.target = [0, -75];
    missions.beacon.position.set(0, 17, -75);
    missions.diamond.position.set(0, 8, -75);
    hud.setDialogue('Dario Flint', 'Wrong block, Mara. The Ebb owns Neon Row tonight.', G.time);
    let fired = 0;
    return (dt, step, total) => {
      // Aim at the nearest live foe, and fire on the last steps so the
      // muzzle flash is fresh in the frame.
      const foes = combat.enemies.filter((e) => !e.dead);
      if (foes.length > 0) {
        let best = foes[0];
        let bestD = Infinity;
        for (const f of foes) {
          const d = Math.hypot(f.mesh.position.x - player.x, f.mesh.position.z - player.z);
          if (d < bestD) {
            best = f;
            bestD = d;
          }
        }
        player.yaw = Math.atan2(best.mesh.position.x - player.x, best.mesh.position.z - player.z);
        input.mouse.x = window.innerWidth / 2;
        input.mouse.y = window.innerHeight / 2;
      }
      input.clearVirtual();
      if (step >= total - 3 && fired < 3) {
        input.mouse.down = true;
        input.mouse.clicked = true;
        fired += 1;
      } else {
        input.mouse.down = false;
      }
    };
  }

  if (name === 'map') {
    // The city map: two jobs done, one active, the rest locked, tapes 3/16.
    missions.jobs[0].state = 'done';
    missions.jobs[1].state = 'done';
    missions.jobs[2].state = 'active';
    missions.jobs[3].state = 'locked';
    missions.jobs[4].state = 'locked';
    missions.jobs[5].state = 'locked';
    missions.setStage(3, 0, ctx);
    G.world.tapes[0].taken = true;
    G.world.tapes[1].taken = true;
    G.world.tapes[2].taken = true;
    G.properties = 1;
    G.state = 'map';
    hud.showMap({
      player,
      police,
      missions,
      world: G.world,
      properties: G.properties,
    });
    return () => {};
  }

  return () => {};
}

/** How many fixed steps each shot plays forward before the frame is taken. */
export const SHOT_STEPS = { chase: 150, start: 120, combat: 150, map: 30 };
