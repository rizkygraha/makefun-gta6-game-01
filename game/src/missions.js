// NEON TIDE — the six story jobs. A job is a list of stages; each stage is
// one of five kinds: goto (reach a place), interact (press E there), steal
// (press F on the marked car), combat (take out N enemies) or escape (get
// the heat to zero, sometimes against a timer). Completing a job pays cash
// and respect; the last job ends the story arc. Dialogue comes with the job.

import { JOBS, PLACES } from './config.js';

export function createMissions() {
  return {
    jobIndex: 0,
    stageIndex: 0,
    objective: null,
    dialog: null,
    timer: 0,
    done: false,
    kills: 0,
    message: null,
  };
}

function placePos(name) {
  const p = PLACES[name];
  return p ? { x: p.x, z: p.z, label: p.label } : null;
}

function currentJob(mission) {
  return JOBS[mission.jobIndex] ?? null;
}

function currentStage(mission) {
  const job = currentJob(mission);
  return job ? job.stages[mission.stageIndex] ?? null : null;
}

function stageObjective(mission) {
  const stage = currentStage(mission);
  if (!stage) return null;
  const pos = stage.at ? placePos(stage.at) : null;
  return {
    type: stage.type,
    text: stage.text,
    pos,
    count: stage.count ?? 0,
    kills: mission.kills,
    timed: stage.timed ?? 0,
  };
}

/** Start the current job: show its intro dialogue and first objective. */
export function startJob(game) {
  const mission = game.mission;
  const job = currentJob(mission);
  if (!job) {
    mission.done = true;
    mission.objective = null;
    mission.dialog = { who: 'ILYA KANE', role: 'FIXER', text: 'That is the last of it, Mara. Tidewater is yours now. Every tape, every street, every tide.' };
    return;
  }
  mission.stageIndex = 0;
  mission.kills = 0;
  mission.dialog = { ...job.intro };
  mission.objective = stageObjective(mission);
  if (mission.objective?.timed) mission.timer = mission.objective.timed;
}

/** Advance one stage; pay out when the job is done. */
function nextStage(game) {
  const mission = game.mission;
  mission.stageIndex += 1;
  const job = currentJob(mission);
  if (mission.stageIndex >= job.stages.length) {
    game.cash += job.pay;
    game.rep += 120;
    game.stats.jobsDone += 1;
    game.hudMessage = { text: 'JOB COMPLETE — ' + job.name + '   +$' + job.pay.toLocaleString('en-US'), ttl: 3 };
    mission.jobIndex += 1;
    startJob(game);
    return;
  }
  mission.kills = 0;
  mission.objective = stageObjective(mission);
  if (mission.objective?.timed) mission.timer = mission.objective.timed;
}

/** The player is close enough to the stage's place to act on it. */
function nearObjective(game) {
  const mission = game.mission;
  const obj = mission.objective;
  if (!obj?.pos) return false;
  const p = game.player.pos;
  return Math.hypot(obj.pos.x - p.x, obj.pos.z - p.z) < 7;
}

export function updateMissions(game, dt) {
  const mission = game.mission;
  if (mission.done) return;
  const stage = currentStage(mission);
  if (!stage) return;
  // Timed escape stages count down.
  if (stage.type === 'escape' && stage.timed) {
    mission.timer -= dt;
    if (mission.timer <= 0 && game.police.stars > 0) {
      mission.dialog = { who: 'JUNO REYES', role: 'WHEELWOMAN', text: 'The window closed — they made the car. Run, Mara. Get out of the search zone!' };
      mission.timer = stage.timed;
    }
  }
  if (stage.type === 'goto' && nearObjective(game)) nextStage(game);
  else if (stage.type === 'escape' && game.police.stars === 0) nextStage(game);
  else if (stage.type === 'combat' && mission.kills >= (stage.count ?? 0)) nextStage(game);
}

/** E pressed near an interact stage's place. */
export function tryInteract(game) {
  const mission = game.mission;
  const stage = currentStage(mission);
  if (!stage || stage.type !== 'interact') return false;
  if (!nearObjective(game)) return false;
  nextStage(game);
  return true;
}

/** F pressed near the marked car of a steal stage. */
export function tryStealStage(game) {
  const mission = game.mission;
  const stage = currentStage(mission);
  if (!stage || stage.type !== 'steal') return false;
  if (!nearObjective(game)) return false;
  nextStage(game);
  return true;
}

/** An enemy went down during a combat stage. */
export function reportKill(game) {
  const mission = game.mission;
  const stage = currentStage(mission);
  if (stage?.type === 'combat') {
    mission.kills += 1;
    if (mission.objective) mission.objective.kills = mission.kills;
  }
}

/** Jump straight to a job and stage (used to stage screenshots): recomputes
 * the objective and the intro dialogue for that job. */
export function jumpToStage(game, jobIndex, stageIndex, dialog) {
  const mission = game.mission;
  mission.jobIndex = jobIndex;
  mission.stageIndex = stageIndex;
  mission.kills = 0;
  mission.dialog = dialog ?? currentJob(mission)?.intro ?? null;
  mission.objective = stageObjective(mission);
  if (mission.objective?.timed) mission.timer = mission.objective.timed;
}

/** Human-readable job + stage for the HUD and the map screen. */
export function jobSummary(game) {
  const mission = game.mission;
  const job = currentJob(mission);
  if (!job) return { title: 'ALL JOBS DONE', line: 'Tidewater is yours', stage: '', done: true };
  const stage = currentStage(mission);
  return {
    title: 'CH ' + job.id + '  ' + job.name,
    line: stage ? stage.text : '',
    stage: 'STAGE ' + (mission.stageIndex + 1) + '/' + job.stages.length,
    pay: job.pay,
    done: false,
  };
}
