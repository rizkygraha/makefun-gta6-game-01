// NEON TIDE — the HUD: every panel, the minimap, the dialogue box, the
// title screen, the city map, pause and game over. All DOM, painted over
// the WebGL canvas; the 3D scene never draws text.

import { CITY, CREW, DISTRICTS, HALF, JOBS, PLACES, RADIO, WEAPONS, districtAt } from './config.js';
import { jobSummary } from './missions.js';

const $ = (id) => document.getElementById(id);

function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

function fmtClock(day, clockSeconds) {
  const total = Math.floor(clockSeconds);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  return 'DAY ' + day + '  ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function drawCityMap(ctx, size, game, big) {
  const scale = size / (CITY + 60);
  const px = (v) => (v + CITY / 2 + 30) * scale;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#070a13';
  ctx.fillRect(0, 0, size, size);
  // Water east.
  ctx.fillStyle = '#06121f';
  ctx.fillRect(px(HALF), 0, size - px(HALF), size);
  // Blocks.
  ctx.fillStyle = '#171a22';
  for (let bx = -168; bx <= 168; bx += 48) {
    for (let bz = -168; bz <= 168; bz += 48) {
      ctx.fillRect(px(bx - 18), px(bz - 18), 36 * scale, 36 * scale);
    }
  }
  // Roads.
  ctx.strokeStyle = '#2a2f3d';
  ctx.lineWidth = Math.max(1, 12 * scale);
  for (let v = -192; v <= 192; v += 48) {
    ctx.beginPath(); ctx.moveTo(px(v), 0); ctx.lineTo(px(v), size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, px(v)); ctx.lineTo(size, px(v)); ctx.stroke();
  }
  // District labels.
  if (big) {
    ctx.fillStyle = 'rgba(238,241,245,0.75)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) ctx.fillText(d.name, px(d.cx), px(d.cz));
  }
  // Tide Tapes.
  for (const tape of game.world.tapes) {
    if (tape.taken) continue;
    ctx.fillStyle = '#b78cff';
    ctx.beginPath(); ctx.arc(px(tape.x), px(tape.z), big ? 4 : 2, 0, Math.PI * 2); ctx.fill();
  }
  // Places.
  const place = (name, color, r) => {
    const p = PLACES[name];
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px(p.x), px(p.z), r, 0, Math.PI * 2); ctx.fill();
  };
  place('safehouse', '#3dff8e', big ? 6 : 3);
  place('respray', '#ff9a5c', big ? 5 : 2.5);
  place('hospital', '#ff4d5e', big ? 5 : 2.5);
  // Route to the objective.
  const obj = game.mission.objective?.pos;
  if (obj) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = big ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(px(game.player.pos.x), px(game.player.pos.z));
    ctx.lineTo(px(obj.x), px(obj.z));
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(px(obj.x), px(obj.z), big ? 7 : 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('!', px(obj.x), px(obj.z) + 3.5);
  }
  // Traffic.
  ctx.fillStyle = 'rgba(238,241,245,0.7)';
  for (const car of game.cars) {
    if (car.kind !== 'traffic') continue;
    ctx.beginPath(); ctx.arc(px(car.x), px(car.z), big ? 2.5 : 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff4d5e';
  for (const car of game.police.units) {
    ctx.beginPath(); ctx.arc(px(car.x), px(car.z), big ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = game.player.pos;
  ctx.save();
  ctx.translate(px(p.x), px(p.z));
  ctx.rotate(Math.atan2(Math.sin(game.player.angle), -Math.cos(game.player.angle)) + Math.PI);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, big ? -9 : -6);
  ctx.lineTo(big ? 7 : 5, big ? 7 : 5);
  ctx.lineTo(0, big ? 3 : 2);
  ctx.lineTo(big ? -7 : -5, big ? 7 : 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createHud() {
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  const mapCanvas = $('map-canvas');
  const mapCtx = mapCanvas.getContext('2d');
  let dialogTtl = 0;
  let messageTtl = 0;

  // Crew cards on the title screen.
  const crewEl = $('crew');
  for (const member of CREW) {
    const card = document.createElement('div');
    card.className = 'card';
    const initial = member.name.split(' ').map((w) => w[0]).join('');
    card.innerHTML = '<div class="face" style="background:' + member.color + '">' + initial + '</div>'
      + '<div class="name">' + member.name + '</div><div class="role">' + member.role + '</div>';
    crewEl.appendChild(card);
  }
  // Weapon slots.
  const weaponsEl = $('weapons');
  for (const w of WEAPONS) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (w.slot > 1 ? ' locked' : '');
    slot.id = 'weapon-' + w.slot;
    slot.innerHTML = '<span class="n">' + (w.slot + 1) + '</span> ' + w.name + '<span class="a"></span>';
    weaponsEl.appendChild(slot);
  }

  function setDialog(dialog) {
    const box = $('dialogue');
    if (!dialog) {
      box.classList.add('hidden');
      return;
    }
    const color = (CREW.find((c) => c.name === dialog.who)?.color) || '#22e6ff';
    $('dlg-portrait').style.background = color;
    $('dlg-portrait').textContent = dialog.who.split(' ').map((w) => w[0]).join('');
    $('dlg-who').innerHTML = dialog.who + ' <span>' + dialog.role + '</span>';
    $('dlg-text').textContent = dialog.text;
    box.classList.remove('hidden');
    dialogTtl = 7;
  }

  function update(game, dt) {
    // Cash, clock, stars.
    $('cash').textContent = fmtCash(game.cash);
    $('clock').textContent = fmtClock(game.day, game.clock);
    const stars = $('stars');
    let starHtml = '';
    for (let s = 0; s < 5; s += 1) starHtml += '<span class="' + (s < game.police.stars ? 'lit' : '') + '">★</span>';
    stars.innerHTML = starHtml;

    // Mission panel.
    const summary = jobSummary(game);
    $('job-title').textContent = summary.title;
    $('job-objective').textContent = summary.line || '—';
    const job = JOBS[game.mission.jobIndex];
    $('job-sub').textContent = summary.stage + (job ? ' · ' + fmtCash(job.pay) : '');
    const bar = $('stage-bar');
    const stageCount = job ? job.stages.length : 1;
    while (bar.children.length < stageCount) bar.appendChild(document.createElement('i'));
    while (bar.children.length > stageCount) bar.removeChild(bar.lastChild);
    for (let i = 0; i < stageCount; i += 1) bar.children[i].className = i < game.mission.stageIndex ? 'done' : '';
    const timerEl = $('job-timer');
    if (game.mission.objective?.timed && game.mission.timer > 0) {
      timerEl.classList.remove('hidden');
      timerEl.textContent = 'TIME ' + Math.ceil(game.mission.timer) + 's';
    } else {
      timerEl.classList.add('hidden');
    }

    // Police panel.
    const pp = $('police-panel');
    if (game.police.stars > 0) {
      pp.classList.remove('hidden');
      $('police-count').textContent = game.police.units.length + ' UNITS · CODE ' + game.police.stars;
      const list = $('police-list');
      list.innerHTML = game.police.units.map((car) => {
        const d = Math.round(Math.hypot(car.x - game.player.pos.x, car.z - game.player.pos.z));
        return '<div class="unit"><span>▸ ' + car.unitName + '</span><span>' + d + ' m</span><span class="badge ' + car.state + '">' + car.state + '</span></div>';
      }).join('') + (game.police.heli.active ? '<div class="unit"><span>▸ ' + 'AIR-1' + '</span><span>ABOVE</span><span class="badge">HELI</span></div>' : '');
    } else {
      pp.classList.add('hidden');
    }

    // District + rep + health.
    const district = districtAt(game.player.pos.x, game.player.pos.z);
    const dEl = $('district');
    dEl.textContent = district.name;
    dEl.style.color = district.color;
    $('rep-fill').style.width = Math.min(100, (game.rep % 1000) / 10) + '%';
    $('rep-label').textContent = 'REP ' + Math.floor(game.rep / 1000);
    $('health-label').textContent = 'HEALTH ' + Math.round(game.player.health);

    // Radio + speed + condition.
    const station = RADIO[game.radio.station];
    $('radio').innerHTML = station.name + ' · ' + station.show + '<br><span class="track">' + station.track + '</span>';
    if (game.player.inCar && game.player.car) {
      const kmh = Math.round(Math.abs(game.player.car.speed) * 3.6);
      const speedEl = $('speed');
      speedEl.classList.remove('hidden');
      speedEl.innerHTML = kmh + ' <small>KM/H</small>';
      $('cond-bar').classList.remove('hidden');
      $('cond-label').classList.remove('hidden');
      $('cond-fill').style.width = Math.round(game.player.car.condition ?? 100) + '%';
      $('cond-label').lastElementChild.textContent = 'CONDITION ' + Math.round(game.player.car.condition ?? 100) + '%';
    } else {
      $('speed').classList.add('hidden');
      $('cond-bar').classList.add('hidden');
      $('cond-label').classList.add('hidden');
    }

    // Weapons: fists + pistol from the start, SMG from job 3, shotgun from job 5.
    for (const w of WEAPONS) {
      const slot = $('weapon-' + w.slot);
      slot.classList.toggle('active', game.player.weapon === w.slot);
      const locked = (w.slot === 2 && game.mission.jobIndex < 2) || (w.slot === 3 && game.mission.jobIndex < 4);
      slot.classList.toggle('locked', locked);
      const ammo = slot.querySelector('.a');
      ammo.textContent = Number.isFinite(game.player.mag[w.slot]) ? game.player.mag[w.slot] + '/' + game.player.ammo[w.slot] : '∞';
    }

    // Crosshair on foot only.
    $('crosshair').classList.toggle('hidden', game.player.inCar);

    // Dialogue lifetime.
    if (dialogTtl > 0) {
      dialogTtl -= dt;
      if (dialogTtl <= 0) $('dialogue').classList.add('hidden');
    }
    // Transient message.
    if (game.hudMessage) {
      $('message').textContent = game.hudMessage.text;
      $('message').classList.remove('hidden');
      messageTtl = game.hudMessage.ttl;
      game.hudMessage = null;
    } else if (messageTtl > 0) {
      messageTtl -= dt;
      if (messageTtl <= 0) $('message').classList.add('hidden');
    }

    // Context prompt.
    const prompt = $('prompt');
    let promptText = '';
    if (!game.player.inCar) {
      for (const car of game.cars) {
        if (car.kind === 'police') continue;
        if (Math.hypot(car.x - game.player.pos.x, car.z - game.player.pos.z) < 4.5) {
          promptText = car.wasTraffic ? 'F — STEAL THIS CAR' : 'F — GET IN';
          break;
        }
      }
      if (!promptText && game.mission.objective?.type === 'interact' && game.mission.objective?.pos && Math.hypot(game.mission.objective.pos.x - game.player.pos.x, game.mission.objective.pos.z - game.player.pos.z) < 7) {
        promptText = 'E — ' + (game.mission.objective.text || 'INTERACT');
      }
    }
    if (promptText) {
      prompt.textContent = promptText;
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }

    // Minimap.
    drawCityMap(mctx, 188, game, false);
  }

  function drawMap(game) {
    drawCityMap(mapCtx, 640, game, true);
    const jobsEl = $('map-jobs');
    jobsEl.innerHTML = JOBS.map((job, i) => {
      const state = i < game.mission.jobIndex ? 'Complete' : i === game.mission.jobIndex ? 'In progress' : 'Locked';
      return '<div class="job' + (i === game.mission.jobIndex ? ' cur' : '') + '"><span class="pay">' + fmtCash(job.pay) + '</span>'
        + (i + 1) + '. ' + job.name + '<div class="st">' + state + '</div></div>';
    }).join('');
    $('map-stats').innerHTML = 'Cash <b>' + fmtCash(game.cash) + '</b><br>Respect level <b>' + Math.floor(game.rep / 1000) + '</b><br>'
      + 'Tide Tapes <b>' + game.stats.tapes + ' / 16</b><br>Properties <b>' + game.stats.properties + ' / 2</b><br>Jobs done <b>' + game.stats.jobsDone + ' / 6</b>';
    const summary = jobSummary(game);
    $('map-current').innerHTML = '<b style="color:#ffd166">CURRENT JOB</b><br><b>' + summary.title + '</b><br>' + summary.line
      + '<br><span style="color:#8b93a3">' + summary.stage + '</span>';
  }

  function setContinue(save) {
    const sub = $('continue-sub');
    if (save) {
      const d = new Date(save.savedAt);
      sub.textContent = 'Job ' + (save.jobIndex + 1) + ' · ' + fmtCash(save.cash) + ' · Day ' + save.day + ' · saved ' + d.toLocaleDateString('en-GB');
    } else {
      sub.textContent = 'No save yet';
    }
  }

  function showScreen(name) {
    $('hud').classList.toggle('hidden', name !== 'play');
    $('title-screen').classList.toggle('hidden', name !== 'title');
    $('map-screen').classList.toggle('hidden', name !== 'map');
    $('pause-screen').classList.toggle('hidden', name !== 'paused');
    $('over-screen').classList.toggle('hidden', name !== 'over');
  }

  function announce(text) {
    $('status').textContent = text;
  }

  return { update, setDialog, drawMap, setContinue, showScreen, announce };
}
