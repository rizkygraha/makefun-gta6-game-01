// NEON TIDE — missions.js
// Six jobs for Mara's crew, each in three stages: go somewhere, fight someone,
// or get away. A beacon marks the current objective, the HUD shows the job
// and the distance, and finishing a job pays cash and REP and unlocks the
// next one.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

const JOBS = [
  {
    name: 'LOW WATER', payout: 1200, giver: 'Ilya Kane',
    intro: [
      ['Ilya Kane', 'Mara. Three years gone and Tidewater still owes you.'],
      ['Ilya Kane', 'Small job first. Meet me at the Dockside crane.'],
    ],
    stages: [
      { kind: 'goto', spot: 'docksideMeet', text: 'Meet Ilya at the Dockside crane' },
      { kind: 'drive', spot: 'neonDrop', text: 'Drive the package to Neon Row' },
      { kind: 'escape', spot: 'safehouse', text: 'Lose the tail — reach the safehouse', heat: 2 },
    ],
  },
  {
    name: 'COLD CARGO', payout: 2800, giver: 'Ilya Kane',
    intro: [
      ['Ilya Kane', 'The Ebb are moving cargo through the Cannery. Take it.'],
      ['Ilya Kane', 'Their lookouts will not wave you through.'],
    ],
    stages: [
      { kind: 'goto', spot: 'canneryGate', text: 'Reach the Cannery gate' },
      { kind: 'fight', spot: 'ebbBlock', text: 'Clear the Ebb lookouts', foes: 3 },
      { kind: 'drive', spot: 'neonDrop', text: 'Deliver the cargo to Neon Row' },
    ],
  },
  {
    name: 'RISING TIDE', payout: 3600, giver: 'Pip',
    intro: [
      ['Pip', 'I built you a little present. It is on the Marina pier.'],
      ['Pip', 'Plant it on The Spire and Hale’s cameras go dark for an hour.'],
    ],
    stages: [
      { kind: 'pickup', spot: 'marinaPier', text: 'Pick up Pip’s device at the Marina pier (E)' },
      { kind: 'goto', spot: 'spireRoof', text: 'Plant the device at The Spire' },
      { kind: 'escape', spot: 'safehouse', text: 'Escape — reach the safehouse', heat: 2 },
    ],
  },
  {
    name: 'BLUE LIGHTS', payout: 4500, giver: 'Ilya Kane',
    intro: [
      ['Ilya Kane', 'The Ebb own a whole block in Neon Row tonight.'],
      ['Ilya Kane', 'Take it back. Loud is fine.'],
    ],
    stages: [
      { kind: 'fight', spot: 'ebbBlock', text: 'Clear the block in Neon Row', foes: 5 },
      { kind: 'goto', spot: 'hospital', text: 'Drop the wounded crew at the hospital' },
      { kind: 'escape', spot: 'safehouse', text: 'Get to the safehouse', heat: 2 },
    ],
  },
  {
    name: 'HARBOR LIGHTS', payout: 6000, giver: 'Dario Flint',
    intro: [
      ['Dario Flint', 'You still drive, Voss? Prove it. Three checkpoints.'],
      ['Dario Flint', 'Beat my time and the harbour is yours. Lose and walk.'],
    ],
    stages: [
      { kind: 'drive', spot: 'raceStart', text: 'Reach the race start' },
      { kind: 'drive', spot: 'marinaPier', text: 'Checkpoint 1 — Marina' },
      { kind: 'drive', spot: 'causewayEnd', text: 'Checkpoint 2 — The Causeway' },
    ],
  },
  {
    name: 'LAST TIDE', payout: 8000, giver: 'Ilya Kane',
    intro: [
      ['Ilya Kane', 'Dario sold us to Hale. He is at Dockside with his crew.'],
      ['Ilya Kane', 'End it tonight, Mara. Then we leave Tidewater rich.'],
    ],
    stages: [
      { kind: 'fight', spot: 'docksideMeet', text: 'Take down Dario Flint at Dockside', foes: 6, boss: true },
      { kind: 'drive', spot: 'causewayEnd', text: 'Drive to The Causeway for the handoff' },
      { kind: 'escape', spot: 'safehouse', text: 'Disappear — reach the safehouse', heat: 3 },
    ],
  },
];

export class Missions {
  constructor(game) {
    this.g = game;
    this.jobs = JOBS;
    this.jobIndex = game.saveData ? game.saveData.jobIndex : 0;
    this.stageIndex = 0;
    this.dialogue = [];
    this.dialogueT = 0;
    this.currentLine = null;
    this.foesDown = 0;
    // Objective beacon: a light pillar and a floating diamond.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    this.beacon.position.y = 35;
    game.scene.add(this.beacon);
    this.diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2),
      new THREE.MeshBasicMaterial({ color: 0xffe14d })
    );
    game.scene.add(this.diamond);
    this._startJob(this.jobIndex, false);
  }

  get currentJob() { return this.jobs[this.jobIndex] || null; }
  get currentStage() {
    const j = this.currentJob;
    return j ? j.stages[this.stageIndex] : null;
  }
  get done() { return this.jobIndex >= this.jobs.length; }

  _startJob(i, announce) {
    const job = this.jobs[i];
    if (!job) {
      this.beacon.visible = false;
      this.diamond.visible = false;
      this.g.hud.setObjective('ALL JOBS DONE', 'Tidewater is yours — free roam, collect the tapes');
      return;
    }
    this.stageIndex = 0;
    this.foesDown = 0;
    this.dialogue = job.intro.slice();
    this.dialogueT = 0;
    this.currentLine = null;
    if (announce) {
      this.g.banner('JOB ' + (i + 1) + ' — ' + job.name, job.giver + '  •  $' + job.payout.toLocaleString());
      this.g.audio.sfx('job');
    }
    this._startStage();
  }

  _startStage() {
    const s = this.currentStage;
    if (!s) return;
    const pos = this.g.world.spots[s.spot];
    this.beacon.position.set(pos.x, 35, pos.z);
    this.diamond.position.set(pos.x, 7, pos.z);
    this.beacon.visible = true;
    this.diamond.visible = true;
    if (s.kind === 'fight') {
      this.foesDown = 0;
      this.g.combat.spawnFoes(pos, s.foes, !!s.boss);
    }
    if (s.heat) {
      this.g.police.wanted = Math.max(this.g.police.wanted, s.heat);
      this.g.police.heat = 0;
      this.g.police.lastCrimeAt = this.g.time;
    }
    this.g.hud.setObjective(this.currentJob.name + ' — ' + s.text, '');
  }

  // Teleport the mission state for a shot (jobs 1-2 done, job 3 active).
  setForShot(jobIndex, stageIndex) {
    this.jobIndex = jobIndex;
    this._startJob(jobIndex, false);
    this.stageIndex = stageIndex;
    this._startStage();
    this.dialogue = [];
    this.currentLine = null;
  }

  update(dt) {
    const g = this.g;
    // Dialogue lines, one at a time.
    this.dialogueT += dt;
    if (this.dialogue.length > 0 && this.dialogueT > 4.5) {
      this.dialogueT = 0;
      this.currentLine = this.dialogue.shift();
      g.hud.showDialogue(this.currentLine[0], this.currentLine[1]);
    }
    if (this.done) return;
    const s = this.currentStage;
    if (!s) return;
    const pos = g.world.spots[s.spot];
    const dist = Math.hypot(g.player.pos.x - pos.x, g.player.pos.z - pos.z);
    g.hud.setObjective(this.currentJob.name + ' — ' + s.text, Math.round(dist) + ' m');
    // Beacon pulse.
    this.diamond.rotation.y += dt * 1.6;
    this.diamond.position.y = 7 + Math.sin(g.time * 2.2) * 0.5;
    this.beacon.material.opacity = 0.12 + Math.sin(g.time * 2.2) * 0.05;
    // Stage completion.
    if (s.kind === 'goto' || s.kind === 'drive' || s.kind === 'escape') {
      if (dist < 9) this._completeStage();
    } else if (s.kind === 'pickup') {
      if (dist < 9 && g.controls.interact) this._completeStage();
    } else if (s.kind === 'fight') {
      if (this.foesDown >= s.foes) this._completeStage();
    }
  }

  _completeStage() {
    const g = this.g;
    g.audio.sfx('stage');
    this.stageIndex++;
    if (this.stageIndex >= this.currentJob.stages.length) {
      this._completeJob();
    } else {
      this._startStage();
    }
  }

  _completeJob() {
    const g = this.g;
    const job = this.currentJob;
    g.cash += job.payout;
    g.rep += 25;
    g.banner('JOB COMPLETE — ' + job.name, '$' + job.payout.toLocaleString() + '  •  REP +25');
    g.audio.sfx('complete');
    g.saveProgress();
    this.jobIndex++;
    this._startJob(this.jobIndex, true);
  }
}
