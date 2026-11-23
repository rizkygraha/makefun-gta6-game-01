// Drawing only: the three.js scene, the rain, the cameras and every moving
// mesh. The world's state in, pixels out. Nothing here decides rules.
import * as THREE from '../vendor/three.module.min.js';
import { CITY, PALETTE } from './config.js';

const RAIN_COUNT = 900;

function makeGroundTexture(world) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const toPx = (v) => ((v + CITY.half) / (CITY.half * 2)) * S;
  ctx.fillStyle = '#12141f';
  ctx.fillRect(0, 0, S, S);
  // Block fill, slightly varied.
  for (let ix = 0; ix < world.lines.length - 1; ix += 1) {
    for (let iz = 0; iz < world.lines.length - 1; iz += 1) {
      const shade = 14 + ((ix * 7 + iz * 13) % 10);
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 10})`;
      ctx.fillRect(toPx(world.lines[ix] + CITY.roadHalf), toPx(world.lines[iz] + CITY.roadHalf),
        toPx(world.lines[ix + 1] - CITY.roadHalf) - toPx(world.lines[ix] + CITY.roadHalf),
        toPx(world.lines[iz + 1] - CITY.roadHalf) - toPx(world.lines[iz] + CITY.roadHalf));
    }
  }
  // Roads.
  for (const v of world.lines) {
    ctx.fillStyle = '#1d2033';
    ctx.fillRect(toPx(v - CITY.roadHalf), 0, toPx(v + CITY.roadHalf) - toPx(v - CITY.roadHalf), S);
    ctx.fillRect(0, toPx(v - CITY.roadHalf), S, toPx(v + CITY.roadHalf) - toPx(v - CITY.roadHalf));
  }
  // Lane dashes.
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  for (const v of world.lines) {
    ctx.beginPath(); ctx.moveTo(toPx(v), 0); ctx.lineTo(toPx(v), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toPx(v)); ctx.lineTo(S, toPx(v)); ctx.stroke();
  }
  ctx.setLineDash([]);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#232842';
  ctx.fillRect(0, 0, 128, 256);
  const lit = ['#ffd23f', '#2ec5ff', '#ff2e88', '#ffe9a8', '#37e0a0'];
  for (let y = 10; y < 246; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      if (Math.random() < 0.55) {
        ctx.fillStyle = lit[Math.floor(Math.random() * lit.length)];
        ctx.globalAlpha = 0.55 + Math.random() * 0.45;
        ctx.fillRect(x, y, 9, 11);
      }
    }
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(canvas);
}

function makeSignTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 96);
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 50);
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 256, 50);
  return new THREE.CanvasTexture(canvas);
}

function makeCarMesh(car) {
  const group = new THREE.Group();
  const bodyColor = car.police ? 0xf2f4f8 : car.color;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.15, metalness: 0.9 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), headMat);
    h.position.set(hx, 0.62, 2.18);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a33 });
  for (const hx of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), tailMat);
    t.position.set(hx, 0.62, -2.18);
    group.add(t);
  }
  if (car.police) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.35;
    bar.add(red, blue);
    bar.position.set(0, 1.5, -0.25);
    bar.userData.red = red;
    bar.userData.blue = blue;
    group.add(bar);
    group.userData.lightBar = bar;
  }
  return group;
}

function makePersonMesh(color) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.62;
  group.add(head);
  for (const lx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), dark);
    leg.position.set(lx, 0.31, 0);
    group.add(leg);
  }
  for (const ax of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), jacket);
    arm.position.set(ax, 1.05, 0);
    group.add(arm);
  }
  return group;
}

function makeHeliMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x1c2b4a, roughness: 0.4, metalness: 0.6 }),
  );
  body.position.y = 0;
  group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), new THREE.MeshStandardMaterial({ color: 0x1c2b4a }));
  tail.position.set(0, 0.1, -3.8);
  group.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.y = 0.85;
  group.add(rotor);
  group.userData.rotor = rotor;
  const coneGeo = new THREE.ConeGeometry(3.2, 26, 16, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -13;
  cone.rotation.x = Math.PI;
  group.add(cone);
  return group;
}

export function createRenderer(canvas, G) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0058);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

  scene.add(new THREE.AmbientLight(0x5a6a94, 1.5));
  const hemi = new THREE.HemisphereLight(0x35447a, 0x11141f, 1.25);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fb0ff, 1.6);
  moon.position.set(-120, 180, 60);
  scene.add(moon);

  const world = G.world;

  // Ground with the painted road grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(world), roughness: 0.32, metalness: 0.55 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Buildings: one instanced box, window texture, per-instance tint.
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshLambertMaterial({ map: makeWindowTexture() });
  const inst = new THREE.InstancedMesh(bGeo, bMat, world.buildings.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  world.buildings.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
    pos.set(b.x, 0, b.z);
    scl.set(b.w, b.h, b.d);
    m4.compose(pos, q, scl);
    inst.setMatrixAt(i, m4);
    col.set(b.color);
    inst.setColorAt(i, col);
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);

  // Neon signs.
  for (const s of world.signs) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.h),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(s.text, s.color), transparent: true, side: THREE.DoubleSide }),
    );
    mesh.position.set(s.x, s.y, s.z);
    scene.add(mesh);
  }

  // Street lamps: instanced poles + glowing heads.
  const lampCount = world.lamps.length;
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  poleGeo.translate(0, 2.7, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2a2f45, roughness: 0.6, metalness: 0.6 }), lampCount);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd98a }), lampCount);
  world.lamps.forEach((l, i) => {
    m4.makeTranslation(l.x, 0, l.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(l.x, 5.5, l.z);
    heads.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  scene.add(poles, heads);

  // Rain: points in a box that follows the camera.
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    rainPos[i * 3] = (Math.random() - 0.5) * 70;
    rainPos[i * 3 + 1] = Math.random() * 30;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fb8ff, size: 0.14, transparent: true, opacity: 0.55 }));
  scene.add(rain);

  // Objective beacon: a glowing pillar + floating marker.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  diamond.position.y = 6;
  beacon.add(diamond);
  beacon.userData.diamond = diamond;
  scene.add(beacon);

  // Muzzle flash light (one light, reused).
  const flashLight = new THREE.PointLight(0xffc860, 0, 26, 1.6);
  scene.add(flashLight);

  // Tracers: one line segment pair per live tracer, rebuilt each frame.
  const tracerGeo = new THREE.BufferGeometry();
  const tracerPos = new Float32Array(48 * 6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracerLines = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.9 }));
  tracerLines.frustumCulled = false;
  scene.add(tracerLines);

  // Dynamic meshes, keyed by object id.
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const enemyMeshes = new Map();
  let playerMesh = null;
  let heliMesh = null;
  const raycaster = new THREE.Raycaster();
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function syncCar(car) {
    let mesh = carMeshes.get(car.id);
    if (!mesh) {
      mesh = makeCarMesh(car);
      carMeshes.set(car.id, mesh);
      scene.add(mesh);
    }
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    if (mesh.userData.lightBar) {
      const on = Math.floor(G.time * 6) % 2 === 0;
      mesh.userData.lightBar.userData.red.material.color.setHex(on ? 0xff2233 : 0x550000);
      mesh.userData.lightBar.userData.blue.material.color.setHex(on ? 0x112244 : 0x2266ff);
    }
  }

  function sync(G2, dt) {
    const P = G2.player;
    // Cars.
    const seenCars = new Set();
    for (const car of G2.cars) {
      seenCars.add(car.id);
      syncCar(car);
    }
    for (const [id, mesh] of carMeshes) {
      if (!seenCars.has(id)) { scene.remove(mesh); carMeshes.delete(id); }
    }
    // Pedestrians.
    const seenPeds = new Set();
    for (const ped of G2.peds) {
      seenPeds.add(ped.id);
      let mesh = pedMeshes.get(ped.id);
      if (!mesh) {
        mesh = makePersonMesh(ped.color);
        pedMeshes.set(ped.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(ped.x, 0, ped.z);
      mesh.rotation.y = ped.heading;
    }
    for (const [id, mesh] of pedMeshes) {
      if (!seenPeds.has(id)) { scene.remove(mesh); pedMeshes.delete(id); }
    }
    // Enemies.
    const seenEnemies = new Set();
    for (const e of G2.enemies) {
      if (!e.alive) continue;
      seenEnemies.add(e.id);
      let mesh = enemyMeshes.get(e.id);
      if (!mesh) {
        mesh = makePersonMesh(e.boss ? 0xd4af37 : 0x8c1f28);
        enemyMeshes.set(e.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(e.x, 0, e.z);
      mesh.rotation.y = e.heading;
      // Aim flash: enemy briefly bright when shooting.
      mesh.visible = true;
    }
    for (const [id, mesh] of enemyMeshes) {
      if (!seenEnemies.has(id)) { scene.remove(mesh); enemyMeshes.delete(id); }
    }
    // Player on foot.
    if (P.onFoot) {
      if (!playerMesh) {
        playerMesh = makePersonMesh(0x1fb6a6);
        scene.add(playerMesh);
      }
      playerMesh.visible = true;
      playerMesh.position.set(P.x, 0, P.z);
      playerMesh.rotation.y = P.heading;
    } else if (playerMesh) {
      playerMesh.visible = false;
    }
    // Helicopter.
    if (G2.heli) {
      if (!heliMesh) { heliMesh = makeHeliMesh(); scene.add(heliMesh); }
      heliMesh.visible = true;
      heliMesh.position.set(G2.heli.x, 34, G2.heli.z);
      heliMesh.rotation.y = G2.heli.heading;
      heliMesh.userData.rotor.rotation.y += dt * 28;
    } else if (heliMesh) {
      heliMesh.visible = false;
    }
    // Beacon at the objective.
    const obj = G2.mission.objective;
    if (obj && G2.screen !== 'title') {
      beacon.visible = true;
      beacon.position.set(obj.x, 0, obj.z);
      beacon.userData.diamond.position.y = 6 + Math.sin(G2.time * 2.4) * 0.7;
      beacon.userData.diamond.rotation.y += dt * 1.5;
    } else {
      beacon.visible = false;
    }
    // Muzzle flash.
    if (G2.fx.muzzle > 0) {
      flashLight.position.set(G2.fx.muzzleX, 1.6, G2.fx.muzzleZ);
      flashLight.intensity = 60 * G2.fx.muzzle;
    } else {
      flashLight.intensity = 0;
    }
    // Tracers.
    {
      const list = G2.fx.tracers.slice(0, 48);
      for (let i = 0; i < 48; i += 1) {
        const t = list[i];
        if (t) {
          tracerPos[i * 6] = t.x1; tracerPos[i * 6 + 1] = t.y1; tracerPos[i * 6 + 2] = t.z1;
          tracerPos[i * 6 + 3] = t.x2; tracerPos[i * 6 + 4] = t.y2; tracerPos[i * 6 + 5] = t.z2;
        } else {
          tracerPos[i * 6] = 0; tracerPos[i * 6 + 1] = -10; tracerPos[i * 6 + 2] = 0;
          tracerPos[i * 6 + 3] = 0; tracerPos[i * 6 + 4] = -10; tracerPos[i * 6 + 5] = 0;
        }
      }
      tracerGeo.attributes.position.needsUpdate = true;
      tracerLines.visible = list.length > 0;
    }
    // Rain follows the camera and falls.
    const rp = rainGeo.attributes.position.array;
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      rp[i * 3 + 1] -= dt * 26;
      rp[i * 3] -= dt * 3;
      if (rp[i * 3 + 1] < 0) {
        rp[i * 3 + 1] = 28 + Math.random() * 4;
        rp[i * 3] = cx + (Math.random() - 0.5) * 70;
        rp[i * 3 + 2] = cz + (Math.random() - 0.5) * 70;
      }
      if (rp[i * 3] < cx - 35) rp[i * 3] += 70;
      if (rp[i * 3] > cx + 35) rp[i * 3] -= 70;
      if (rp[i * 3 + 2] < cz - 35) rp[i * 3 + 2] += 70;
      if (rp[i * 3 + 2] > cz + 35) rp[i * 3 + 2] -= 70;
    }
    rainGeo.attributes.position.needsUpdate = true;

    // Camera.
    const heading = P.onFoot ? P.heading : (P.car ? P.car.heading : P.heading);
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    if (G2.screen === 'title') {
      const a = G2.time * 0.05;
      camPos.set(30 + Math.sin(a) * 130, 46, 30 + Math.cos(a) * 130);
      camTarget.set(30, 18, 30);
    } else if (G2.screen === 'map') {
      camPos.set(P.x, 150, P.z + 0.01);
      camTarget.set(P.x, 0, P.z);
    } else if (G2.cameraMode === 'classic') {
      const dist = P.onFoot ? 13 : 17;
      camPos.set(P.x - fx * dist, P.onFoot ? 10 : 11, P.z - fz * dist);
      camTarget.set(P.x + fx * 5, 1, P.z + fz * 5);
    } else {
      const dist = P.onFoot ? 7.5 : 11;
      const height = P.onFoot ? 3.4 : 4.6;
      camPos.set(P.x - fx * dist, height, P.z - fz * dist);
      camTarget.set(P.x + fx * 7, 1.4, P.z + fz * 7);
    }
    camera.position.lerp(camPos, G2.screen === 'title' ? 0.02 : 0.35);
    if (G2.snapCamera) {
      camera.position.copy(camPos);
      G2.snapCamera = false;
    }
    tmpV.copy(camTarget);
    camera.lookAt(tmpV);
    // Store the smoothed camera heading for on-foot movement.
    G2.camHeading = Math.atan2(camera.position.x - camTarget.x, camera.position.z - camTarget.z) + Math.PI;
    renderer.render(scene, camera);
  }

  /** Ray from the mouse (pixels) into the world, for aiming. */
  function screenRay(px, py) {
    const nx = (px / window.innerWidth) * 2 - 1;
    const ny = -(py / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    return raycaster.ray;
  }

  return { sync, screenRay, camera, renderer };
}
