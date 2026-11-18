// world.js — builds Tidewater: the ground with its road grid, the
// buildings with lit windows, neon signs, streetlights, the harbor water,
// the Causeway bridge, parked cars and the Tide Tapes. Also the car mesh
// factory every vehicle (player, traffic, police) is built from, and the
// building colliders the player and cars slide against.

import * as THREE from 'three';
import { CFG, districtAt } from './config.js';

const SIGN_WORDS = ['NEON', 'TIDE', 'BAR', '24H', 'HOTEL', 'RAMEN', 'CLUB', 'PIER', 'NOVA', 'VOLT', 'LUNA', 'DOCK'];
const NEON_COLORS = ['#ff2d78', '#22d3ee', '#ffb020', '#39ff88', '#c084fc'];

/** A canvas texture of a building facade: dark wall, a grid of windows, some lit. */
function facadeTexture(rng, litChance) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#12141b';
  g.fillRect(0, 0, 128, 256);
  // A lit shopfront band at the bottom of most facades.
  if (rng.chance(0.7)) {
    g.fillStyle = rng.pick(['#ff2d78', '#22d3ee', '#ffb020', '#39ff88']);
    g.globalAlpha = 0.85;
    g.fillRect(0, 228, 128, 28);
    g.globalAlpha = 1;
  }
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 8 + col * 20;
      const y = 8 + row * 18;
      if (rng.chance(litChance)) {
        g.fillStyle = rng.pick(['#ffd27a', '#9be8ff', '#ff9ecf', '#c9f7d4']);
        g.fillRect(x, y, 12, 10);
      } else {
        g.fillStyle = '#07080d';
        g.fillRect(x, y, 12, 10);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A glowing sign texture with one word on it. */
function signTexture(word, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = 'bold 44px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(word, 128, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.85;
  g.fillText(word, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The ground: one canvas texture with asphalt, roads, dashes, sidewalks. */
function groundTexture(rng) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  // World x/z in [-500, 500] map to canvas [0, 1024].
  const toPx = (v) => ((v + 500) / 1000) * S;
  g.fillStyle = '#0b0d12';
  g.fillRect(0, 0, S, S);
  const { roadEvery, roadWidth } = CFG.city;
  // Roads: lighter strips along every avenue and street.
  g.fillStyle = '#14171f';
  for (let v = -450; v <= 450; v += roadEvery) {
    g.fillRect(toPx(v - roadWidth / 2), 0, toPx(roadWidth) - toPx(0), S);
    g.fillRect(0, toPx(v - roadWidth / 2), S, toPx(roadWidth) - toPx(0));
  }
  // Sidewalk borders around each block.
  g.strokeStyle = '#1d212b';
  g.lineWidth = 3;
  for (let x = -450; x <= 450; x += roadEvery) {
    for (let z = -450; z <= 450; z += roadEvery) {
      g.strokeRect(toPx(x + roadWidth / 2), toPx(z + roadWidth / 2), toPx(roadEvery - roadWidth) - toPx(0), toPx(roadEvery - roadWidth) - toPx(0));
    }
  }
  // Center dashes on every road.
  g.fillStyle = '#8a7a3a';
  for (let v = -450; v <= 450; v += roadEvery) {
    for (let d = -450; d < 450; d += 24) {
      g.fillRect(toPx(v) - 1, toPx(d), 2, 10);
      g.fillRect(toPx(d), toPx(v) - 1, 10, 2);
    }
  }
  // District tints, faint, so the map reads at a glance.
  for (const d of CFG.districts) {
    g.fillStyle = `#${d.hue.toString(16).padStart(6, '0')}`;
    g.globalAlpha = 0.05;
    g.fillRect(toPx(d.x0), toPx(d.z0), toPx(d.x1) - toPx(d.x0), toPx(d.z1) - toPx(d.z0));
  }
  g.globalAlpha = 1;
  // The harbor water at the south edge.
  const grad = g.createLinearGradient(0, toPx(470), 0, S);
  grad.addColorStop(0, '#0a2e3d');
  grad.addColorStop(1, '#04141d');
  g.fillStyle = grad;
  g.fillRect(0, toPx(470), S, S - toPx(470));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** One car: body, cabin, wheels, headlights, taillights, neon underglow. */
export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.15, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.2), paint);
  body.position.y = 0.5;
  body.castShadow = false;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), glass);
  cabin.position.set(0, 1.0, -0.25);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, 0.38, z);
    group.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    h.position.set(x, 0.55, 2.12);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    t.position.set(x, 0.55, -2.12);
    group.add(t);
  }
  // Neon underglow.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 4.6),
    new THREE.MeshBasicMaterial({ color: opts.glow ?? 0x22d3ee, transparent: true, opacity: 0.35 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.07;
  group.add(glow);
  let bar = null;
  if (opts.police) {
    bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.4;
    bar.add(red);
    bar.add(blue);
    bar.position.y = 1.32;
    group.add(bar);
    bar.userData = { red, blue };
  }
  group.userData.wheels = wheels;
  group.userData.bar = bar;
  return group;
}

/** Build the whole city into `scene`. Returns the world object systems use. */
export function createWorld(scene, rng) {
  const colliders = [];
  const tapes = [];
  const animated = { signs: [], boats: [], water: null };

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ map: groundTexture(rng), roughness: 0.9, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // Harbor water south of the city, slightly below ground level.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 280),
    new THREE.MeshStandardMaterial({ color: CFG.colors.water, roughness: 0.25, metalness: 0.4, emissive: 0x06222e, emissiveIntensity: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.6, 610);
  scene.add(water);
  animated.water = water;

  // The Causeway: a deck over the water, leaving the city south at x = 0.
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.85 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 200), deckMat);
  deck.position.set(0, -0.6, 540);
  scene.add(deck);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.5, emissive: 0x22d3ee, emissiveIntensity: 0.35 });
  for (const x of [-8.4, 8.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 200), railMat);
    rail.position.set(x, 0.55, 540);
    scene.add(rail);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: 440, maxZ: 640 });
  }
  // The water's edge is a wall except for the Causeway gap.
  colliders.push({ minX: -500, maxX: -10, minZ: 468, maxZ: 472 });
  colliders.push({ minX: 10, maxX: 500, minZ: 468, maxZ: 472 });
  // City outer bounds.
  colliders.push({ minX: -452, maxX: -448, minZ: -450, maxZ: 450 });
  colliders.push({ minX: 448, maxX: 452, minZ: -450, maxZ: 450 });
  colliders.push({ minX: -450, maxX: 450, minZ: -452, maxZ: -448 });

  // Facade textures, shared across buildings.
  const facades = [facadeTexture(rng, 0.45), facadeTexture(rng, 0.3), facadeTexture(rng, 0.6), facadeTexture(rng, 0.2)];

  // Buildings, one or two per block.
  const { roadEvery } = CFG.city;
  for (let bx = -450; bx < 450; bx += roadEvery) {
    for (let bz = -450; bz < 450; bz += roadEvery) {
      const cx = bx + roadEvery / 2;
      const cz = bz + roadEvery / 2;
      // Keep the Causeway approach clear.
      if (Math.abs(cx) < 60 && cz > 330) continue;
      // One block in ten stays a parking lot.
      if (rng.chance(0.1)) continue;
      const d = districtAt(cx, cz) ?? CFG.districts[2];
      const spots = rng.chance(0.65)
        ? [{ x: cx, z: cz, w: 58, d: 58 }]
        : [
            { x: cx - 15, z: cz, w: 26, d: 58 },
            { x: cx + 15, z: cz, w: 26, d: 58 },
          ];
      for (const s of spots) {
        const h = rng.range(d.hMin, d.hMax);
        const mat = new THREE.MeshStandardMaterial({
          map: rng.pick(facades),
          emissiveMap: rng.pick(facades),
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          roughness: 0.85,
          metalness: 0.1,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(s.w, h, s.d), mat);
        b.position.set(s.x, h / 2, s.z);
        scene.add(b);
        colliders.push({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2 });
        // Rooftop box on some buildings.
        if (rng.chance(0.4)) {
          const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.9 }));
          roof.position.set(s.x + rng.range(-8, 8), h + 1.5, s.z + rng.range(-8, 8));
          scene.add(roof);
        }
        // A glowing sign on some Neon Row faces.
        if (d.name === 'Neon Row' && rng.chance(0.45)) {
          const word = rng.pick(SIGN_WORDS);
          const color = rng.pick(NEON_COLORS);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 3.5),
            new THREE.MeshBasicMaterial({ map: signTexture(word, color), transparent: true }),
          );
          sign.position.set(s.x, Math.min(h - 3, 14), s.z + s.d / 2 + 0.15);
          scene.add(sign);
          animated.signs.push(sign);
        }
      }
    }
  }

  // A few colored lights in the neon core so the streets glow.
  const lightSpots = [
    { p: [0, 9, 0], c: 0xff2d78 },
    { p: [-90, 8, 45], c: 0x22d3ee },
    { p: [90, 8, -45], c: 0xffb020 },
    { p: [0, 9, 180], c: 0x39ff88 },
  ];
  for (const l of lightSpots) {
    const pl = new THREE.PointLight(l.c, 900, 90, 2);
    pl.position.set(l.p[0], l.p[1], l.p[2]);
    scene.add(pl);
  }

  // Streetlights, instanced: poles and lamps at intersections.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.2, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.8 });
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const spots = [];
  for (let x = -450; x <= 450; x += roadEvery) {
    for (let z = -450; z <= 450; z += roadEvery) {
      spots.push([x + 9, z + 9]);
      spots.push([x - 9, z - 9]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 2.6, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 5.3, z);
    lamps.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(lamps);

  // Hydrants and dumpsters, instanced.
  const hydGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.9, 8);
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xaa1f1f, roughness: 0.7 });
  const hyds = new THREE.InstancedMesh(hydGeo, hydMat, 40);
  for (let i = 0; i < 40; i++) {
    m4.makeTranslation(rng.range(-430, 430), 0.45, rng.range(-430, 430));
    hyds.setMatrixAt(i, m4);
  }
  scene.add(hyds);

  // Boats in the marina, bobbing.
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 14), boatMat);
    hull.position.y = 0.4;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 5), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 }));
    cab.position.set(0, 2, -2);
    boat.add(hull);
    boat.add(cab);
    boat.position.set(-320 + i * 150, -0.5, 560 + rng.range(-20, 20));
    boat.rotation.y = rng.range(-0.2, 0.2);
    scene.add(boat);
    animated.boats.push(boat);
  }

  // Tide Tapes: glowing cassettes to collect.
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  for (const [x, z] of CFG.tapeSpots) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), tapeMat);
    tape.position.set(x, 1.1, z);
    scene.add(tape);
    tapes.push({ x, z, mesh: tape, taken: false, phase: rng.range(0, Math.PI * 2) });
  }

  // Road lines for traffic: avenues (x = const) and streets (z = const).
  const roads = [];
  for (let v = -450; v <= 450; v += roadEvery) {
    roads.push({ axis: 'x', at: v });
    roads.push({ axis: 'z', at: v });
  }

  function update(dt, time) {
    for (const t of tapes) {
      if (t.taken) continue;
      t.mesh.position.y = 1.1 + Math.sin(time * 2 + t.phase) * 0.25;
      t.mesh.rotation.y += dt * 1.5;
    }
    for (const b of animated.boats) {
      b.position.y = -0.5 + Math.sin(time * 0.7 + b.position.x) * 0.15;
    }
    if (animated.signs.length > 0) {
      // One sign flickers.
      const s = animated.signs[Math.floor(time * 2) % animated.signs.length];
      s.material.opacity = Math.sin(time * 13) > -0.7 ? 1 : 0.35;
      s.material.transparent = true;
    }
  }

  return {
    colliders,
    roads,
    tapes,
    update,
    spawn: {
      player: [0, 0],
      car: [45, 0],
      police: [180, 180],
    },
  };
}

/** Push a circle (x, z, radius) out of every building collider it overlaps. */
export function collideCircle(world, x, z, radius) {
  let px = x;
  let pz = z;
  for (const c of world.colliders) {
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx;
    const dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        pz = nz + (dz / d) * radius;
      } else {
        // Center inside the box: push out along the smallest penetration.
        const pl = px - c.minX;
        const pr = c.maxX - px;
        const pt = pz - c.minZ;
        const pb = c.maxZ - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = c.minX - radius;
        else if (m === pr) px = c.maxX + radius;
        else if (m === pt) pz = c.minZ - radius;
        else pz = c.maxZ + radius;
      }
    }
  }
  return [px, pz];
}
