// Tidewater: the city itself. One deterministic build from a seeded RNG:
// ground texture with the road grid, buildings with lit windows, neon signs,
// street lamps, dock containers, named places and the tape collectibles.

import * as THREE from '../vendor/three.module.js';
import { WORLD, DISTRICTS, districtAt, COLORS } from './config.js';

function groundTexture(rng) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + WORLD.half) / (WORLD.half * 2)) * S;
  const roadPx = (WORLD.roadWidth / (WORLD.half * 2)) * S;
  g.fillStyle = '#171a24';
  g.fillRect(0, 0, S, S);
  for (const d of DISTRICTS) {
    g.fillStyle = 'rgba(255,255,255,0.02)';
    g.fillRect(toPx(d.x0), toPx(d.z0), toPx(d.x1) - toPx(d.x0), toPx(d.z1) - toPx(d.z0));
  }
  g.fillStyle = '#0b2f42';
  g.fillRect(0, toPx(224), S, S - toPx(224));
  g.fillStyle = '#1d2130';
  for (let i = 0; i <= 12; i++) {
    const p = toPx(-WORLD.half + i * WORLD.block);
    g.fillRect(p - roadPx / 2 - 4, 0, roadPx + 8, S);
    g.fillRect(0, p - roadPx / 2 - 4, S, roadPx + 8);
  }
  g.fillStyle = '#10121a';
  for (let i = 0; i <= 12; i++) {
    const p = toPx(-WORLD.half + i * WORLD.block);
    g.fillRect(p - roadPx / 2, 0, roadPx, S);
    g.fillRect(0, p - roadPx / 2, S, roadPx);
  }
  g.fillStyle = '#c9a227';
  for (let i = 0; i <= 12; i++) {
    const p = toPx(-WORLD.half + i * WORLD.block);
    for (let t = -WORLD.half + 10; t < WORLD.half; t += 20) {
      g.fillRect(p - 1, toPx(t), 2, 8);
      g.fillRect(toPx(t), p - 1, 8, 2);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 12; j++) {
      const px = toPx(-WORLD.half + i * WORLD.block);
      const pz = toPx(-WORLD.half + j * WORLD.block);
      for (let k = -2; k <= 2; k++) {
        g.fillRect(px - 8 + k * 4, pz - roadPx / 2 - 3, 2, 3);
        g.fillRect(px - 8 + k * 4, pz + roadPx / 2, 2, 3);
        g.fillRect(px - roadPx / 2 - 3, pz - 8 + k * 4, 3, 2);
        g.fillRect(px + roadPx / 2, pz - 8 + k * 4, 3, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function windowTexture(rng, lit) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#14161f';
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      g.fillStyle = rng.chance(0.5) ? lit : '#05060a';
      g.fillRect(x, y, 6, 8);
    }
  }
  return new THREE.CanvasTexture(c);
}

export function buildWorld(scene, rng) {
  const colliders = [];
  const places = {
    'Pier 9': { x: -180, z: 200 },
    'Spire Plaza': { x: 0, z: -200 },
    'Neon Row Main': { x: 0, z: -20 },
    'Cannery Yard': { x: -180, z: -160 },
    'Marina Boardwalk': { x: 180, z: 200 },
    'Causeway Toll': { x: 200, z: 0 },
    'Safehouse': { x: 60, z: 0 },
    'Respray': { x: -100, z: 120 },
    'Hospital': { x: 140, z: 120 },
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, WORLD.half * 2 + 80),
    new THREE.MeshStandardMaterial({ map: groundTexture(rng), roughness: 0.35, metalness: 0.25 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  scene.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, 90),
    new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.15, metalness: 0.6 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 285);
  scene.add(water);

  const lits = ['#ffd27a', '#9fd8ff', '#ff9ecf', '#b8ff9e'];
  const winTex = lits.map((lit) => windowTexture(rng, lit));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const signGeo = new THREE.BoxGeometry(1, 1, 1);
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5, 6);
  const lampBallGeo = new THREE.SphereGeometry(0.35, 8, 6);

  const blockCenters = [];
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      blockCenters.push({
        x: -WORLD.half + i * WORLD.block + WORLD.block / 2,
        z: -WORLD.half + j * WORLD.block + WORLD.block / 2,
      });
    }
  }

  for (const b of blockCenters) {
    const d = districtAt(b.x, b.z);
    const n = rng.int(1, WORLD.maxBuildingsPerBlock);
    const tall = d.name === 'The Spire';
    const low = d.name === 'Old Cannery' || d.name === 'Dockside';
    for (let k = 0; k < n; k++) {
      const w = rng.range(8, 16);
      const dep = rng.range(8, 16);
      const h = tall ? rng.range(30, 70) : low ? rng.range(6, 14) : rng.range(12, 32);
      const ox = (rng.next() - 0.5) * (WORLD.block - WORLD.roadWidth - w - 4);
      const oz = (rng.next() - 0.5) * (WORLD.block - WORLD.roadWidth - dep - 4);
      const x = b.x + ox;
      const z = b.z + oz;
      const tex = winTex[Math.floor(rng.next() * winTex.length)];
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 0.55,
        roughness: 0.85,
        metalness: 0.1,
      });
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, dep);
      m.position.set(x, h / 2, z);
      scene.add(m);
      colliders.push({ x0: x - w / 2, z0: z - dep / 2, x1: x + w / 2, z1: z + dep / 2 });
      if (d.name === 'Neon Row' && rng.chance(0.7)) {
        const signMat = new THREE.MeshBasicMaterial({ color: d.color });
        const sign = new THREE.Mesh(signGeo, signMat);
        const vertical = rng.chance(0.5);
        if (vertical) sign.scale.set(0.5, rng.range(6, 12), 0.5);
        else sign.scale.set(rng.range(6, 10), 0.8, 0.5);
        sign.position.set(x + w / 2 + 0.4, h * 0.55, z);
        scene.add(sign);
      }
      if (rng.chance(0.25)) {
        const signMat = new THREE.MeshBasicMaterial({ color: d.color });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.scale.set(rng.range(4, 8), 0.6, 0.4);
        sign.position.set(x, h * 0.7, z + dep / 2 + 0.3);
        scene.add(sign);
      }
    }
  }

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = 0; i <= 12; i += 2) {
    for (let j = 0; j <= 12; j += 2) {
      const x = -WORLD.half + i * WORLD.block + 8;
      const z = -WORLD.half + j * WORLD.block + 8;
      const pole = new THREE.Mesh(lampPoleGeo, poleMat);
      pole.position.set(x, 2.5, z);
      scene.add(pole);
      const ball = new THREE.Mesh(lampBallGeo, lampMat);
      ball.position.set(x, 5.1, z);
      scene.add(ball);
    }
  }

  const contColors = [0xc23b2e, 0x2e7dc2, 0x3aa655, 0xd8a13a];
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-220, -80);
    const z = rng.range(120, 220);
    const c = new THREE.Mesh(
      boxGeo,
      new THREE.MeshStandardMaterial({ color: contColors[i % contColors.length], roughness: 0.7, metalness: 0.3 })
    );
    c.scale.set(6, 2.6, 2.6);
    c.position.set(x, 1.3, z);
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    scene.add(c);
    colliders.push({ x0: x - 3, z0: z - 1.5, x1: x + 3, z1: z + 1.5 });
  }

  const pier = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 0.9 })
  );
  pier.scale.set(10, 1, 40);
  pier.position.set(-180, 0.5, 250);
  scene.add(pier);

  const tapes = [];
  for (let i = 0; i < 16; i++) {
    const gx = rng.int(0, 12);
    const gz = rng.int(0, 12);
    tapes.push({
      x: -WORLD.half + gx * WORLD.block + (rng.chance(0.5) ? 7.5 : -7.5),
      z: -WORLD.half + gz * WORLD.block + (rng.chance(0.5) ? 7.5 : -7.5),
      taken: false,
    });
  }

  return { colliders, places, tapes };
}

export function collideCircle(colliders, x, z, r) {
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const cx = Math.max(c.x0, Math.min(nx, c.x1));
    const cz = Math.max(c.z0, Math.min(nz, c.z1));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      nz = cz + (dz / d) * r;
    } else if (d2 <= 0.0001) {
      nx += r;
    }
  }
  return { x: nx, z: nz };
}

export function clampWorld(x, z) {
  const h = WORLD.half - 4;
  return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
}
