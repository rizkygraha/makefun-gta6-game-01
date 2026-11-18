// NEON TIDE — the three.js scene. This module owns everything the player
// sees in 3D: the night city, rain, neon, cars, people, the helicopter and
// the cameras. Game logic lives in the other modules; this one only syncs
// meshes to the game state each frame and paints it.

import * as THREE from 'three';
import { createRandom } from './random.js';

/** One fixed-seed stream for every cosmetic random: same seed, same frame. */
const rng = createRandom(20261118);
import { BLOCK, BLOCK_LINES, CITY, GRID, HALF, PALETTE, PITCH, ROAD, ROAD_LINES } from './config.js';

/** Draw the city's ground as one 2048 canvas: asphalt, roads, lane dashes. */
function makeGroundTexture() {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const scale = S / (CITY + 60);
  const toPx = (v) => (v + CITY / 2 + 30) * scale;
  g.fillStyle = '#0b0d12';
  g.fillRect(0, 0, S, S);
  // Blocks: slightly lighter slabs.
  for (const bx of BLOCK_LINES) {
    for (const bz of BLOCK_LINES) {
      g.fillStyle = '#1b1f2a';
      g.fillRect(toPx(bx - BLOCK / 2), toPx(bz - BLOCK / 2), BLOCK * scale, BLOCK * scale);
    }
  }
  // Roads: dark strips with a centre dash.
  for (const line of ROAD_LINES) {
    g.fillStyle = '#181c24';
    g.fillRect(toPx(line - ROAD / 2), 0, ROAD * scale, S);
    g.fillRect(0, toPx(line - ROAD / 2), S, ROAD * scale);
    g.fillStyle = 'rgba(255, 210, 138, 0.5)';
    for (let t = -HALF; t < HALF; t += 12) {
      g.fillRect(toPx(line) - 1, toPx(t), 2, 5 * scale);
      g.fillRect(toPx(t), toPx(line) - 1, 5 * scale, 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(238, 241, 245, 0.28)';
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      for (let k = -2; k <= 2; k += 1) {
        g.fillRect(toPx(x + k * 2.2) - 1, toPx(z - ROAD / 2), 2, 3 * scale);
        g.fillRect(toPx(x + k * 2.2) - 1, toPx(z + ROAD / 2 - 3), 2, 3 * scale);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A window-grid texture: lit windows on a dark facade. */
function makeWindowTexture(warm) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#141824';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng() < 0.42;
      if (!lit) continue;
      g.fillStyle = warm && rng() < 0.6 ? 'rgba(255, 210, 138, 0.95)' : 'rgba(159, 216, 255, 0.9)';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.font = 'bold 58px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 22;
  g.fillStyle = color;
  g.fillText(text, 256, 50);
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function boxGeometry(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

/** Scale a box's UVs so the window texture tiles by metres, not by face. */
function tileUVs(geometry, w, h, d) {
  const uv = geometry.attributes.uv;
  const pos = geometry.attributes.position;
  for (let i = 0; i < uv.count; i += 1) {
    const ax = Math.abs(pos.getX(i));
    const ay = Math.abs(pos.getY(i));
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (Math.abs(ay - h / 2) < 0.01) uv.setXY(i, u * (w / 7), v * (d / 7));
    else if (Math.abs(ax - w / 2) < 0.01) uv.setXY(i, u * (d / 7), v * (h / 7));
    else uv.setXY(i, u * (w / 7), v * (h / 7));
  }
  return geometry;
}

function makeCarMesh(color, police, isPlayer = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3 });
  // The player car carries a faint emissive tint so her cyan paint reads at night.
  if (isPlayer) { bodyMat.emissive = new THREE.Color(color); bodyMat.emissiveIntensity = 0.28; }
  const body = new THREE.Mesh(boxGeometry(4.4, 0.85, 2.0), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(boxGeometry(2.2, 0.75, 1.8), new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.15, metalness: 0.9 }));
  cabin.position.set(-0.3, 1.4, 0);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const holder = new THREE.Group();
    holder.position.set(wx, 0.42, wz);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    holder.add(wheel);
    group.add(holder);
    wheels.push(holder);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const wz of [0.6, -0.6]) {
    const head = new THREE.Mesh(boxGeometry(0.15, 0.25, 0.3), headMat);
    head.position.set(2.25, 0.7, wz);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e3e });
  for (const wz of [0.6, -0.6]) {
    const tail = new THREE.Mesh(boxGeometry(0.15, 0.25, 0.3), tailMat);
    tail.position.set(-2.25, 0.7, wz);
    group.add(tail);
  }
  let lightBar = null;
  if (police) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(boxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.set(0, 1.85, 0.45);
    const blue = new THREE.Mesh(boxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0, 1.85, -0.45);
    bar.add(red, blue);
    group.add(bar);
    lightBar = { red: red.material, blue: blue.material };
    const stripe = new THREE.Mesh(boxGeometry(4.45, 0.3, 2.02), new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4, metalness: 0.4 }));
    stripe.position.y = 0.85;
    group.add(stripe);
  }
  return { group, wheels, lightBar };
}

function makePersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const legs = new THREE.Mesh(boxGeometry(0.55, 0.8, 0.35), new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 }));
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(boxGeometry(0.7, 0.85, 0.4), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 }));
  torso.position.y = 1.22;
  group.add(torso);
  const head = new THREE.Mesh(boxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
  head.position.y = 1.86;
  group.add(head);
  return { group, legs, torso };
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0052);

  const camera = new THREE.PerspectiveCamera(62, 1024 / 640, 0.1, 900);

  scene.add(new THREE.HemisphereLight(0x3a4a6f, 0x14161d, 1.5));
  const moon = new THREE.DirectionalLight(0x8fb4ff, 1.0);
  moon.position.set(-80, 140, -60);
  scene.add(moon);

  // A few real lights in Neon Row so the cover shot glows.
  const glowLights = [];
  for (const [x, z, color] of [[0, 24, 0xff2e88], [24, 0, 0x22e6ff], [-24, 48, 0xffb020], [48, 48, 0x3dff8e]]) {
    const light = new THREE.PointLight(color, 90, 70, 2);
    light.position.set(x, 9, z);
    scene.add(light);
    glowLights.push(light);
  }

  // Rain: points in a box that follows the focus point and wraps.
  const RAIN_COUNT = 1400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  const rainSpeed = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    rainPos[i * 3] = (rng() - 0.5) * 90;
    rainPos[i * 3 + 1] = rng() * 32;
    rainPos[i * 3 + 2] = (rng() - 0.5) * 90;
    rainSpeed[i] = 22 + rng() * 10;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.14, transparent: true, opacity: 0.55 }));
  scene.add(rain);

  // Ground: one textured plane for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 60, CITY + 60),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.55, metalness: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Harbour water east of the city, with a pier.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, CITY + 60),
    new THREE.MeshStandardMaterial({ color: 0x06121f, roughness: 0.12, metalness: 0.85 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(HALF + 60, -0.4, 0);
  scene.add(water);

  const winWarm = makeWindowTexture(true);
  const winCool = makeWindowTexture(false);
  // Lit windows glow on their own: emissiveMap = the window texture, so the
  // facade reads at night without a light per building.
  const sideWarm = new THREE.MeshStandardMaterial({ map: winWarm, emissiveMap: winWarm, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.8, metalness: 0.1 });
  const sideCool = new THREE.MeshStandardMaterial({ map: winCool, emissiveMap: winCool, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.8, metalness: 0.1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0e1118, roughness: 0.95 });

  const carMeshes = new Map();
  const pedMeshes = new Map();
  const enemyMeshes = new Map();
  let playerMesh = null;
  let heli = null;
  let beacon = null;
  let muzzle = null;
  let muzzleLight = null;
  const tracerLines = [];
  // One light that rides with the player's car, so the road ahead of her
  // always reads; and a cyan glow pool that marks her car at night.
  const carLight = new THREE.PointLight(0xbfd9ff, 50, 34, 1.8);
  scene.add(carLight);
  const underglow = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 24),
    new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  underglow.rotation.x = -Math.PI / 2;
  scene.add(underglow);
  // Helicopter searchlight cone: a translucent beam from the heli to the
  // player, so the heli reads as a searchlight, not a dark blob.
  const searchCone = new THREE.Mesh(
    new THREE.ConeGeometry(5, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(searchCone);
  const searchTarget = new THREE.Vector3();
  const searchDir = new THREE.Vector3();
  const searchUp = new THREE.Vector3(0, 1, 0);

  const camState = { pos: new THREE.Vector3(0, 30, 80), look: new THREE.Vector3(0, 0, 0) };

  function buildCity(world) {
    for (const b of world.buildings) {
      const geo = tileUVs(boxGeometry(b.w, b.h, b.d), b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, [b.warm ? sideWarm : sideCool, b.warm ? sideWarm : sideCool, roofMat, roofMat, b.warm ? sideWarm : sideCool, b.warm ? sideWarm : sideCool]);
      mesh.position.set(b.x, b.h / 2, b.z);
      scene.add(mesh);
      if (b.roof) {
        const antenna = new THREE.Mesh(boxGeometry(0.3, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        antenna.position.set(b.x + b.w / 4, b.h + 2, b.z);
        scene.add(antenna);
      }
    }
    for (const s of world.signs) {
      const tex = makeSignTexture(s.text, s.color);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(s.w, s.h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
      );
      sign.position.set(s.x, s.y, s.z);
      sign.rotation.y = s.ry;
      scene.add(sign);
    }
    for (const light of world.streetlights) {
      const pole = new THREE.Mesh(boxGeometry(0.18, 5.5, 0.18), new THREE.MeshStandardMaterial({ color: 0x2a2f3d }));
      pole.position.set(light.x, 2.75, light.z);
      scene.add(pole);
      const head = new THREE.Mesh(boxGeometry(0.5, 0.25, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      head.position.set(light.x, 5.5, light.z);
      scene.add(head);
    }
    for (const park of world.parks) {
      for (let i = 0; i < 5; i += 1) {
        const tx = park.x + (rng() - 0.5) * (park.size - 6);
        const tz = park.z + (rng() - 0.5) * (park.size - 6);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
        trunk.position.set(tx, 1.1, tz);
        scene.add(trunk);
        const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0x0f3d22, roughness: 0.9 }));
        top.position.set(tx, 3.6, tz);
        scene.add(top);
      }
    }
    // The pier at Marina.
    const pier = new THREE.Mesh(boxGeometry(26, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9 }));
    pier.position.set(HALF + 12, 0.4, 120);
    scene.add(pier);
  }

  function syncCar(car, time) {
    let mesh = carMeshes.get(car.id);
    if (!mesh) {
      mesh = makeCarMesh(car.color, car.kind === 'police', car.kind === 'player');
      scene.add(mesh.group);
      carMeshes.set(car.id, mesh);
    }
    mesh.group.position.set(car.x, 0, car.z);
    mesh.group.rotation.y = car.angle;
    const spin = (car.speed || 0) * 0.016 / 0.42;
    for (const wheel of mesh.wheels) wheel.rotation.z += spin;
    if (mesh.lightBar) {
      const phase = Math.floor(time * 5.5) % 2 === 0;
      mesh.lightBar.red.color.setHex(phase ? 0xff2233 : 0x440000);
      mesh.lightBar.blue.color.setHex(phase ? 0x001133 : 0x2255ff);
    }
    return mesh;
  }

  function syncPerson(map, ent, shirt, pants, skin) {
    let mesh = map.get(ent.id);
    if (!mesh) {
      mesh = makePersonMesh(shirt, pants, skin);
      scene.add(mesh.group);
      map.set(ent.id, mesh);
    }
    mesh.group.position.set(ent.x, 0, ent.z);
    mesh.group.rotation.y = ent.angle;
    const bob = Math.sin((ent.walkPhase || 0)) * 0.05;
    mesh.group.position.y = bob;
    return mesh;
  }

  function syncHeli(game, dt) {
    const heliState = game.police.heli;
    if (!heliState.active) {
      if (heli) { scene.remove(heli.group); heli = null; }
      searchCone.visible = false;
      return;
    }
    if (!heli) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(boxGeometry(3.4, 1.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.4, metalness: 0.6 }));
      group.add(body);
      const tail = new THREE.Mesh(boxGeometry(3.2, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a6a7a }));
      tail.position.set(-3, 0.2, 0);
      group.add(tail);
      const rotor = new THREE.Mesh(boxGeometry(7.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a9aaa }));
      rotor.position.y = 0.9;
      group.add(rotor);
      // Big enough to read at 30 m: the chase camera sees it from below.
      group.scale.setScalar(1.6);
      // Red navigation light so the heli is visible against the night sky.
      const nav = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2e4d }),
      );
      nav.position.set(0, -0.4, 2.4);
      group.add(nav);
      const spot = new THREE.SpotLight(0xfff2b0, 400, 90, 0.32, 0.5, 1.6);
      spot.position.set(0, -0.5, 0);
      group.add(spot);
      group.add(spot.target);
      heli = { group, rotor, spot };
      scene.add(group);
    }
    const p = game.player;
    // Ahead of the player, low over the road: the chase camera sees it.
    const fx = Math.sin(p.angle);
    const fz = Math.cos(p.angle);
    heli.group.position.set(p.pos.x + fx * 28, 14, p.pos.z + fz * 28);
    heli.group.rotation.y = Math.atan2(p.pos.x - heli.group.position.x, p.pos.z - heli.group.position.z) + Math.PI;
    heli.rotor.rotation.y += dt * 22;
    heli.spot.target.position.set(p.pos.x - heli.group.position.x, -14, p.pos.z - heli.group.position.z);
    // Searchlight cone: apex at the heli, opening toward the player.
    searchCone.visible = true;
    searchTarget.set(p.pos.x, 0.5, p.pos.z);
    searchDir.copy(searchTarget).sub(heli.group.position);
    searchCone.position.copy(heli.group.position).addScaledVector(searchDir, 0.5);
    searchCone.quaternion.setFromUnitVectors(searchUp, searchDir.clone().normalize().negate());
    searchCone.scale.set(1, searchDir.length() / 26, 1);
  }

  function syncBeacon(game, t) {
    const obj = game.mission.objective;
    if (!obj || !obj.pos) {
      if (beacon) { scene.remove(beacon); beacon = null; }
      return;
    }
    if (!beacon) {
      const group = new THREE.Group();
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 46, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.y = 23;
      group.add(beam);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 2.4, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      group.add(ring);
      beacon = group;
      scene.add(group);
    }
    beacon.position.set(obj.pos.x, 0, obj.pos.z);
    const pulse = 1 + Math.sin(t * 3) * 0.18;
    beacon.scale.set(pulse, 1, pulse);
  }

  function syncFx(game, dt) {
    if (game.fx.muzzle && game.fx.muzzle.ttl > 0) {
      if (!muzzle) {
        muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
        muzzleLight = new THREE.PointLight(0xffc861, 60, 18, 2);
        scene.add(muzzle);
        scene.add(muzzleLight);
      }
      muzzle.visible = true;
      muzzleLight.visible = true;
      muzzle.position.set(game.fx.muzzle.x, game.fx.muzzle.y, game.fx.muzzle.z);
      muzzleLight.position.copy(muzzle.position);
      game.fx.muzzle.ttl -= dt;
    } else if (muzzle) {
      muzzle.visible = false;
      muzzleLight.visible = false;
    }
    // Tracers: one line each, fading fast.
    while (tracerLines.length < game.fx.tracers.length) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true }));
      scene.add(line);
      tracerLines.push(line);
    }
    game.fx.tracers = game.fx.tracers.filter((tr) => tr.ttl > 0);
    tracerLines.forEach((line, i) => {
      const tr = game.fx.tracers[i];
      if (!tr) { line.visible = false; return; }
      line.visible = true;
      line.geometry.setFromPoints([new THREE.Vector3(tr.from.x, tr.from.y, tr.from.z), new THREE.Vector3(tr.to.x, tr.to.y, tr.to.z)]);
      line.material.opacity = Math.max(0, tr.ttl / 0.09);
      tr.ttl -= dt;
    });
  }

  function updateCamera(game, dt) {
    const { target, look } = cameraTarget(game);
    const k = game.screen === 'title' ? 1 : 1 - Math.pow(0.001, dt);
    camState.pos.lerp(target, k);
    camState.look.lerp(look, k);
    camera.position.copy(camState.pos);
    camera.lookAt(camState.look);
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Where the camera wants to be for this game state (shared by the lerp and the snap). */
  function cameraTarget(game) {
    const p = game.player;
    const target = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (game.screen === 'title') {
      const t = game.clock * 0.03;
      target.set(Math.sin(t) * 130, 46, Math.cos(t) * 130);
      look.set(0, 6, 0);
    } else if (p.inCar && p.car) {
      const fwd = new THREE.Vector3(Math.sin(p.car.angle), 0, Math.cos(p.car.angle));
      if (game.cameraMode === 'classic') {
        target.set(p.car.x - fwd.x * 20, 17, p.car.z - fwd.z * 20);
        look.set(p.car.x + fwd.x * 10, 1, p.car.z + fwd.z * 10);
      } else {
        target.set(p.car.x - fwd.x * 11.5, 4.6, p.car.z - fwd.z * 11.5);
        look.set(p.car.x + fwd.x * 9, 1.5, p.car.z + fwd.z * 9);
      }
    } else {
      const fwd = new THREE.Vector3(Math.sin(p.angle), 0, Math.cos(p.angle));
      target.set(p.pos.x - fwd.x * 7.5, 3.4, p.pos.z - fwd.z * 7.5);
      look.set(p.pos.x + fwd.x * 5, 1.4, p.pos.z + fwd.z * 5);
    }
    return { target, look };
  }

  /** Where the mouse points on the ground (y=0), for aiming on foot. */
  function aimPoint(ndcX, ndcY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX * 2 - 1, -(ndcY * 2 - 1)), camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (!Number.isFinite(t) || t <= 0) return null;
    const hit = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    return { x: hit.x, z: hit.z };
  }

  return {
    buildCity,
    resize,
    snapCamera(game) {
      const { target, look } = cameraTarget(game);
      camState.pos.copy(target);
      camState.look.copy(look);
      camera.position.copy(target);
      camera.lookAt(look);
    },
    aimPoint,
    draw(game, dt, time) {
      // Sync entities.
      for (const car of game.cars) syncCar(car, time);
      for (const id of [...carMeshes.keys()]) {
        if (!game.cars.some((c) => c.id === id)) {
          scene.remove(carMeshes.get(id).group);
          carMeshes.delete(id);
        }
      }
      for (const ped of game.peds) syncPerson(pedMeshes, ped, ped.shirt, ped.pants, 0xd9a066);
      for (const id of [...pedMeshes.keys()]) {
        if (!game.peds.some((e) => e.id === id)) {
          scene.remove(pedMeshes.get(id).group);
          pedMeshes.delete(id);
        }
      }
      for (const en of game.enemies) syncPerson(enemyMeshes, en, 0x7a2020, 0x1a1a22, 0xc98f5f);
      for (const id of [...enemyMeshes.keys()]) {
        if (!game.enemies.some((e) => e.id === id)) {
          scene.remove(enemyMeshes.get(id).group);
          enemyMeshes.delete(id);
        }
      }
      // Player on foot, or her car: only one of them is ever visible.
      if (!game.player.inCar) {
        if (!playerMesh) {
          playerMesh = makePersonMesh(0xff2e88, 0x14161d, 0xd9a066);
          scene.add(playerMesh.group);
        }
        playerMesh.group.visible = true;
        playerMesh.group.position.set(game.player.pos.x, 0, game.player.pos.z);
        playerMesh.group.rotation.y = game.player.angle;
        playerMesh.group.position.y = Math.sin(game.player.walkPhase || 0) * 0.05;
        carLight.visible = false;
        underglow.visible = false;
      } else {
        if (playerMesh) playerMesh.group.visible = false;
        const car = game.player.car;
        carLight.visible = true;
        carLight.position.set(car.x + Math.sin(car.angle) * 2, 2.5, car.z + Math.cos(car.angle) * 2);
        underglow.visible = true;
        underglow.position.set(car.x, 0.12, car.z);
      }
      // Rain follows the focus point.
      const focus = game.player.inCar && game.player.car ? game.player.car : game.player.pos;
      const pos = rainGeo.attributes.position;
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        let y = pos.getY(i) - rainSpeed[i] * dt;
        if (y < 0) {
          y = 30 + rng() * 4;
          pos.setX(i, focus.x + (rng() - 0.5) * 90);
          pos.setZ(i, focus.z + (rng() - 0.5) * 90);
        }
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) - dt * 3);
      }
      pos.needsUpdate = true;
      rain.position.set(0, 0, 0);
      syncHeli(game, dt);
      syncBeacon(game, time);
      syncFx(game, dt);
      updateCamera(game, dt);
      renderer.render(scene, camera);
    },
  };
}
