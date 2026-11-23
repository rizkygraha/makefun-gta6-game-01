// HUD, minimap, map screen and menu overlays. All DOM — the 3D canvas stays
// clean for the game itself. Text is rebuilt only when its value changes.
import { DISTRICTS, JOBS, RADIO_STATIONS, TAPES_TOTAL, WEAPONS, WEAPON_ORDER } from './config.js';
import { districtAt } from './world.js';

function el(id) { return document.getElementById(id); }

export function createHud(G) {
  const hud = {
    root: el('hud'),
    cash: el('hud-cash'),
    rep: el('hud-rep'),
    stars: el('hud-stars'),
    healthFill: el('hud-health-fill'),
    healthText: el('hud-health-text'),
    weapon: el('hud-weapon'),
    ammo: el('hud-ammo'),
    radio: el('hud-radio'),
    objective: el('hud-objective'),
    objectiveDist: el('hud-objective-dist'),
    dialogue: el('hud-dialogue'),
    dialogueWho: el('hud-dialogue-who'),
    dialogueText: el('hud-dialogue-text'),
    messages: el('hud-messages'),
    minimap: el('hud-minimap'),
    minimapWrap: el('hud-minimap-wrap'),
    bottomLeft: el('hud-bottom-left'),
    speed: el('hud-speed'),
    policeList: el('hud-police'),
    crosshair: el('hud-crosshair'),
    title: el('screen-title'),
    pause: el('screen-pause'),
    over: el('screen-over'),
    map: el('screen-map'),
    mapCanvas: el('map-canvas'),
    mapJobs: el('map-jobs'),
    mapStats: el('map-stats'),
    district: el('hud-district'),
    clock: el('hud-clock'),
    cache: {},
  };
  hud.minimapCtx = hud.minimap.getContext('2d');
  hud.mapCtx = hud.mapCanvas.getContext('2d');
  return hud;
}

function setText(node, key, value, cache) {
  if (cache[key] !== value) {
    cache[key] = value;
    node.textContent = value;
  }
}

function drawMinimap(hud, G) {
  const ctx = hud.minimapCtx;
  const S = 170;
  const toPx = (v) => ((v + 240) / 480) * S;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(6, 9, 20, 0.9)';
  ctx.fillRect(0, 0, S, S);
  // District tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color + '22';
    ctx.beginPath();
    ctx.arc(toPx(d.cx), toPx(d.cz), 26, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads.
  ctx.strokeStyle = 'rgba(160, 175, 220, 0.55)';
  ctx.lineWidth = 1.4;
  for (const v of G.world.lines) {
    ctx.beginPath(); ctx.moveTo(toPx(v), 0); ctx.lineTo(toPx(v), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toPx(v)); ctx.lineTo(S, toPx(v)); ctx.stroke();
  }
  // Tapes.
  ctx.fillStyle = '#2ec5ff';
  for (const t of G.world.tapes) {
    if (!t.found) ctx.fillRect(toPx(t.x) - 1, toPx(t.z) - 1, 2, 2);
  }
  // Traffic cars.
  ctx.fillStyle = 'rgba(230, 235, 250, 0.7)';
  for (const car of G.cars) {
    if (car.driver === 'traffic') ctx.fillRect(toPx(car.x) - 1.5, toPx(car.z) - 1.5, 3, 3);
  }
  // Police.
  ctx.fillStyle = '#ff3355';
  for (const u of G.policeUnits) {
    ctx.beginPath(); ctx.arc(toPx(u.x), toPx(u.z), 3, 0, Math.PI * 2); ctx.fill();
  }
  // Enemies.
  ctx.fillStyle = '#ff7722';
  for (const e of G.enemies) {
    if (e.alive) ctx.fillRect(toPx(e.x) - 2, toPx(e.z) - 2, 4, 4);
  }
  // Objective.
  const obj = G.mission.objective;
  if (obj) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(toPx(obj.x), toPx(obj.z), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(toPx(obj.x), toPx(obj.z), 7 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Player arrow.
  const px = toPx(G.player.x);
  const py = toPx(G.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMap(hud, G) {
  const ctx = hud.mapCtx;
  const W = hud.mapCanvas.width;
  const H = hud.mapCanvas.height;
  const toPx = (v) => ((v + 240) / 480) * W;
  const toPy = (v) => ((v + 240) / 480) * H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0d1d';
  ctx.fillRect(0, 0, W, H);
  // Districts.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color + '30';
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(toPx(d.cx), toPy(d.cz), 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = d.color;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name.toUpperCase(), toPx(d.cx), toPy(d.cz) - 34);
  }
  // Roads.
  ctx.strokeStyle = 'rgba(170, 185, 230, 0.5)';
  ctx.lineWidth = 2;
  for (const v of G.world.lines) {
    ctx.beginPath(); ctx.moveTo(toPx(v), 0); ctx.lineTo(toPx(v), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toPy(v)); ctx.lineTo(W, toPy(v)); ctx.stroke();
  }
  // Route line: player -> objective.
  const obj = G.mission.objective;
  if (obj) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(toPx(G.player.x), toPy(G.player.z));
    ctx.lineTo(toPx(obj.x), toPy(obj.z));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Job markers.
  JOBS.forEach((job, i) => {
    const stage = job.stages[0];
    const done = i < G.mission.jobIndex;
    const current = i === G.mission.jobIndex;
    ctx.fillStyle = done ? '#37e0a0' : current ? '#ffd23f' : '#5a6482';
    ctx.beginPath();
    ctx.arc(toPx(stage.x), toPy(stage.z), current ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0d1d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(job.id), toPx(stage.x), toPy(stage.z) + 4);
  });
  // Player marker.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(toPx(G.player.x), toPy(G.player.z), 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1fb6a6';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function updateHud(hud, G) {
  const c = hud.cache;
  const show = (node, on) => { node.style.display = on ? '' : 'none'; };
  show(hud.root, G.screen === 'play' || G.screen === 'map');
  show(hud.minimapWrap, G.screen === 'play');
  show(hud.bottomLeft, G.screen === 'play');
  show(hud.title, G.screen === 'title');
  show(hud.pause, G.screen === 'paused');
  show(hud.over, G.screen === 'over');
  show(hud.map, G.screen === 'map');
  if (G.screen !== 'play' && G.screen !== 'map') return;

  setText(hud.cash, 'cash', `$${G.cash.toLocaleString()}`, c);
  const repLevel = 1 + Math.floor(G.rep / 100);
  setText(hud.rep, 'rep', `REP ${repLevel} · ${G.rep}`, c);
  const stars = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  setText(hud.stars, 'stars', stars, c);
  hud.stars.className = G.wanted >= 3 ? 'stars hot' : 'stars';
  const hp = Math.max(0, Math.round(G.player.health));
  if (c.hp !== hp) {
    c.hp = hp;
    hud.healthFill.style.width = `${hp}%`;
    hud.healthFill.className = hp < 30 ? 'health-fill low' : 'health-fill';
    hud.healthText.textContent = `${hp}`;
  }
  const w = G.weapons;
  const def = WEAPONS[w.current];
  setText(hud.weapon, 'weapon', def.name, c);
  const ammo = w.current === 'fists' ? '—' : `${w.mag[w.current]} / ${w.reserve[w.current]}${w.reloadT > 0 ? ' …' : ''}`;
  setText(hud.ammo, 'ammo', ammo, c);
  const st = RADIO_STATIONS[G.radio.station];
  setText(hud.radio, 'radio', `♪ ${st.name} — ${st.desc}`, c);
  const d = districtAt(G.player.x, G.player.z);
  setText(hud.district, 'district', d.name, c);
  const hh = Math.floor(G.clock) % 24;
  const mm = Math.floor((G.clock % 1) * 60);
  setText(hud.clock, 'clock', `DAY ${G.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, c);

  // Objective banner.
  const job = JOBS[G.mission.jobIndex];
  if (job && G.mission.objective) {
    const stage = job.stages[G.mission.stageIndex];
    const dist = Math.round(Math.hypot(stage.x - G.player.x, stage.z - G.player.z));
    setText(hud.objective, 'obj', `JOB ${job.id} — ${job.name} · STAGE ${G.mission.stageIndex + 1}/${job.stages.length}`, c);
    let label = stage.label;
    if (stage.kind === 'fight') {
      label = stage.label.replace(/\(0\/\d+ down\)/, `(${G.mission.kills}/${stage.count} down)`);
    }
    setText(hud.objectiveDist, 'objd', `${label} · ${dist}m`, c);
  } else if (G.mission.storyDone) {
    setText(hud.objective, 'obj', 'FREE ROAM — all six jobs done. Tidewater is yours.', c);
    setText(hud.objectiveDist, 'objd', `Tide Tapes ${G.tapes}/${TAPES_TOTAL} · explore, race, collect`, c);
  }

  // Dialogue.
  const dlg = G.mission.dialogue;
  show(hud.dialogue, !!dlg);
  if (dlg) {
    setText(hud.dialogueWho, 'dlgwho', dlg.who, c);
    setText(hud.dialogueText, 'dlgtxt', dlg.text, c);
  }

  // Messages (toasts).
  const now = G.time;
  G.messages = G.messages.filter((m) => now - m.t < 4.5);
  const key = G.messages.map((m) => m.text).join('|');
  if (c.msgKey !== key) {
    c.msgKey = key;
    hud.messages.innerHTML = G.messages.map((m) => `<div class="toast">${m.text}</div>`).join('');
  }

  // Police list.
  const pkey = G.policeUnits.map((u) => `${u.name}:${u.state}:${Math.round(u.dist || 0)}`).join('|') + (G.heli ? '|HELI' : '');
  if (c.pkey !== pkey) {
    c.pkey = pkey;
    let html = '';
    if (G.heli) html += `<div class="police-unit heli">${G.heli.name} · OVERHEAD</div>`;
    for (const u of G.policeUnits) {
      html += `<div class="police-unit"><span>${u.name}</span><b class="state-${u.state}">${u.state}</b><i>${Math.round(u.dist || 0)}m</i></div>`;
    }
    hud.policeList.innerHTML = html;
  }

  // Speed + crosshair.
  if (!G.player.onFoot && G.player.car) {
    show(hud.speed, true);
    setText(hud.speed, 'speed', `${Math.round(Math.abs(G.player.car.speed) * 2.4)} mph`, c);
  } else {
    show(hud.speed, false);
  }
  show(hud.crosshair, G.player.onFoot && G.weapons.current !== 'fists');
  hud.crosshair.className = G.fx.hitMark > 0 ? 'crosshair hit' : 'crosshair';

  drawMinimap(hud, G);
  if (G.screen === 'map') {
    drawMap(hud, G);
    // Job list + stats on the map screen.
    const jkey = `${G.mission.jobIndex}:${G.mission.stageIndex}:${G.tapes}:${G.cash}`;
    if (c.jkey !== jkey) {
      c.jkey = jkey;
      hud.mapJobs.innerHTML = JOBS.map((j, i) => {
        const state = i < G.mission.jobIndex ? 'DONE' : i === G.mission.jobIndex ? 'ACTIVE' : 'LOCKED';
        return `<div class="map-job ${state.toLowerCase()}"><b>${j.id}. ${j.name}</b><span>$${j.payout.toLocaleString()}</span><i>${state}</i><p>${j.brief}</p></div>`;
      }).join('');
      hud.mapStats.innerHTML = `
        <div>Cash <b>$${G.cash.toLocaleString()}</b></div>
        <div>REP <b>${G.rep}</b> (Level ${1 + Math.floor(G.rep / 100)})</div>
        <div>Tide Tapes <b>${G.tapes}/${TAPES_TOTAL}</b></div>
        <div>Wanted <b>${'★'.repeat(G.wanted)}${'☆'.repeat(5 - G.wanted)}</b></div>
        <div>Health <b>${Math.round(G.player.health)}%</b></div>`;
    }
  }
}
