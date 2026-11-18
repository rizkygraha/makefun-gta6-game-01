// The HUD: everything drawn over the 3D view. Cash, stars, radio, minimap,
// dialogue, objective, weapon, prompts — plus the title screen and the full
// city map. All DOM and 2D canvas, so the screenshots capture it as played.

import { DISTRICTS, WEAPONS, RADIO, ECONOMY, WORLD } from './config.js';
import { JOBS } from './missions.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.cash = this.el('hud-cash');
    this.rep = this.el('hud-rep');
    this.clock = this.el('hud-clock');
    this.stars = this.el('hud-stars');
    this.radio = this.el('hud-radio');
    this.objective = this.el('hud-objective');
    this.dialogue = this.el('hud-dialogue');
    this.prompt = this.el('hud-prompt');
    this.weapon = this.el('hud-weapon');
    this.ammo = this.el('hud-ammo');
    this.healthFill = this.el('hud-health-fill');
    this.speed = this.el('hud-speed');
    this.crosshair = this.el('hud-crosshair');
    this.minimap = this.el('minimap');
    this.mapCanvas = this.el('map-canvas');
    this.title = this.el('title-screen');
    this.mapScreen = this.el('map-screen');
    this.hud = this.el('hud');
    this.onNewGame = null;
    this.onContinue = null;
    this.onResume = null;
    const nb = this.el('btn-new');
    const cb = this.el('btn-continue');
    const rb = this.el('btn-resume');
    if (nb) nb.addEventListener('click', () => this.onNewGame && this.onNewGame());
    if (cb) cb.addEventListener('click', () => this.onContinue && this.onContinue());
    if (rb) rb.addEventListener('click', () => this.onResume && this.onResume());
  }

  showTitle(save) {
    this.title.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.mapScreen.classList.add('hidden');
    const cb = this.el('btn-continue');
    if (cb) {
      cb.style.display = save ? '' : 'none';
      if (save) {
        cb.textContent = `CONTINUE — Ch.${save.jobIndex + 1} $${save.cash.toLocaleString()} Day ${save.day}`;
      }
    }
  }

  hideTitle() {
    this.title.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  showMap() {
    this.mapScreen.classList.remove('hidden');
  }

  hideMap() {
    this.mapScreen.classList.add('hidden');
  }

  update(state) {
    const p = state.player;
    this.cash.textContent = `$${p.cash.toLocaleString()}`;
    this.rep.textContent = `REP ${state.rep}`;
    const hh = String(Math.floor(state.dayTime / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(state.dayTime) % 60).padStart(2, '0');
    this.clock.textContent = `Day ${state.day} ${hh}:${mm}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    this.stars.textContent = stars;
    this.stars.style.color = state.wanted > 0 ? '#ff2d4d' : '#8a8f9e';
    this.radio.textContent = RADIO[state.radioStation].name;
    const job = state.missions.currentJob();
    const stage = state.missions.currentStage();
    const dist = state.missions.distanceToTarget(state);
    this.objective.textContent = `${job.name} — ${stage.text}${dist !== null ? ` (${dist}m)` : ''}`;
    this.dialogue.textContent = state.missions.sayText || '';
    this.dialogue.style.opacity = state.missions.sayText ? '1' : '0';
    this.prompt.textContent = state.missions.prompt || '';
    this.prompt.style.opacity = state.missions.prompt ? '1' : '0';
    const w = WEAPONS[p.weapon];
    this.weapon.textContent = w.name;
    this.ammo.textContent = w.ammo === Infinity ? '∞' : `${p.ammo[p.weapon]} / ${w.ammo}`;
    this.healthFill.style.width = `${Math.max(0, p.health)}%`;
    this.healthFill.style.background = p.health > 50 ? '#2dff8f' : p.health > 25 ? '#ffe62d' : '#ff2d4d';
    this.speed.textContent = p.onFoot ? '' : `${Math.round(Math.abs(p.speed) * 3.6)} km/h`;
    this.crosshair.style.display = p.onFoot && state.screen === 'play' ? '' : 'none';
    this._drawMinimap(state);
    if (!this.mapScreen.classList.contains('hidden')) this._drawMap(state);
  }

  _drawMinimap(state) {
    const ctx = this.minimap.getContext('2d');
    const S = this.minimap.width;
    const scale = S / 260;
    const px = state.player.pos.x;
    const pz = state.player.pos.z;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, S, S);
    const toX = (x) => S / 2 + (x - px) * scale;
    const toZ = (z) => S / 2 + (z - pz) * scale;
    ctx.fillStyle = '#06283a';
    ctx.fillRect(toX(-260), toZ(224), 520 * scale, 60 * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 7 * scale;
    for (let i = 0; i <= 12; i++) {
      const c = -WORLD.half + i * WORLD.block;
      ctx.beginPath();
      ctx.moveTo(toX(c), toZ(-WORLD.half));
      ctx.lineTo(toX(c), toZ(WORLD.half));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(-WORLD.half), toZ(c));
      ctx.lineTo(toX(WORLD.half), toZ(c));
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe62d';
    const target = state.missions._targetPos();
    if (target) {
      ctx.save();
      ctx.translate(toX(target.x), toZ(target.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    ctx.fillStyle = '#2de2ff';
    for (const t of state.world.tapes) {
      if (!t.taken) ctx.fillRect(toX(t.x) - 2, toZ(t.z) - 2, 4, 4);
    }
    ctx.fillStyle = '#ff2d4d';
    for (const u of state.police.units) {
      ctx.beginPath();
      ctx.arc(toX(u.x), toZ(u.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff2d2d';
    for (const e of state.combat.enemies) {
      ctx.beginPath();
      ctx.arc(toX(e.x), toZ(e.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawMap(state) {
    const ctx = this.mapCanvas.getContext('2d');
    const S = this.mapCanvas.width;
    const scale = S / (WORLD.half * 2 + 40);
    const toX = (x) => (x + WORLD.half + 20) * scale;
    const toZ = (z) => (z + WORLD.half + 20) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, S, S);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.accent + '22';
      ctx.fillRect(toX(d.x0), toZ(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
      ctx.fillStyle = d.accent;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(d.name.toUpperCase(), toX(d.x0) + 6, toZ(d.z0) + 18);
    }
    ctx.fillStyle = '#06283a';
    ctx.fillRect(0, toZ(224), S, S - toZ(224));
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 5 * scale;
    for (let i = 0; i <= 12; i++) {
      const c = -WORLD.half + i * WORLD.block;
      ctx.beginPath();
      ctx.moveTo(toX(c), toZ(-WORLD.half));
      ctx.lineTo(toX(c), toZ(WORLD.half));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(-WORLD.half), toZ(c));
      ctx.lineTo(toX(WORLD.half), toZ(c));
      ctx.stroke();
    }
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ffffff';
    for (const [name, pl] of Object.entries(state.world.places)) {
      ctx.fillStyle = '#ffe62d';
      ctx.beginPath();
      ctx.arc(toX(pl.x), toZ(pl.z), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, toX(pl.x) + 7, toZ(pl.z) + 4);
    }
    ctx.fillStyle = '#2de2ff';
    for (const t of state.world.tapes) {
      if (!t.taken) ctx.fillRect(toX(t.x) - 2, toZ(t.z) - 2, 4, 4);
    }
    const target = state.missions._targetPos();
    if (target) {
      ctx.strokeStyle = '#ffe62d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(state.player.pos.x), toZ(state.player.pos.z));
      ctx.lineTo(toX(target.x), toZ(target.z));
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(toX(state.player.pos.x), toZ(state.player.pos.z));
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const list = this.el('map-jobs');
    if (list) {
      list.innerHTML = JOBS.map((j, i) => {
        const done = i < state.missions.jobsDone;
        const cur = i === state.missions.jobIndex;
        const mark = done ? '✓' : cur ? '▶' : '○';
        return `<div class="map-job${cur ? ' cur' : ''}">${mark} ${j.name} — $${j.payout.toLocaleString()}${done ? ' — DONE' : ''}</div>`;
      }).join('');
    }
    const stats = this.el('map-stats');
    if (stats) {
      stats.textContent = `Cash $${state.player.cash.toLocaleString()} · REP ${state.rep} · Tide Tapes ${state.missions.tapes}/${ECONOMY.tapeTotal} · Jobs ${state.missions.jobsDone}/6 · Wanted ${'★'.repeat(state.wanted)}${'☆'.repeat(5 - state.wanted)}`;
    }
  }
}
