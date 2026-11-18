// NEON TIDE — world.js
// Tidewater: the city itself. A road grid, sidewalk blocks, low-poly buildings
// with lit windows, neon signs, lamps, the 16 Tide Tapes and the named places
// the missions stand on. Everything is generated from the seed, so the same
// seed always builds the same city. Also owns building collision (AABBs).

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

// A canvas texture of lit windows for building facades.
function windowTexture(rng, base, litA, litB) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 64, 128);
  for (let r = 0; r < 14; r++) {
    for (let col = 0; col < 6; col++) {
      const roll = rng.f();
      if (roll < 0.45) continue; // dark window
      x.fillStyle = roll < 0.75 ? litA : litB;
      x.globalAlpha = 0.55 + rng.f() * 0.45;
      x.fillRect(4 + col * 10, 4 + r * 9, 6, 5);
    }
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A glowing text sign (canvas texture) for a district name.
function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 128);
  x.font = 'bold 64px Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = color;
  x.shadowBlur = 26;
  x.fillStyle = color;
  x.fillText(text, 256, 66);
  x.shadowBlur = 6;
  x.fillStyle = '#ffffff';
  x.globalAlpha = 0.85;
  x.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(game) {
  const rng = game.rng;
  const P = CFG.palette;
  const W = CFG.world;
  const group = new THREE.Group();
  group.name = 'tidewater';
  const colliders = [];
  const tapes = [];

  // ---- ground: one dark asphalt plane for the whole city ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.half * 2 + 80, W.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: P.ground })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // ---- sidewalks: one raised slab per block ----
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: P.sidewalk });
  const lines = CFG.roadLines;
  const blockSlabs = [];
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + W.roadWidth / 2 + W.sidewalk;
      const x1 = lines[i + 1] - W.roadWidth / 2 - W.sidewalk;
      const z0 = lines[j] + W.roadWidth / 2 + W.sidewalk;
      const z1 = lines[j + 1] - W.roadWidth / 2 - W.sidewalk;
      if (x1 <= x0 || z1 <= z0) continue;
      blockSlabs.push([x0, z0, x1, z1]);
    }
  }
  const slabGeo = new THREE.BoxGeometry(1, 0.25, 1);
  for (const [x0, z0, x1, z1] of blockSlabs) {
    const slab = new THREE.Mesh(slabGeo, sidewalkMat);
    slab.scale.set(x1 - x0, 1, z1 - z0);
    slab.position.set((x0 + x1) / 2, 0.08, (z0 + z1) / 2);
    group.add(slab);
  }

  // ---- lane dashes: one InstancedMesh for every road centreline ----
  const dashGeo = new THREE.PlaneGeometry(0.35, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x8a94a8 });
  const dashCount = lines.length * 2 * 11;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const scl = new THREE.Vector3(1, 1, 1);
  let di = 0;
  for (const line of lines) {
    for (let k = 0; k < 11; k++) {
      const along = -200 + k * 40;
      // dash along a north-south road (x = line)
      eul.set(-Math.PI / 2, 0, 0);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(line, 0.02, along), q, scl);
      dashes.setMatrixAt(di++, m4);
      // dash along an east-west road (z = line)
      eul.set(-Math.PI / 2, 0, Math.PI / 2);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(along, 0.02, line), q, scl);
      dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  group.add(dashes);

  // ---- buildings ----
  const winTexs = [
    windowTexture(rng, '#0e1220', '#ffd76a', '#7de8ff'),
    windowTexture(rng, '#120e1a', '#ff9de2', '#ffd76a'),
    windowTexture(rng, '#0a1820', '#7de8ff', '#9dffb0'),
  ];
  const facadeCols = [P.buildingA, P.buildingB, P.buildingC];
  const neonCols = [P.neonPink, P.neonCyan, P.neonAmber, P.neonGreen, P.neonPurple];
  const signSpots = [];
  let buildingCount = 0;
  for (const [x0, z0, x1, z1] of blockSlabs) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    // District style by position.
    let district = CFG.districts[0];
    let best = Infinity;
    for (const d of CFG.districts) {
      const dd = Math.hypot(cx - d.cx, cz - d.cz);
      if (dd < best) { best = dd; district = d; }
    }
    const bw = x1 - x0 - W.blockInset * 2;
    const bd = z1 - z0 - W.blockInset * 2;
    if (bw <= 4 || bd <= 4) continue;
    // One main tower per block, sometimes a low annex.
    const lots = rng.chance(0.3) ? 2 : 1;
    for (let lot = 0; lot < lots; lot++) {
      const w = bw * (lots === 1 ? rng.range(0.55, 0.95) : rng.range(0.35, 0.5));
      const d = bd * (lots === 1 ? rng.range(0.55, 0.95) : rng.range(0.35, 0.5));
      let h;
      if (district.style === 'tower') h = rng.range(28, 62);
      else if (district.style === 'neon') h = rng.range(14, 42);
      else if (district.style === 'dock' || district.style === 'brick') h = rng.range(6, 16);
      else h = rng.range(8, 26);
      const ox = lots === 1 ? 0 : (lot === 0 ? -bw * 0.22 : bw * 0.22);
      const oz = lots === 1 ? 0 : (lot === 0 ? -bd * 0.22 : bd * 0.22);
      const tex = rng.pick(winTexs);
      const mat = new THREE.MeshLambertMaterial({
        color: rng.pick(facadeCols),
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.55,
        map: tex,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.set(cx + ox, h / 2 + 0.2, cz + oz);
      group.add(box);
      colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      buildingCount++;
      // Neon sign strip on tall neon-district buildings.
      if (district.style === 'neon' && h > 18 && rng.chance(0.55)) {
        const col = rng.pick(neonCols);
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, rng.range(1.2, 2.4), Math.min(w * 0.8, 9)),
          new THREE.MeshBasicMaterial({ color: col })
        );
        sign.position.set(cx + ox + w / 2 + 0.25, rng.range(h * 0.4, h * 0.8), cz + oz);
        group.add(sign);
      }
      // Record a tall building for a district text sign.
      if (h > 30 && signSpots.length < 3) signSpots.push({ x: cx + ox, z: cz + oz, h, w, face: rng.pick([0, 1]) });
    }
  }

  // ---- big glowing district signs on tall buildings ----
  const signDefs = [
    { text: 'NEON ROW', color: '#ff2ea6' },
    { text: 'TIDEWATER', color: '#22e6ff' },
    { text: 'THE SPIRE', color: '#b46bff' },
  ];
  signSpots.forEach((s, i) => {
    const def = signDefs[i % signDefs.length];
    const tex = signTexture(def.text, def.color);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
    );
    plane.position.set(s.x, s.h * 0.72, s.z + (s.face === 0 ? 0.3 : -0.3));
    if (s.face === 1) plane.rotation.y = Math.PI;
    group.add(plane);
  });

  // ---- street lamps at every other intersection ----
  const lampPole = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const lampHead = new THREE.SphereGeometry(0.32, 8, 6);
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < lines.length; i += 2) {
    for (let j = 0; j < lines.length; j += 2) {
      const x = lines[i] + 6.5;
      const z = lines[j] + 6.5;
      const pole = new THREE.Mesh(lampPole, lampMat);
      pole.position.set(x, 2.7, z);
      group.add(pole);
      const head = new THREE.Mesh(lampHead, lampGlow);
      head.position.set(x, 5.5, z);
      group.add(head);
    }
  }

  // ---- a few real point lights at the busiest crossings (neon glow) ----
  const glowDefs = [
    { x: 0, z: 0, c: 0xff2ea6 },
    { x: -40, z: 40, c: 0x22e6ff },
    { x: 40, z: -40, c: 0xffb020 },
    { x: 0, z: 180, c: 0xff9f1c },
  ];
  for (const gd of glowDefs) {
    const pl = new THREE.PointLight(gd.c, 90, 75, 2);
    pl.position.set(gd.x, 7, gd.z);
    group.add(pl);
  }

  // ---- Tide Tapes: 16 glowing collectibles on sidewalks ----
  const tapeGeo = new THREE.BoxGeometry(0.7, 0.45, 0.12);
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  const tapeSpots = [];
  let guard = 0;
  while (tapeSpots.length < CFG.tapesTotal && guard++ < 400) {
    const line = rng.pick(lines);
    const along = rng.range(-200, 200);
    const side = rng.sign();
    const x = rng.chance(0.5) ? line + side * 7.2 : along;
    const z = rng.chance(0.5) ? along : line + side * 7.2;
    if (Math.abs(x) > 215 || Math.abs(z) > 215) continue;
    if (tapeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 18)) continue;
    tapeSpots.push({ x, z });
  }
  for (const t of tapeSpots) {
    const mesh = new THREE.Mesh(tapeGeo, tapeMat);
    mesh.position.set(t.x, 1.1, t.z);
    mesh.rotation.y = rng.range(0, Math.PI);
    group.add(mesh);
    tapes.push({ x: t.x, z: t.z, mesh, taken: false, spin: rng.range(0.5, 1.5) });
  }

  // ---- named spots (mission places) as Vector3s on roads ----
  const spots = {};
  for (const [name, [sx, sz]] of Object.entries(CFG.spots)) {
    spots[name] = new THREE.Vector3(sx, 0, sz);
  }

  // ---- district lookup for the map/HUD ----
  const districts = CFG.districts.map((d) => ({ name: d.name, cx: d.cx, cz: d.cz, r: d.r, color: d.color }));

  // Push a circle (x,z,r) out of every building AABB it overlaps.
  function collideCircle(x, z, r) {
    for (const b of colliders) {
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.minX - r;
          else if (m === pr) x = b.maxX + r;
          else if (m === pt) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    // Keep inside the city.
    x = Math.max(-W.half, Math.min(W.half, x));
    z = Math.max(-W.half, Math.min(W.half, z));
    return { x, z };
  }

  // Nearest point on any road centreline.
  function nearestRoadPoint(x, z) {
    let bx = lines[0], bz = z, bd = Infinity;
    for (const line of lines) {
      const d = Math.abs(x - line);
      if (d < bd) { bd = d; bx = line; bz = z; }
    }
    for (const line of lines) {
      const d = Math.abs(z - line);
      if (d < bd) { bd = d; bx = x; bz = line; }
    }
    return { x: bx, z: bz };
  }

  const world = {
    group, colliders, tapes, spots, districts, buildingCount,
    roadLines: lines,
    collideCircle, nearestRoadPoint,
    update(dt, time) {
      // Tapes bob and spin.
      for (const t of tapes) {
        if (t.taken) continue;
        t.mesh.rotation.y += dt * t.spin;
        t.mesh.position.y = 1.1 + Math.sin(time * 2 + t.x) * 0.15;
      }
    },
  };
  game.scene.add(group);
  return world;
}
