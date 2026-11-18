// render.js — the three.js scene: night sky, fog, moonlight, rain and the
// two cameras (3D chase and classic high angle). The world, traffic and
// police add their meshes to this scene; this file only owns the sky,
// the light and the camera.

import * as THREE from 'three';
import { CFG } from './config.js';

const RAIN_COUNT = 1200;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CFG.colors.sky);
    this.scene.fog = new THREE.FogExp2(CFG.colors.fog, 0.0026);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);
    this.camera.position.set(0, 8, -14);

    // Moonlight + a dim blue ambient so the night reads.
    const moon = new THREE.DirectionalLight(0x8fa3ff, 0.9);
    moon.position.set(220, 320, 120);
    this.scene.add(moon);
    this.scene.add(new THREE.AmbientLight(0x27334d, 1.1));
    const hemi = new THREE.HemisphereLight(0x0a1030, 0x050505, 0.7);
    this.scene.add(hemi);

    // Stars.
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.42 + 0.08;
      const r = 950;
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[i * 3 + 1] = Math.sin(e) * r;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false })));

    // The moon: a pale disc high in the sky.
    const moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }),
    );
    moonDisc.position.set(-260, 300, -620);
    moonDisc.lookAt(0, 0, 0);
    this.scene.add(moonDisc);

    // Rain: a box of falling points that follows the camera.
    const rainGeo = new THREE.BufferGeometry();
    this.rainPos = new Float32Array(RAIN_COUNT * 3);
    this.rainVel = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainPos[i * 3] = (Math.random() - 0.5) * 70;
      this.rainPos[i * 3 + 1] = Math.random() * 40;
      this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      this.rainVel[i] = 26 + Math.random() * 10;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9db8ff, size: 0.16, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    this.camMode = 'chase';
    this.camPos = new THREE.Vector3(0, 8, -14);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.fixed = null; // when set, the camera stays exactly here (shots)
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Place the camera exactly (used by staged shots). */
  setFixed(pos, look) {
    this.fixed = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) };
    this.camera.position.copy(this.fixed.pos);
    this.camera.lookAt(this.fixed.look);
  }

  clearFixed() {
    this.fixed = null;
  }

  /** Follow a target: chase cam behind it, or the classic high angle. */
  follow(dt, target, heading, inCar) {
    if (this.fixed) return;
    const back = inCar ? 11 : 6.5;
    const up = inCar ? 4.6 : 3.2;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    let wantPos;
    let wantLook;
    if (this.camMode === 'classic') {
      wantPos = new THREE.Vector3(target.x - fx * 10, 26, target.z - fz * 10);
      wantLook = new THREE.Vector3(target.x + fx * 8, 0, target.z + fz * 8);
    } else {
      wantPos = new THREE.Vector3(target.x - fx * back, up, target.z - fz * back);
      wantLook = new THREE.Vector3(target.x + fx * 7, 1.4, target.z + fz * 7);
    }
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Orbit the skyline slowly (title screen background). */
  orbit(dt, time) {
    if (this.fixed) return;
    const a = time * 0.03;
    const r = 320;
    this.camera.position.set(Math.sin(a) * r, 90, Math.cos(a) * r);
    this.camera.lookAt(0, 20, 0);
  }

  update(dt) {
    // Rain falls and wraps inside its box; the box follows the camera.
    const cx = this.camera.position.x;
    const cz = this.camera.position.z;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = this.rainPos[i * 3 + 1] - this.rainVel[i] * dt;
      if (y < 0) y += 40;
      this.rainPos[i * 3 + 1] = y;
      // Keep the drops around the camera.
      let x = this.rainPos[i * 3];
      let z = this.rainPos[i * 3 + 2];
      if (x < cx - 35) x += 70;
      if (x > cx + 35) x -= 70;
      if (z < cz - 35) z += 70;
      if (z > cz + 35) z -= 70;
      this.rainPos[i * 3] = x;
      this.rainPos[i * 3 + 2] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
