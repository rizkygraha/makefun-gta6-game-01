// NEON TIDE — render.js
// The three.js stage: renderer, scene, fog, lights, rain and the cameras.
// No shadows (too slow on software rasterisers); the night look comes from
// fog, emissive materials and a handful of point lights.

import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

export class RenderSys {
  constructor(game, container) {
    this.g = game;
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(container.clientWidth || 1024, container.clientHeight || 640);
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CFG.palette.sky);
    this.scene.fog = new THREE.FogExp2(CFG.palette.fog, 0.0032);

    this.camera = new THREE.PerspectiveCamera(62, 1024 / 640, 0.1, 900);
    this.camera.position.set(40, 30, 90);
    this.camera.lookAt(0, 4, 0);

    // Moon + sky fill.
    const hemi = new THREE.HemisphereLight(0x2a3a66, 0x0a0a14, 0.85);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x9db8ff, 0.55);
    moon.position.set(120, 220, 60);
    this.scene.add(moon);

    // A pale moon disc in the sky.
    const moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })
    );
    moonDisc.position.set(-160, 190, -260);
    moonDisc.lookAt(0, 0, 0);
    this.scene.add(moonDisc);

    // Rain: one Points cloud that follows the camera target.
    const rainCount = 1300;
    const pos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = Math.random() * 70;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0x8fb8ff, size: 0.4, transparent: true, opacity: 0.45, sizeAttenuation: true,
    }));
    this.rain.position.set(0, 0, 0);
    this.scene.add(this.rain);
    this.rainCount = rainCount;

    // Camera state.
    this.mode = 'title';       // 'title' | 'chase' | 'classic' | 'map' | 'fixed'
    this.fixedPos = new THREE.Vector3(40, 30, 90);
    this.fixedLook = new THREE.Vector3(0, 4, 0);
    this.camPos = new THREE.Vector3(40, 30, 90);
    this.camLook = new THREE.Vector3(0, 4, 0);
    this.titleAngle = 0.6;

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.container.clientWidth || 1024;
    const h = this.container.clientHeight || 640;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Hold the camera at one pose (used by the shot staging).
  setFixed(pos, look) {
    this.mode = 'fixed';
    this.fixedPos.copy(pos);
    this.fixedLook.copy(look);
    this.camPos.copy(pos);
    this.camLook.copy(look);
  }

  setMode(mode) { this.mode = mode; }

  update(dt) {
    const g = this.g;
    const p = g.player;
    // Rain falls and wraps around the camera target.
    const arr = this.rain.geometry.attributes.position.array;
    for (let i = 0; i < this.rainCount; i++) {
      arr[i * 3 + 1] -= 55 * dt;
      arr[i * 3] += 6 * dt;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 70;
      if (arr[i * 3] > 110) arr[i * 3] = -110;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    const tx = p ? p.pos.x : 0;
    const tz = p ? p.pos.z : 0;
    this.rain.position.set(tx, 0, tz);

    // Where the camera wants to be this frame.
    let wantPos = null;
    let wantLook = null;
    if (this.mode === 'fixed') {
      wantPos = this.fixedPos; wantLook = this.fixedLook;
    } else if (this.mode === 'title') {
      this.titleAngle += dt * 0.02;
      const r = 150;
      wantPos = new THREE.Vector3(Math.sin(this.titleAngle) * r, 42, Math.cos(this.titleAngle) * r);
      wantLook = new THREE.Vector3(0, 12, 0);
    } else if (this.mode === 'map') {
      wantPos = new THREE.Vector3(tx, 250, tz + 0.5);
      wantLook = new THREE.Vector3(tx, 0, tz);
    } else if (p) {
      const heading = p.heading;
      const fx = Math.sin(heading), fz = Math.cos(heading);
      if (this.mode === 'classic') {
        wantPos = new THREE.Vector3(p.pos.x - fx * 15, 11, p.pos.z - fz * 15);
        wantLook = new THREE.Vector3(p.pos.x + fx * 6, 1.5, p.pos.z + fz * 6);
      } else {
        // chase camera
        const dist = p.mode === 'car' ? 11.5 : 7.5;
        const height = p.mode === 'car' ? 4.6 : 3.2;
        wantPos = new THREE.Vector3(p.pos.x - fx * dist, height, p.pos.z - fz * dist);
        wantLook = new THREE.Vector3(p.pos.x + fx * 9, 1.6, p.pos.z + fz * 9);
      }
      // Mouse-look: orbit the chase camera around the player.
      if (p.camYawOffset) {
        const a = heading + p.camYawOffset;
        const dist = p.mode === 'car' ? 11.5 : 7.5;
        const height = p.mode === 'car' ? 4.6 : 3.2;
        wantPos = new THREE.Vector3(p.pos.x - Math.sin(a) * dist, height, p.pos.z - Math.cos(a) * dist);
      }
    }
    if (wantPos && wantLook) {
      const k = this.mode === 'fixed' || this.mode === 'map' ? 1 : Math.min(1, dt * 6);
      this.camPos.lerp(wantPos, k);
      this.camLook.lerp(wantLook, k);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
