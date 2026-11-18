// The three.js stage: renderer, night lighting, rain, and the two cameras
// (3D chase and classic high). The camera follows the player with a smooth
// lag so driving feels heavy and on-foot feels close.

import * as THREE from '../vendor/three.module.js';
import { COLORS } from './config.js';

export class RenderStage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.night);
    this.scene.fog = new THREE.Fog(COLORS.fog, 60, 320);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 30, 60);
    this.camPos = new THREE.Vector3(0, 30, 60);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.mode = 'chase';
    this.rainCount = 1600;
    this.rainVel = new Float32Array(this.rainCount);
    this._buildLights();
    this._buildRain();
    window.addEventListener('resize', () => this.resize());
  }

  _buildLights() {
    const amb = new THREE.AmbientLight(0x2a3560, 0.85);
    this.scene.add(amb);
    const hemi = new THREE.HemisphereLight(0x33406e, 0x0a0c14, 0.5);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x8fa3ff, 0.7);
    moon.position.set(-80, 140, -60);
    this.scene.add(moon);
    const spots = [
      [20, -20, 0xff2d78],
      [-180, 200, 0x2de2ff],
      [0, -200, 0x8f7bff],
      [180, 180, 0x2dff8f],
    ];
    for (const [x, z, color] of spots) {
      const p = new THREE.PointLight(color, 900, 90, 1.8);
      p.position.set(x, 18, z);
      this.scene.add(p);
    }
  }

  _buildRain() {
    const pos = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
      this.rainVel[i] = 28 + Math.random() * 22;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: COLORS.rain,
      size: 0.35,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    this.rain = new THREE.Points(geo, mat);
    this.scene.add(this.rain);
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  updateRain(dt, cx, cz) {
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < this.rainCount; i++) {
      let y = pos.getY(i) - this.rainVel[i] * dt;
      if (y < 0) {
        y = 55 + Math.random() * 5;
        pos.setX(i, cx + (Math.random() - 0.5) * 220);
        pos.setZ(i, cz + (Math.random() - 0.5) * 220);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.rain.position.x = 0;
    this.rain.position.z = 0;
  }

  follow(dt, target, heading, speed, inCar) {
    const back = inCar ? 13 : 8;
    const height = this.mode === 'classic' ? 22 : inCar ? 5.5 : 4;
    const dist = this.mode === 'classic' ? 26 : back;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const wantX = target.x - fx * dist;
    const wantZ = target.z - fz * dist;
    const wantY = height + (inCar ? speed * 0.04 : 0);
    const k = 1 - Math.pow(0.0001, dt);
    this.camPos.x += (wantX - this.camPos.x) * k;
    this.camPos.y += (wantY - this.camPos.y) * k;
    this.camPos.z += (wantZ - this.camPos.z) * k;
    this.camLook.x += (target.x - this.camLook.x) * k;
    this.camLook.y += ((inCar ? 2 : 1.6) - this.camLook.y) * k;
    this.camLook.z += (target.z - this.camLook.z) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  setView(position, look) {
    this.camPos.copy(position);
    this.camLook.copy(look);
    this.camera.position.copy(position);
    this.camera.lookAt(look);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
