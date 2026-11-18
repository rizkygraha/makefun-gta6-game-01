// NEON TIDE — hud.js
// Everything Mara sees on top of the 3D view: cash, REP, clock, wanted stars,
// radio, the job objective, health and ammo, the circular minimap, dialogue,
// banners and the full city map screen. All DOM; the 3D view never draws UI.

import { CFG } from './config.js';

function el(id) { return document.getElementById(id); }

export class HUD {
  constructor(game) {
    this.g = game;
    this.objectiveText = '';
    this.objectiveDist = '';
    this.dialogueT = 0;
    this.bannerT = 0;
    this.flashT = 0;
    this.hitT = 0;
    const mm = el('minimap');
    this.mm = mm ? mm.getContext('2d') : null;
    const mc = el('map-canvas');
    this.mc = mc ? mc.getContext('2d') : null;
    this._wireButtons();
  }

  _wireButtons() {
    const g = this.g;
    const on = (id, fn) => { const b = el(id); if (b) b.addEventListener('click', fn); };
    on('continue-btn', () => g.startFromSave());
    on('newgame-btn', () => g.startNewGame());
    on('resume-btn', () => g.togglePause());
    on('restart-btn', () => g.startNewGame());
    on('quit-title-btn', () => g.showTitle());
    on('howto-btn', () => {
      const h = el('title-howto');
      if (h) h.style.display = h.style.display === 'none' ? 'block' : 'none';
    });
  }

  setObjective(text, dist) {
    this.objectiveText = text;
    this.objectiveDist = dist;
  }

  showDialogue(who, text) {
    const box = el('dialogue');
    if (!box) return;
    el('dialogue-who').textContent = who;
    el('dialogue-text').textContent = text;
    box.style.display = 'block';
    this.dialogueT = 4.5;
  }

  banner(text, sub) {
    const b = el('banner');
    if (!b) return;
    el('banner-text').textContent = text;
    el('banner-sub').textContent = sub || '';
    b.style.display = 'block';
    b.style.opacity = '1';
    this.bannerT = 3.2;
  }

  flashObjective(text) {
    const f = el('flash');
    if (!f) return;
    f.textContent = text;
    f.style.display = 'block';
    this.flashT = 2.2;
  }

  hitMarker(hit) {
    const c = el('crosshair');
    if (!c) return;
    c.style.borderColor = hit ? '#ff3344' : '#ffffff';
    c.style.transform = 'translate(-50%, -50%) scale(1.5)';
    this.hitT = 0.12;
  }

  // ---- screens ----
  showTitle(saveData) {
    el('title-screen').style.display = 'flex';
    el('hud').style.display = 'none';
    el('map-screen').style.display = 'none';
    el('pause-screen').style.display = 'none';
    const cont = el('continue-btn');
    const info = el('continue-info');
    if (saveData) {
      cont.style.display = 'block';
      info.textContent = 'Chapter ' + (saveData.chapter || 1) + '  •  $' + (saveData.cash || 0).toLocaleString() + '  •  Day ' + (saveData.day || 1);
    } else {
      cont.style.display = 'none';
      info.textContent = 'No save yet — start a new game.';
    }
  }

  hideTitle() {
    el('title-screen').style.display = 'none';
    el('hud').style.display = 'block';
  }

  showMap(open) {
    el('map-screen').style.display = open ? 'flex' : 'none';
    if (open) this._fillMapJobs();
  }

  showPause(open) {
    el('pause-screen').style.display = open ? 'flex' : 'none';
  }

  _fillMapJobs() {
    const list = el('map-jobs');
    if (!list) return;
    const g = this.g;
    let html = '';
    g.missions.jobs.forEach((job, i) => {
      let state = 'LOCKED';
      if (i < g.missions.jobIndex) state = 'DONE';
      else if (i === g.missions.jobIndex) state = 'ACTIVE';
      html += '<div class="map-job ' + state.toLowerCase() + '"><b>' + (i + 1) + '. ' + job.name + '</b>'
        + '<span>$' + job.payout.toLocaleString() + ' — ' + job.giver + '</span>'
        + '<em>' + state + '</em></div>';
    });
    list.innerHTML = html;
    el('map-stats').textContent = 'Cash $' + g.cash.toLocaleString()
      + '  •  REP ' + g.rep
      + '  •  Tide Tapes ' + g.tapes + '/' + CFG.tapesTotal
      + '  •  Wanted ' + '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
  }

  update(dt) {
    const g = this.g;
    // Timers.
    if (this.dialogueT > 0) {
      this.dialogueT -= dt;
      if (this.dialogueT <= 0) { const b = el('dialogue'); if (b) b.style.display = 'none'; }
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      const b = el('banner');
      if (b) {
        if (this.bannerT < 0.8) b.style.opacity = String(Math.max(0, this.bannerT / 0.8));
        if (this.bannerT <= 0) b.style.display = 'none';
      }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      const f = el('flash');
      if (f && this.flashT <= 0) f.style.display = 'none';
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) {
        const c = el('crosshair');
        if (c) { c.style.borderColor = '#ffffff'; c.style.transform = 'translate(-50%, -50%) scale(1)'; }
      }
    }
    // Numbers.
    el('cash').textContent = '$' + g.cash.toLocaleString();
    el('rep').textContent = 'REP ' + g.rep;
    const h = Math.floor(g.timeMinutes / 60) % 24;
    const m = Math.floor(g.timeMinutes % 60);
    el('clock').textContent = 'Day ' + g.day + '  ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    el('wanted').textContent = '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
    el('wanted').style.color = g.police.wanted > 0 ? '#ff3344' : '#5a6b8a';
    el('radio').textContent = '♪ ' + CFG.radio[g.radioStation].name;
    el('objective-text').textContent = this.objectiveText;
    el('objective-dist').textContent = this.objectiveDist;
    // Health + ammo.
    const hp = Math.max(0, Math.round(g.player.health));
    el('health-fill').style.width = hp + '%';
    el('health-fill').style.background = hp > 50 ? '#37d67a' : hp > 25 ? '#ffb020' : '#ff3344';
    el('health-num').textContent = hp;
    const w = g.combat.weapon;
    const mag = g.combat.mag[g.combat.current];
    const res = g.combat.reserve[g.combat.current];
    el('ammo').textContent = w.name + '  ' + (mag === Infinity ? '∞' : mag + ' / ' + res);
    // Crosshair only on foot with a gun, while playing.
    const ch = el('crosshair');
    if (ch) ch.style.display = (g.state === 'play' && g.player.mode === 'foot' && g.combat.current > 0) ? 'block' : 'none';
    // Speed when driving.
    const sp = el('speed');
    if (sp) {
      if (g.player.mode === 'car') {
        sp.style.display = 'block';
        sp.textContent = Math.round(Math.abs(g.player.speed) * 3.6) + ' KM/H';
      } else sp.style.display = 'none';
    }
    // Context prompt.
    this._updatePrompt();
    // Minimap.
    this._drawMinimap();
    if (g.state === 'map') this._drawMap();
  }

  _updatePrompt() {
    const g = this.g;
    const pr = el('prompt');
    if (!pr) return;
    let text = '';
    if (g.state === 'play') {
      if (g.player.mode === 'foot') {
        const car = g.player.nearestCar();
        if (car) text = car.isPlayerCar ? 'F — Enter your car' : 'F — Steal car (heat +1)';
        else {
          const s = g.missions.currentStage;
          if (s && s.kind === 'pickup') {
            const pos = g.world.spots[s.spot];
            if (Math.hypot(g.player.pos.x - pos.x, g.player.pos.z - pos.z) < 9) text = 'E — Pick up';
          }
        }
      } else {
        text = 'F — Get out  •  SPACE — Handbrake';
      }
      if (!text) text = 'M — Map  •  Q — Radio  •  V — Camera  •  1-4 — Weapons';
    }
    pr.textContent = text;
    pr.style.display = text ? 'block' : 'none';
  }

  _drawMinimap() {
    if (!this.mm) return;
    const g = this.g;
    const ctx = this.mm;
    const S = 180;
    const scale = S / 470;
    const ox = S / 2, oy = S / 2;
    const X = (x) => ox + x * scale;
    const Z = (z) => oy + z * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a1024';
    ctx.fillRect(0, 0, S, S);
    // District tints.
    for (const d of g.world.districts) {
      ctx.beginPath();
      ctx.arc(X(d.cx), Z(d.cz), d.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#16203a';
      ctx.fill();
    }
    // Roads.
    ctx.strokeStyle = '#3a4358';
    ctx.lineWidth = 5;
    for (const line of CFG.roadLines) {
      ctx.beginPath(); ctx.moveTo(X(line), Z(-220)); ctx.lineTo(X(line), Z(220)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-220), Z(line)); ctx.lineTo(X(220), Z(line)); ctx.stroke();
    }
    // Tapes.
    ctx.fillStyle = '#ffe14d';
    for (const t of g.world.tapes) {
      if (t.taken) continue;
      ctx.fillRect(X(t.x) - 1.5, Z(t.z) - 1.5, 3, 3);
    }
    // Traffic.
    ctx.fillStyle = '#ffffff';
    for (const c of g.traffic.cars) {
      ctx.fillRect(X(c.mesh.position.x) - 1.5, Z(c.mesh.position.z) - 1.5, 3, 3);
    }
    // Police.
    for (const u of g.police.units) {
      ctx.fillStyle = '#3a86ff';
      ctx.beginPath();
      ctx.arc(X(u.mesh.position.x), Z(u.mesh.position.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Objective.
    const s = g.missions.currentStage;
    if (s) {
      const pos = g.world.spots[s.spot];
      ctx.fillStyle = '#ffe14d';
      ctx.save();
      ctx.translate(X(pos.x), Z(pos.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // Player arrow.
    const p = g.player;
    ctx.save();
    ctx.translate(X(p.pos.x), Z(p.pos.z));
    ctx.rotate(p.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawMap() {
    if (!this.mc) return;
    const g = this.g;
    const ctx = this.mc;
    const S = 560;
    const scale = S / 470;
    const ox = S / 2, oy = S / 2;
    const X = (x) => ox + x * scale;
    const Z = (z) => oy + z * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a1024';
    ctx.fillRect(0, 0, S, S);
    // Districts with labels.
    ctx.textAlign = 'center';
    for (const d of g.world.districts) {
      ctx.beginPath();
      ctx.arc(X(d.cx), Z(d.cz), d.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#131c33';
      ctx.fill();
      ctx.strokeStyle = '#2a3a5e';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#8fa8d8';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(d.name.toUpperCase(), X(d.cx), Z(d.cz));
    }
    // Roads.
    ctx.strokeStyle = '#4a556e';
    ctx.lineWidth = 7;
    for (const line of CFG.roadLines) {
      ctx.beginPath(); ctx.moveTo(X(line), Z(-220)); ctx.lineTo(X(line), Z(220)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-220), Z(line)); ctx.lineTo(X(220), Z(line)); ctx.stroke();
    }
    ctx.strokeStyle = '#8a94a8';
    ctx.lineWidth = 1;
    for (const line of CFG.roadLines) {
      ctx.beginPath(); ctx.moveTo(X(line), Z(-220)); ctx.lineTo(X(line), Z(220)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-220), Z(line)); ctx.lineTo(X(220), Z(line)); ctx.stroke();
    }
    // Job markers.
    ctx.font = 'bold 12px Arial';
    g.missions.jobs.forEach((job, i) => {
      const st = job.stages[0];
      const pos = g.world.spots[st.spot];
      const done = i < g.missions.jobIndex;
      const active = i === g.missions.jobIndex;
      ctx.fillStyle = done ? '#37d67a' : active ? '#ffe14d' : '#5a6b8a';
      ctx.beginPath();
      ctx.arc(X(pos.x), Z(pos.z), 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a1024';
      ctx.fillText(String(i + 1), X(pos.x), Z(pos.z) + 4);
    });
    // Tapes.
    ctx.fillStyle = '#ffe14d';
    for (const t of g.world.tapes) {
      if (t.taken) continue;
      ctx.fillRect(X(t.x) - 2, Z(t.z) - 2, 4, 4);
    }
    // Route line: player to the objective.
    const s = g.missions.currentStage;
    if (s) {
      const pos = g.world.spots[s.spot];
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(X(g.player.pos.x), Z(g.player.pos.z));
      ctx.lineTo(X(pos.x), Z(pos.z));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Police.
    for (const u of g.police.units) {
      ctx.fillStyle = '#3a86ff';
      ctx.beginPath();
      ctx.arc(X(u.mesh.position.x), Z(u.mesh.position.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    ctx.save();
    ctx.translate(X(g.player.pos.x), Z(g.player.pos.z));
    ctx.rotate(g.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('MARA VOSS', X(g.player.pos.x) + 12, Z(g.player.pos.z) + 4);
  }
}
