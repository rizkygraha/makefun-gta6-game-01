// hud.js — everything on screen that is not the 3D world: the wanted
// stars, cash and REP, the objective line, dialogue, toasts, the circular
// minimap, the full city map screen, the title / pause / controls menus
// and the busted / wasted cards. All DOM; the game only calls update().

import { CFG, districtAt } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      wanted: $('wanted'),
      cash: $('cash'),
      rep: $('rep'),
      clock: $('clock'),
      radio: $('radio'),
      objective: $('objective'),
      objectiveDist: $('objective-dist'),
      dialogue: $('dialogue'),
      dialogueSpeaker: $('dialogue-speaker'),
      dialogueText: $('dialogue-text'),
      toast: $('toast'),
      healthFill: $('health-fill'),
      ammo: $('ammo'),
      crosshair: $('crosshair'),
      minimap: $('minimap'),
      vignette: $('vignette'),
      title: $('title'),
      pause: $('pause'),
      mapscreen: $('mapscreen'),
      controls: $('controls'),
      endcard: $('endcard'),
      endcardTitle: $('endcard-title'),
      endcardText: $('endcard-text'),
      continueBtn: $('btn-continue'),
      continueInfo: $('continue-info'),
      joblist: $('joblist'),
      mapstats: $('mapstats'),
    };
    this.mapCtx = $('mapcanvas').getContext('2d');
    this.miniCtx = this.el.minimap.getContext('2d');
    this.onMenu = null;
    this.dialogueUntil = 0;
    this.toastUntil = 0;
    this._wireButtons();
  }

  _wireButtons() {
    const click = (id, action) => {
      const b = $(id);
      if (b) b.addEventListener('click', () => this.onMenu && this.onMenu(action));
    };
    click('btn-continue', 'continue');
    click('btn-new', 'new');
    click('btn-controls', 'controls');
    click('btn-howto', 'howto');
    click('btn-resume', 'resume');
    click('btn-quit', 'quit');
    click('btn-close-map', 'close-map');
    click('btn-close-controls', 'close-controls');
    click('btn-endcard', 'endcard');
  }

  showTitle(save) {
    this.el.title.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
    this.el.mapscreen.classList.add('hidden');
    this.el.controls.classList.add('hidden');
    this.el.endcard.classList.add('hidden');
    if (save) {
      this.el.continueBtn.classList.remove('hidden');
      this.el.continueInfo.textContent = `Chapter ${save.chapter} — $${save.cash.toLocaleString()} — Day ${save.day}, ${save.time}`;
    } else {
      this.el.continueBtn.classList.add('hidden');
      this.el.continueInfo.textContent = 'No save yet — start a new game.';
    }
  }

  showPause() {
    this.el.pause.classList.remove('hidden');
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  hideTitle() {
    this.el.title.classList.add('hidden');
  }

  showEndcard(kind) {
    this.el.endcard.classList.remove('hidden');
    if (kind === 'busted') {
      this.el.endcardTitle.textContent = 'BUSTED';
      this.el.endcardText.textContent = 'Hale’s officers dragged you in. You lose $300 and the heat is gone.';
    } else {
      this.el.endcardTitle.textContent = 'WASTED';
      this.el.endcardText.textContent = 'You wake up at St. Mercy Hospital, patched up and $300 lighter.';
    }
  }

  hideEndcard() {
    this.el.endcard.classList.add('hidden');
  }

  setDialogue(speaker, text, now) {
    this.el.dialogueSpeaker.textContent = speaker;
    this.el.dialogueText.textContent = text;
    this.el.dialogue.classList.remove('hidden');
    this.dialogueUntil = now + 7;
  }

  showToast(text, now) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastUntil = now + 3.5;
  }

  damageFlash() {
    this.el.vignette.classList.remove('hidden');
    window.setTimeout(() => this.el.vignette.classList.add('hidden'), 180);
  }

  setCrosshair(on) {
    this.el.crosshair.classList.toggle('hidden', !on);
  }

  update(s) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.police.wanted ? '★' : '☆';
    this.el.wanted.textContent = stars;
    this.el.wanted.style.color = s.police.wanted >= 3 ? '#ff5566' : '#ffd23e';
    this.el.cash.textContent = `$${s.player.cash.toLocaleString()}`;
    this.el.rep.textContent = `REP ${s.player.rep}`;
    this.el.clock.textContent = `Day ${s.day} · ${s.clock}`;
    this.el.radio.textContent = `♪ ${s.station}`;
    // Objective.
    if (s.missions.objective) {
      this.el.objective.textContent = s.missions.objective;
      if (s.missions.target) {
        const d = Math.round(Math.hypot(s.player.x - s.missions.target[0], s.player.z - s.missions.target[1]));
        this.el.objectiveDist.textContent = `${d}m`;
      } else {
        this.el.objectiveDist.textContent = '';
      }
    } else if (s.missions.current) {
      this.el.objective.textContent = s.missions.current.name;
      this.el.objectiveDist.textContent = '';
    } else {
      const next = s.missions.jobs.find((j) => j.state === 'available');
      this.el.objective.textContent = next ? `Next job: ${next.name} — press M for the map` : 'All jobs done — free roam';
      this.el.objectiveDist.textContent = '';
    }
    // Health and ammo.
    this.el.healthFill.style.width = `${Math.max(0, s.player.health)}%`;
    const w = s.combat.weapon;
    const ammo = s.combat.ammo[s.combat.weaponIdx];
    this.el.ammo.textContent = w.mag === Infinity ? `${w.name} — ∞` : `${w.name} — ${ammo} / ${w.mag}`;
    // Timed dialogue and toasts.
    if (s.now > this.dialogueUntil) this.el.dialogue.classList.add('hidden');
    if (s.now > this.toastUntil) this.el.toast.classList.add('hidden');
    // Crosshair when on foot with a gun.
    this.setCrosshair(s.player.onFoot && s.combat.weapon.name !== 'Fists');
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const ctx = this.miniCtx;
    const R = 90;
    const scale = 0.75;
    ctx.clearRect(0, 0, 180, 180);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(0, 0, 180, 180);
    const px = s.player.x;
    const pz = s.player.z;
    const toX = (x) => R + (x - px) * scale;
    const toY = (z) => R + (z - pz) * scale;
    // Water.
    ctx.fillStyle = '#0a2e3d';
    ctx.fillRect(0, toY(470), 180, 180);
    // Roads.
    ctx.strokeStyle = '#2a2f3c';
    ctx.lineWidth = 5;
    for (let v = -450; v <= 450; v += CFG.city.roadEvery) {
      ctx.beginPath();
      ctx.moveTo(toX(v), 0);
      ctx.lineTo(toX(v), 180);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toY(v));
      ctx.lineTo(180, toY(v));
      ctx.stroke();
    }
    // Causeway.
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(440));
    ctx.lineTo(toX(0), toY(640));
    ctx.stroke();
    // Objective diamond.
    if (s.missions.target) {
      ctx.fillStyle = '#ffd23e';
      const ox = toX(s.missions.target[0]);
      const oy = toY(s.missions.target[1]);
      ctx.beginPath();
      ctx.moveTo(ox, oy - 7);
      ctx.lineTo(ox + 6, oy);
      ctx.lineTo(ox, oy + 7);
      ctx.lineTo(ox - 6, oy);
      ctx.closePath();
      ctx.fill();
    }
    // Police.
    for (const u of s.police.units) {
      ctx.fillStyle = '#5a7bff';
      ctx.beginPath();
      ctx.arc(toX(u.mesh.position.x), toY(u.mesh.position.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Foes.
    for (const e of s.combat.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = '#ff4455';
      ctx.beginPath();
      ctx.arc(toX(e.mesh.position.x), toY(e.mesh.position.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tapes nearby.
    ctx.fillStyle = '#22d3ee';
    for (const t of s.world.tapes) {
      if (t.taken) continue;
      if (Math.abs(t.x - px) > 130 || Math.abs(t.z - pz) > 130) continue;
      ctx.fillRect(toX(t.x) - 2, toY(t.z) - 2, 4, 4);
    }
    // The player, an arrow in the middle.
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(s.player.onFoot ? s.player.yaw : s.player.carHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  showMap(s) {
    this.el.mapscreen.classList.remove('hidden');
    const ctx = this.mapCtx;
    const W = 640;
    const H = 640;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(0, 0, W, H);
    const toX = (x) => ((x + 500) / 1000) * W;
    const toY = (z) => ((z + 500) / 1000) * H;
    // Water.
    ctx.fillStyle = '#0a2e3d';
    ctx.fillRect(0, toY(470), W, H - toY(470));
    // Districts.
    for (const d of CFG.districts) {
      ctx.fillStyle = `#${d.hue.toString(16).padStart(6, '0')}22`;
      ctx.fillRect(toX(d.x0), toY(d.z0), toX(d.x1) - toX(d.x0), toY(d.z1) - toY(d.z0));
      ctx.fillStyle = '#9fb4d8';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), (toX(d.x0) + toX(d.x1)) / 2, (toY(d.z0) + toY(d.z1)) / 2);
    }
    // Roads.
    ctx.strokeStyle = '#2a2f3c';
    ctx.lineWidth = 4;
    for (let v = -450; v <= 450; v += CFG.city.roadEvery) {
      ctx.beginPath();
      ctx.moveTo(toX(v), 0);
      ctx.lineTo(toX(v), H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toY(v));
      ctx.lineTo(W, toY(v));
      ctx.stroke();
    }
    // Causeway.
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(440));
    ctx.lineTo(toX(0), toY(640));
    ctx.stroke();
    // Route line to the objective.
    if (s.missions.target) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(toX(s.player.x), toY(s.player.z));
      ctx.lineTo(toX(s.missions.target[0]), toY(s.missions.target[1]));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(toX(s.missions.target[0]), toY(s.missions.target[1]) - 10);
      ctx.lineTo(toX(s.missions.target[0]) + 8, toY(s.missions.target[1]));
      ctx.lineTo(toX(s.missions.target[0]), toY(s.missions.target[1]) + 10);
      ctx.lineTo(toX(s.missions.target[0]) - 8, toY(s.missions.target[1]));
      ctx.closePath();
      ctx.fill();
    }
    // Job markers.
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    s.missions.jobs.forEach((j) => {
      const st = j.stages[0];
      if (!st || !st.target) return;
      const x = toX(st.target[0]);
      const y = toY(st.target[1]);
      ctx.fillStyle = j.state === 'done' ? '#39ff88' : j.state === 'active' ? '#ffd23e' : '#5a6b8a';
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0e18';
      ctx.fillText(String(j.id), x, y + 6);
    });
    // Activities.
    const mark = (x, z, color, label) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(x), toY(z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfe0ff';
      ctx.font = '11px monospace';
      ctx.fillText(label, toX(x), toY(z) - 10);
    };
    mark(CFG.safehouse[0], CFG.safehouse[1], '#39ff88', 'SAFEHOUSE');
    mark(CFG.respray[0], CFG.respray[1], '#ffb020', 'RESPRAY');
    mark(CFG.hospital[0], CFG.hospital[1], '#ffffff', 'HOSPITAL');
    mark(CFG.raceStart[0], CFG.raceStart[1], '#ff2d78', 'RACE');
    // The player.
    ctx.save();
    ctx.translate(toX(s.player.x), toY(s.player.z));
    ctx.rotate(s.player.onFoot ? s.player.yaw : s.player.carHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Job list and stats beside the map.
    this.el.joblist.innerHTML = s.missions.jobs
      .map((j) => {
        const state = j.state === 'done' ? '✓ DONE' : j.state === 'active' ? '▶ ACTIVE' : j.state === 'available' ? '○ OPEN' : '🔒 LOCKED';
        return `<div class="job ${j.state}"><b>${j.id}. ${j.name}</b> — $${j.payout.toLocaleString()} <span>${state}</span></div>`;
      })
      .join('');
    const tapesGot = s.world.tapes.filter((t) => t.taken).length;
    this.el.mapstats.innerHTML =
      `Tide Tapes ${tapesGot}/${CFG.tuning.tapeCount} · Properties ${s.properties}/2 · REP ${s.player.rep} · Cash $${s.player.cash.toLocaleString()}<br>` +
      `District: ${(districtAt(s.player.x, s.player.z) || { name: 'Harbor' }).name} · Wanted ${'★'.repeat(s.police.wanted)}${'☆'.repeat(5 - s.police.wanted)}`;
  }

  hideMap() {
    this.el.mapscreen.classList.add('hidden');
  }

  showControls() {
    this.el.controls.classList.remove('hidden');
  }

  hideControls() {
    this.el.controls.classList.add('hidden');
  }
}
