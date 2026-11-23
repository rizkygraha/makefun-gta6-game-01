// Wanted level and the Tidewater PD. Heat 0–170 maps to 0–5 stars; crimes add
// heat, quiet time sheds it. NAMED units chase with a state — PURSUIT when
// far, RAMMING when close and fast, ROADBLOCK when you outrun them — and a
// helicopter, AIR-1 'NIGHTHAWK', joins at 3 stars.
import { HELI_NAME, POLICE_NAMES, WANTED } from './config.js';
import { clampToCity, collideBuildings, nearestRoadPoint } from './world.js';
import { makeCar } from './traffic.js';

export function initPolice(G) {
  G.wanted = 0;
  G.heat = 0;
  G.lastCrime = -100;
  G.policeUnits = [];
  G.heli = null;
  G.police = {
    addHeat,
  };
}

export function addHeat(G, amount) {
  G.heat = Math.max(0, Math.min(WANTED.maxStars * WANTED.heatPerStar, G.heat + amount));
  if (amount > 2) G.lastCrime = G.time;
  const stars = Math.min(WANTED.maxStars, Math.floor(G.heat / WANTED.heatPerStar));
  if (stars !== G.wanted) {
    const rose = stars > G.wanted;
    G.wanted = stars;
    // Announce rises only, throttled, so the toast list never spams.
    if (rose && G.time - (G.lastWantedMsg || -10) > 4) {
      G.lastWantedMsg = G.time;
      if (stars >= 3) G.addMessage(`Wanted level ${stars} — the whole department is coming.`);
    } else if (stars === 0 && !rose) {
      G.addMessage('You lost them. The heat is off.');
    }
  }
}

function spawnUnit(G, index) {
  const P = G.player;
  // Spawn on a road 55–80 units away, roughly behind the player.
  const angle = Math.atan2(P.x, P.z) + Math.PI + (G.rng() - 0.5) * 1.6;
  const dist = 55 + G.rng() * 25;
  const spot = nearestRoadPoint(P.x + Math.sin(angle) * dist, P.z + Math.cos(angle) * dist);
  const car = makeCar(spot.x, spot.z, Math.atan2(P.x - spot.x, P.z - spot.z), 0xf2f4f8, 'police');
  car.police = true;
  car.name = POLICE_NAMES[index % POLICE_NAMES.length];
  car.state = 'PURSUIT';
  car.speed = 20;
  G.cars.push(car);
  return car;
}

export function updatePolice(G, dt) {
  // Quiet time sheds heat.
  if (G.time - G.lastCrime > 6) addHeat(G, -WANTED.decayPerSec * dt);

  const want = G.wanted > 0 ? Math.min(G.wanted + 1, 5) : 0;
  // Spawn up to the wanted count.
  while (G.policeUnits.length < want) {
    G.policeUnits.push(spawnUnit(G, G.policeUnits.length));
  }
  // Despawn extras (furthest first) when the heat drops.
  while (G.policeUnits.length > want) {
    const P = G.player;
    let worst = 0;
    let worstD = -1;
    G.policeUnits.forEach((u, i) => {
      const d = Math.hypot(u.x - P.x, u.z - P.z);
      if (d > worstD) { worstD = d; worst = i; }
    });
    const [gone] = G.policeUnits.splice(worst, 1);
    const idx = G.cars.indexOf(gone);
    if (idx >= 0) G.cars.splice(idx, 1);
  }

  const P = G.player;
  const pSpeed = P.onFoot ? Math.hypot(P.vx, P.vz) : Math.abs(P.car ? P.car.speed : 0);
  for (const u of G.policeUnits) {
    const dx = P.x - u.x;
    const dz = P.z - u.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    u.dist = dist;
    // State: ramming when close and the player is moving, roadblock when the
    // player is fast and far, pursuit otherwise.
    if (dist < 14 && pSpeed > 6) u.state = 'RAMMING';
    else if (dist > 45 && pSpeed > 18) u.state = 'ROADBLOCK';
    else u.state = 'PURSUIT';

    let tx;
    let tz;
    let targetSpeed;
    if (u.state === 'RAMMING') {
      const lead = 1.2;
      tx = P.x + Math.sin(P.heading) * pSpeed * lead * 0.4;
      tz = P.z + Math.cos(P.heading) * pSpeed * lead * 0.4;
      targetSpeed = 38;
    } else if (u.state === 'ROADBLOCK') {
      tx = P.x + Math.sin(P.heading) * 26;
      tz = P.z + Math.cos(P.heading) * 26;
      targetSpeed = dist > 30 ? 34 : 0;
      if (dist < 30) {
        // Park across the road ahead of the player.
        u.heading += (Math.atan2(tx - u.x, tz - u.z) - u.heading) * Math.min(1, 3 * dt);
        u.speed = Math.max(0, u.speed - 30 * dt);
        u.x += Math.sin(u.heading) * u.speed * dt;
        u.z += Math.cos(u.heading) * u.speed * dt;
        continue;
      }
    } else {
      tx = P.x;
      tz = P.z;
      targetSpeed = 30;
    }
    const wantHeading = Math.atan2(tx - u.x, tz - u.z);
    let diff = wantHeading - u.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3));
    u.speed += Math.max(-26 * dt, Math.min(16 * dt, targetSpeed - u.speed));
    const nx = u.x + Math.sin(u.heading) * u.speed * dt;
    const nz = u.z + Math.cos(u.heading) * u.speed * dt;
    const res = collideBuildings(G.world, nx, nz, 1.6);
    if (res.hit) u.speed *= 0.5;
    u.x = res.x;
    u.z = res.z;
    const c = clampToCity(u.x, u.z, 3);
    u.x = c.x;
    u.z = c.z;
    // Ramming contact: shove the player, chip health on foot. Throttled so a
    // police car glued to the player cannot grind them to a halt.
    if (dist < 4.6 && G.time - (G.lastPoliceBump || -10) > 0.6) {
      G.lastPoliceBump = G.time;
      if (!P.onFoot && P.car) {
        P.car.speed *= 0.82;
        addHeat(G, 2);
        G.audio.sfx('crash');
      } else if (G.time - (G.lastRam || 0) > 1.2) {
        G.lastRam = G.time;
        P.health -= 6;
        G.addMessage('A patrol car clipped you!');
        G.audio.sfx('crash');
      }
    }
  }

  // Helicopter at 3+ stars.
  if (G.wanted >= 3 && !G.heli) {
    G.heli = { x: P.x + 20, z: P.z - 20, heading: 0, name: HELI_NAME };
    G.addMessage(`${HELI_NAME} is overhead.`);
  } else if (G.wanted < 3 && G.heli) {
    G.heli = null;
  }
  if (G.heli) {
    const h = G.heli;
    h.x += (P.x - h.x) * Math.min(1, 0.7 * dt);
    h.z += (P.z - h.z) * Math.min(1, 0.7 * dt);
    h.heading = Math.atan2(P.x - h.x, P.z - h.z);
  }
}
