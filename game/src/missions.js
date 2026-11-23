// The six jobs: stages, objectives, dialogue and payouts. A job is three
// stages — reach, talk, fight, escape or deliver — and finishing one pays
// cash, adds REP and saves the game.
import { JOBS, REP_PER_JOB, TAPES_TOTAL, WANTED } from './config.js';
import { ACTION_INTERACT } from './input.js';
import { saveGame } from './save.js';
import { spawnEnemies } from './combat.js';

export function initMissions(G) {
  G.mission = {
    jobIndex: 0,
    stageIndex: 0,
    objective: null,
    kills: 0,
    dialogue: null,
    dialogueT: 0,
    storyDone: false,
    stageStarted: false,
  };
  setObjective(G);
}

export function currentJob(G) {
  return JOBS[G.mission.jobIndex] || null;
}

export function currentStage(G) {
  const job = currentJob(G);
  if (!job) return null;
  return job.stages[G.mission.stageIndex] || null;
}

export function refreshObjective(G) {
  setObjective(G);
}

function setObjective(G) {
  const stage = currentStage(G);
  const m = G.mission;
  m.stageStarted = false;
  if (!stage) { m.objective = null; return; }
  m.objective = { x: stage.x, z: stage.z, label: stage.label };
  if (stage.dialog) {
    m.dialogue = stage.dialog;
    m.dialogueT = 6;
  }
}

function startStage(G) {
  const stage = currentStage(G);
  const m = G.mission;
  m.stageStarted = true;
  if (!stage) return;
  if (stage.kind === 'fight') {
    m.kills = 0;
    spawnEnemies(G, stage.x, stage.z, stage.count, { boss: !!stage.boss });
  }
  if (stage.kind === 'escape') {
    // The stage needs heat to mean anything: Hale's units are already coming.
    if (G.heat < WANTED.heatPerStar) {
      G.heat = WANTED.heatPerStar + 4;
      G.lastCrime = G.time;
      G.wanted = 1;
    }
  }
}

function advanceStage(G) {
  const m = G.mission;
  const job = currentJob(G);
  m.stageIndex += 1;
  if (m.stageIndex >= job.stages.length) {
    // Job complete: pay out, add REP, save, move on.
    G.cash += job.payout;
    G.rep += REP_PER_JOB[job.id - 1] || 60;
    G.addMessage(`Job complete: ${job.name} — $${job.payout.toLocaleString()} paid.`);
    G.audio.sfx('payout');
    saveGame(G);
    m.jobIndex += 1;
    m.stageIndex = 0;
    if (m.jobIndex >= JOBS.length) {
      m.storyDone = true;
      m.objective = null;
      m.dialogue = { who: 'Ilya Kane', text: 'That is all six jobs, Mara. Tidewater is yours. Free roam — the city is open.' };
      m.dialogueT = 8;
      return;
    }
    const next = currentJob(G);
    G.addMessage(`New job: ${next.name} — $${next.payout.toLocaleString()}. ${next.brief}`);
  }
  setObjective(G);
}

export function updateMissions(G, actions, dt) {
  const m = G.mission;
  if (m.storyDone) return;
  if (!m.stageStarted) startStage(G);
  if (m.dialogueT > 0) {
    m.dialogueT -= dt;
    if (m.dialogueT <= 0) m.dialogue = null;
  }
  const stage = currentStage(G);
  if (!stage) return;
  const P = G.player;
  const dx = stage.x - P.x;
  const dz = stage.z - P.z;
  const dist = Math.hypot(dx, dz);
  if (stage.kind === 'goto' || stage.kind === 'deliver') {
    if (dist < 8) advanceStage(G);
  } else if (stage.kind === 'talk') {
    if (dist < 7 && (actions & ACTION_INTERACT)) advanceStage(G);
  } else if (stage.kind === 'fight') {
    if (m.kills >= stage.count) advanceStage(G);
  } else if (stage.kind === 'escape') {
    if (dist < 8) {
      if (G.wanted >= 1) advanceStage(G);
      else G.addMessage('You need heat for this run — steal a car or fire a shot first.');
    }
  }
  // Tide Tape collectibles.
  for (const tape of G.world.tapes) {
    if (tape.found) continue;
    if (Math.hypot(tape.x - P.x, tape.z - P.z) < 2.2) {
      tape.found = true;
      G.tapes += 1;
      G.cash += 50;
      G.audio.sfx('pickup');
      G.addMessage(`Tide Tape ${G.tapes}/${TAPES_TOTAL} — +$50.`);
    }
  }
}
