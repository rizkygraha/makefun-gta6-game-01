// missions.js — the six story jobs: stages, objectives, the beacon that
// marks the target, dialogue and payouts. A job is a list of stages; each
// stage completes on a rule (drive there, interact, steal, clear the foes,
// hold the yard, lose the heat) and the next one begins.

import * as THREE from 'three';
import { CFG } from './config.js';

export class Missions {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.jobs = CFG.jobs.map((j) => ({ ...j, state: j.id === 1 ? 'available' : 'locked' }));
    this.current = null;
    this.stageIdx = 0;
    this.target = null;
    this.objective = '';
    this.events = [];
    this.holdT = 0;
    this.timer = 0;

    // The beacon: a glowing pillar over the current target.
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.3 });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 12, 1, true), mat);
    this.beacon.position.y = 17;
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    this.diamond.position.y = 8;
    this.diamond.visible = false;
    scene.add(this.diamond);
  }

  /** Start a job by id. Returns false when it is not available. */
  startJob(id, ctx) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || (job.state !== 'available' && job.state !== 'active')) return false;
    this.current = job;
    job.state = 'active';
    this.stageIdx = 0;
    this.events.push({ type: 'dialogue', speaker: job.giver, text: job.intro });
    this._enterStage(ctx);
    return true;
  }

  _enterStage(ctx) {
    const stage = this.current.stages[this.stageIdx];
    this.objective = stage.objective;
    this.target = stage.target ? [...stage.target] : null;
    this.holdT = 0;
    this.timer = stage.timed ?? 0;
    if (stage.kind === 'combat' && ctx?.combat) {
      ctx.combat.spawnFoes(stage.foes, this.target);
    }
    if (stage.kind === 'boss' && ctx?.combat) {
      ctx.combat.spawnBoss(this.target);
    }
    if (stage.kind === 'steal' && ctx?.traffic) {
      ctx.traffic.addMarkedCar(this.target[0], this.target[1]);
    }
    if (stage.kind === 'escape' && ctx?.police) {
      ctx.police.addHeat(24);
    }
    if (this.target) {
      this.beacon.position.set(this.target[0], 17, this.target[1]);
      this.beacon.visible = true;
      this.diamond.position.set(this.target[0], 8, this.target[1]);
      this.diamond.visible = true;
    } else {
      this.beacon.visible = false;
      this.diamond.visible = false;
    }
  }

  _advance(ctx) {
    this.stageIdx += 1;
    if (this.stageIdx >= this.current.stages.length) {
      this._completeJob(ctx);
      return;
    }
    this.events.push({ type: 'toast', text: this.current.stages[this.stageIdx].objective });
    this._enterStage(ctx);
  }

  _completeJob(ctx) {
    const job = this.current;
    job.state = 'done';
    ctx.player.addCash(job.payout);
    ctx.player.addRep(1);
    this.events.push({ type: 'toast', text: `${job.name} complete — $${job.payout.toLocaleString()}` });
    this.events.push({ type: 'dialogue', speaker: job.giver, text: 'Clean. The money is yours. The next one is waiting when you are.' });
    const next = this.jobs.find((j) => j.id === job.id + 1);
    if (next) next.state = 'available';
    this.current = null;
    this.target = null;
    this.objective = '';
    this.beacon.visible = false;
    this.diamond.visible = false;
    if (ctx.onJobDone) ctx.onJobDone(job);
  }

  update(dt, ctx) {
    // Animate the beacon.
    if (this.diamond.visible) {
      this.diamond.rotation.y += dt * 2;
      this.diamond.position.y = 8 + Math.sin(ctx.time * 2) * 0.6;
    }
    if (!this.current) return;
    const stage = this.current.stages[this.stageIdx];
    const p = ctx.player;
    const dist = this.target ? Math.hypot(p.x - this.target[0], p.z - this.target[1]) : 9999;

    if (stage.timed) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = stage.timed;
        this.events.push({ type: 'toast', text: 'Too slow — run it again' });
        return;
      }
    }

    switch (stage.kind) {
      case 'drive':
        if (dist < 14) this._advance(ctx);
        break;
      case 'interact':
        if (dist < 7 && ctx.interactPressed) this._advance(ctx);
        break;
      case 'steal':
        if (ctx.stoleCar) this._advance(ctx);
        break;
      case 'combat':
        if (ctx.combat && ctx.combat.foesAlive() === 0) this._advance(ctx);
        break;
      case 'boss':
        if (ctx.combat && ctx.combat.bossDown) this._advance(ctx);
        break;
      case 'hold':
        if (dist < 14) {
          this.holdT += dt;
          if (this.holdT >= (stage.holdSec ?? 10)) this._advance(ctx);
        } else {
          this.holdT = 0;
        }
        break;
      case 'escape':
        if (ctx.police && ctx.police.wanted === 0) this._advance(ctx);
        break;
      default:
        break;
    }
  }

  /** The job list the map screen shows, with states. */
  jobStates() {
    return this.jobs.map((j) => ({ id: j.id, name: j.name, payout: j.payout, state: j.state }));
  }

  /** Jump a job to a stage (used by staged screenshots). */
  setStage(jobId, stageIdx, ctx) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return false;
    this.current = job;
    job.state = 'active';
    this.stageIdx = stageIdx;
    this._enterStage(ctx);
    return true;
  }

  /** Drain the dialogue/toast events queued this frame. */
  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
