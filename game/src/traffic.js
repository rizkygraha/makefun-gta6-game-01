// traffic.js — civilian cars that drive the road grid and pedestrians
// who walk the sidewalks (and run when the city gets loud). Cars stop
// for the car ahead; pedestrians pick a new corner when they arrive.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './world.js';

const CAR_COLORS = [0x8a8f98, 0x5a6b8a, 0x7a3b3b, 0x3b5a3b, 0x8a7a3b, 0x4a4a55, 0x9a6b2f, 0x2f5a6b];
const PED_COLORS = [0xd8b25a, 0x7ab8d8, 0xd87a7a, 0x9ad87a, 0xc9c9c9, 0x8a6bd8];

function pedMesh(rng) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.1, 0.35),
    new THREE.MeshStandardMaterial({ color: rng.pick(PED_COLORS), roughness: 0.9 }),
  );
  body.position.y = 0.85;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.9 }),
  );
  head.position.y = 1.6;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.9 }));
  legL.position.set(-0.14, 0.25, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(body);
  g.add(head);
  g.add(legL);
  g.add(legR);
  g.userData.legs = [legL, legR];
  return g;
}

export class Traffic {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    const { roadEvery } = CFG.city;
    const lines = [];
    for (let v = -450; v <= 450; v += roadEvery) lines.push(v);

    // Civilian cars, spread over the grid.
    for (let i = 0; i < 14; i++) {
      const axis = rng.chance(0.5) ? 'x' : 'z';
      const at = rng.pick(lines);
      const mesh = makeCarMesh(rng.pick(CAR_COLORS), { glow: 0x223344 });
      mesh.position.set(axis === 'x' ? rng.range(-400, 400) : at + rng.pick([-3.5, 3.5]), 0, axis === 'x' ? at + rng.pick([-3.5, 3.5]) : rng.range(-400, 400));
      scene.add(mesh);
      this.cars.push({
        mesh,
        axis,
        at,
        along: axis === 'x' ? mesh.position.x : mesh.position.z,
        dir: rng.chance(0.5) ? 1 : -1,
        speed: rng.range(7, 11),
        lane: rng.pick([-3.5, 3.5]),
      });
    }

    // Pedestrians on the sidewalks.
    for (let i = 0; i < 24; i++) {
      const mesh = pedMesh(rng);
      const x = rng.range(-430, 430);
      const z = rng.range(-430, 430);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.peds.push({
        mesh,
        x,
        z,
        tx: x + rng.range(-60, 60),
        tz: z + rng.range(-60, 60),
        speed: rng.range(1.2, 2.0),
        fleeing: false,
        walkPhase: rng.range(0, 6),
      });
    }
  }

  /** The car the player is driving, if any, so traffic yields to it. */
  update(dt, player, wanted, gunfireAt) {
    for (const c of this.cars) {
      if (c.parked) continue; // a marked car waits where the job left it
      // Slow for the vehicle ahead on the same road.
      let want = CFG.tuning.trafficSpeed * (0.8 + (c.speed / 11) * 0.2);
      const ahead = this._aheadBlocked(c, player);
      if (ahead) want = 0;
      c.speed += (want - c.speed) * Math.min(1, dt * 1.5);
      c.along += c.dir * c.speed * dt;
      if (Math.abs(c.along) > 440) {
        // Turn onto the crossing street at the city edge and keep driving.
        const edge = c.along > 0 ? 450 : -450;
        const newAlong = c.at + c.lane;
        c.axis = c.axis === 'x' ? 'z' : 'x';
        c.at = edge;
        c.lane = this.rng.pick([-3.5, 3.5]);
        c.along = Math.max(-440, Math.min(440, newAlong));
        c.dir = this.rng.chance(0.5) ? 1 : -1;
      }
      if (c.axis === 'x') {
        c.mesh.position.set(c.along, 0, c.at + c.lane);
        c.mesh.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.mesh.position.set(c.at + c.lane, 0, c.along);
        c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
      }
      // Spin the wheels.
      for (const w of c.mesh.userData.wheels) w.rotation.x += (c.speed * dt) / 0.38;
    }

    for (const p of this.peds) {
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const dist = Math.hypot(dx, dz);
      let speed = p.speed;
      // Flee from gunfire or a hot wanted level.
      if (gunfireAt && Math.hypot(p.x - gunfireAt[0], p.z - gunfireAt[1]) < 40) p.fleeing = true;
      if (wanted >= 3) p.fleeing = true;
      if (p.fleeing && player) {
        const fx = p.x - player.x;
        const fz = p.z - player.z;
        const fl = Math.hypot(fx, fz) || 1;
        p.x += (fx / fl) * 4.5 * dt;
        p.z += (fz / fl) * 4.5 * dt;
        p.mesh.rotation.y = Math.atan2(fx, fz);
        if (Math.hypot(p.x - player.x, p.z - player.z) > 90) p.fleeing = false;
      } else if (dist < 2) {
        p.tx = p.x + this.rng.range(-70, 70);
        p.tz = p.z + this.rng.range(-70, 70);
        p.tx = Math.max(-435, Math.min(435, p.tx));
        p.tz = Math.max(-435, Math.min(435, p.tz));
      } else {
        p.x += (dx / dist) * speed * dt;
        p.z += (dz / dist) * speed * dt;
        p.mesh.rotation.y = Math.atan2(dx, dz);
      }
      p.walkPhase += dt * (p.fleeing ? 10 : 6);
      const swing = Math.sin(p.walkPhase) * 0.4;
      p.mesh.userData.legs[0].rotation.x = swing;
      p.mesh.userData.legs[1].rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
    }
  }

  /** True when something is stopped right ahead of this car. */
  _aheadBlocked(c, player) {
    const check = (ox, oz, oAxis, oAlong) => {
      if (oAxis !== c.axis) return false;
      const rel = (oAlong - c.along) * c.dir;
      if (rel < 0 || rel > 13) return false;
      const lat = c.axis === 'x' ? Math.abs(oz - (c.at + c.lane)) : Math.abs(ox - (c.at + c.lane));
      return lat < 3;
    };
    for (const o of this.cars) {
      if (o === c) continue;
      const oAlong = o.axis === 'x' ? o.mesh.position.x : o.mesh.position.z;
      if (check(o.mesh.position.x, o.mesh.position.z, o.axis, oAlong)) return true;
    }
    if (player && player.inCar) {
      const pAlong = c.axis === 'x' ? player.x : player.z;
      const px = player.x;
      const pz = player.z;
      if (check(px, pz, c.axis, pAlong)) return true;
    }
    return false;
  }

  /** Park a marked car at (x, z) for a job: it waits there to be stolen. */
  addMarkedCar(x, z) {
    const mesh = makeCarMesh(0xffd23e, { glow: 0xffd23e });
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.PI / 4;
    this.scene.add(mesh);
    this.cars.push({ mesh, axis: 'x', at: z, along: x, dir: 1, speed: 0, lane: 0, parked: true });
    return mesh;
  }

  /** Remove a traffic car from the road (it was stolen) and hand its mesh back. */
  stealNearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (!best) return null;
    this.cars.splice(this.cars.indexOf(best), 1);
    return best.mesh;
  }
}
