// The six jobs, the story in dialogue, and the places that answer E:
// respray clears heat, the hospital heals, the safehouse saves. The beacon
// marks the current objective; the tapes are the collectibles.

import * as THREE from '../vendor/three.module.js';
import { ECONOMY } from './config.js';

export const JOBS = [
  {
    name: 'LOW WATER',
    payout: 1200,
    giver: 'Ilya Kane',
    briefing: 'Mara. Three years gone, and Tidewater still owes you. Pip is waiting at Pier 9 with the package.',
    stages: [
      { type: 'goto', place: 'Pier 9', text: 'Meet Pip at Pier 9', say: 'Pip: Mara! You actually came back. Package is in the duffel. Don\'t open it.' },
      { type: 'drive', place: 'Neon Row Main', text: 'Drive the package to Neon Row', say: 'Ilya: Neon Row. The buyer is already there. No stops, no cops.' },
    ],
    outro: 'Ilya: Clean. The Ebb will hear about this. That is the point.',
  },
  {
    name: 'COLD CARGO',
    payout: 2800,
    giver: 'Ilya Kane',
    briefing: 'The Ebb moved guns through the Cannery. Take their lookouts down, then run the cargo to the Marina.',
    stages: [
      { type: 'goto', place: 'Cannery Yard', text: 'Reach the Cannery Yard', say: 'Pip: Three lookouts on the yard. They radio Hale if they see you.' },
      { type: 'clear', place: 'Cannery Yard', count: 3, text: 'Take out 3 Ebb lookouts', say: 'Ilya: Quiet and quick. The cargo is under the blue container.' },
      { type: 'drive', place: 'Marina Boardwalk', text: 'Drive the cargo to the Marina', say: 'Pip: Marina Boardwalk. The boat leaves at midnight, with or without you.' },
    ],
    outro: 'Ilya: The cargo is gone. Hale is asking questions. Good.',
  },
  {
    name: 'RISING TIDE',
    payout: 3600,
    giver: 'Pip',
    briefing: 'Dario Flint is showing off his new ride at the Causeway. Take a car, any car, and beat him there.',
    stages: [
      { type: 'steal', place: null, text: 'Steal a car (F near a parked car)', say: 'Pip: Any car. Just make it fast. Dario is already bragging.' },
      { type: 'drive', place: 'Causeway Toll', text: 'Drive to the Causeway Toll', say: 'Dario: Is that you, Voss? Still driving other people\'s cars?' },
      { type: 'goto', place: 'Spire Plaza', text: 'Lose the heat, reach Spire Plaza', say: 'Ilya: You beat him. Now vanish before Hale\'s units arrive.' },
    ],
    outro: 'Pip: Dario is furious. The whole Row is talking about you.',
  },
  {
    name: 'BLUE LIGHTS',
    payout: 4500,
    giver: 'Ilya Kane',
    briefing: 'Hale sent enforcers to the Spire. Clear them out, then get to the Hospital before they send more.',
    stages: [
      { type: 'goto', place: 'Spire Plaza', text: 'Reach Spire Plaza', say: 'Ilya: Four enforcers, all armed. The Spire belongs to us tonight.' },
      { type: 'clear', place: 'Spire Plaza', count: 4, text: 'Take out 4 Ebb enforcers', say: 'Pip: That\'s all of them. The plaza is yours, Mara.' },
      { type: 'drive', place: 'Hospital', text: 'Drive to the Hospital', say: 'Ilya: Get patched up. Hale will not stop at four.' },
    ],
    outro: 'Ilya: Hale is losing his grip on the Spire. Keep pushing.',
  },
  {
    name: 'HARBOR LIGHTS',
    payout: 6000,
    giver: 'Pip',
    briefing: 'The Ebb is loading a shipment at the Marina. Hit them hard, then bring the manifest to Pier 9.',
    stages: [
      { type: 'goto', place: 'Marina Boardwalk', text: 'Reach the Marina Boardwalk', say: 'Pip: Five of them guarding the crates. The manifest is in the red one.' },
      { type: 'clear', place: 'Marina Boardwalk', count: 5, text: 'Take out 5 Ebb guards', say: 'Ilya: The manifest names every cop Hale owns. Take it to the Pier.' },
      { type: 'drive', place: 'Pier 9', text: 'Drive the manifest to Pier 9', say: 'Pip: Pier 9. Ilya is waiting. This ends the Ebb\'s harbor.' },
    ],
    outro: 'Ilya: The manifest is in the right hands now. Hale is finished.',
  },
  {
    name: 'LAST TIDE',
    payout: 8000,
    giver: 'Ilya Kane',
    briefing: 'Dario Flint is at the Causeway with everything the Ebb has left. End it, Mara. Then come home.',
    stages: [
      { type: 'goto', place: 'Causeway Toll', text: 'Reach the Causeway Toll', say: 'Dario: Voss. One last race, one last fight. Let\'s finish this.' },
      { type: 'clear', place: 'Causeway Toll', count: 6, text: 'Take out Dario Flint and 5 Ebb', say: 'Dario: You were always faster, Mara. Always. Take the city.' },
      { type: 'drive', place: 'Safehouse', text: 'Drive home to the Safehouse', say: 'Ilya: It is done. Tidewater is yours again, Mara Voss.' },
    ],
    outro: 'Mara Voss came home. Tidewater will never forget the night the tide turned.',
  },
];

export class Missions {
  constructor(scene, world) {
    this.world = world;
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.jobsDone = 0;
    this.tapes = 0;
    this.sayQueue = [];
    this.sayText = '';
    this.sayTimer = 0;
    this.prompt = '';
    this.spawnedForStage = -1;
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x2de2ff, transparent: true, opacity: 0.35, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 60, 12, 1, true), beaconMat);
    this.beacon.position.y = 30;
    scene.add(this.beacon);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffe62d })
    );
    diamond.position.y = 6;
    this.beaconDiamond = diamond;
    scene.add(diamond);
    this.tapeMeshes = [];
    const tapeGeo = new THREE.BoxGeometry(0.5, 0.35, 0.08);
    for (const t of world.tapes) {
      const m = new THREE.Mesh(tapeGeo, new THREE.MeshBasicMaterial({ color: 0xffe62d }));
      m.position.set(t.x, 1.0, t.z);
      scene.add(m);
      this.tapeMeshes.push(m);
    }
    this.say(JOBS[0].briefing, JOBS[0].giver);
  }

  currentJob() {
    return JOBS[Math.min(this.jobIndex, JOBS.length - 1)];
  }

  currentStage() {
    const job = this.currentJob();
    return job.stages[Math.min(this.stageIndex, job.stages.length - 1)];
  }

  say(text, who) {
    this.sayQueue.push(who ? `${who}: ${text}` : text);
  }

  _targetPos() {
    const stage = this.currentStage();
    if (!stage.place) return null;
    return this.world.places[stage.place];
  }

  _advance(state) {
    const job = this.currentJob();
    this.stageIndex += 1;
    if (this.stageIndex >= job.stages.length) {
      state.player.cash += job.payout;
      state.rep += 1;
      this.jobsDone += 1;
      this.say(job.outro, job.giver);
      this.say(`Job complete: ${job.name} — $${job.payout.toLocaleString()}.`, null);
      state.audio.pickup();
      if (this.jobIndex < JOBS.length - 1) {
        this.jobIndex += 1;
        this.stageIndex = 0;
        const next = this.currentJob();
        this.say(next.briefing, next.giver);
      } else {
        this.say('All six jobs done. Tidewater is yours, Mara Voss.', null);
      }
    } else {
      const stage = this.currentStage();
      if (stage.say) this.say(stage.say, null);
    }
    this.spawnedForStage = -1;
  }

  update(dt, state) {
    if (this.sayTimer > 0) {
      this.sayTimer -= dt;
    } else if (this.sayQueue.length > 0) {
      this.sayText = this.sayQueue.shift();
      this.sayTimer = 4.5;
    }
    const p = state.player;
    const stage = this.currentStage();
    const target = this._targetPos();
    if (target) {
      this.beacon.position.set(target.x, 30, target.z);
      this.beaconDiamond.position.set(target.x, 6 + Math.sin(state.time * 2) * 0.5, target.z);
      this.beaconDiamond.rotation.y += dt * 1.5;
      this.beacon.visible = true;
      this.beaconDiamond.visible = true;
    } else {
      this.beacon.visible = false;
      this.beaconDiamond.visible = false;
    }
    if (stage.type === 'clear' && this.spawnedForStage !== this.stageIndex + this.jobIndex * 10) {
      state.combat.spawnSquad(target.x, target.z, stage.count, this.jobIndex >= 5);
      this.spawnedForStage = this.stageIndex + this.jobIndex * 10;
    }
    let done = false;
    if (target) {
      const dx = p.pos.x - target.x;
      const dz = p.pos.z - target.z;
      const dist = Math.hypot(dx, dz);
      if (stage.type === 'goto' && dist < 6) done = true;
      if (stage.type === 'drive' && dist < 6 && !p.onFoot) done = true;
    }
    if (stage.type === 'steal' && !p.onFoot) done = true;
    if (stage.type === 'clear' && state.combat.enemies.length === 0 && this.spawnedForStage >= 0) done = true;
    if (done) this._advance(state);

    for (let i = 0; i < this.world.tapes.length; i++) {
      const t = this.world.tapes[i];
      if (t.taken) continue;
      const dx = p.pos.x - t.x;
      const dz = p.pos.z - t.z;
      if (dx * dx + dz * dz < 6) {
        t.taken = true;
        this.tapeMeshes[i].visible = false;
        this.tapes += 1;
        p.cash += 50;
        this.say(`Tide Tape ${this.tapes}/${ECONOMY.tapeTotal} — +$50.`, null);
        state.audio.pickup();
      } else {
        this.tapeMeshes[i].rotation.y += dt;
      }
    }

    this.prompt = '';
    const places = this.world.places;
    const near = (name, r) => {
      const pl = places[name];
      const dx = p.pos.x - pl.x;
      const dz = p.pos.z - pl.z;
      return dx * dx + dz * dz < r * r;
    };
    if (near('Respray', 7)) {
      this.prompt = state.wanted > 0 ? 'E — Respray $200 (clears wanted)' : 'E — Respray $200';
      if (state.input.pressed('KeyE') && p.cash >= 200) {
        p.cash -= 200;
        state.wanted = 0;
        this.say('Respray done. Fresh paint, clean slate.', null);
      }
    } else if (near('Hospital', 7)) {
      this.prompt = 'E — Hospital $150 (full heal)';
      if (state.input.pressed('KeyE') && p.cash >= 150) {
        p.cash -= 150;
        p.health = 100;
        this.say('Patched up. Good as new.', null);
      }
    } else if (near('Safehouse', 7)) {
      this.prompt = 'E — Safehouse (save game)';
      if (state.input.pressed('KeyE')) {
        state.saveNow();
        this.say('Game saved at the Safehouse.', null);
      }
    } else if (state.input.pressed('KeyE')) {
      this.say('Nothing to use here.', null);
    }
  }

  distanceToTarget(state) {
    const target = this._targetPos();
    if (!target) return null;
    const dx = state.player.pos.x - target.x;
    const dz = state.player.pos.z - target.z;
    return Math.round(Math.hypot(dx, dz));
  }
}
