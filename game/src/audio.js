// audio.js — WebAudio synth: three radio stations (a step sequencer with
// a bass line, a lead and hats), an engine hum that follows the car's
// speed, a two-tone siren that follows the wanted level, and small SFX.
// Everything is synthesized; there are no audio files. The context only
// starts on a user gesture, and every call is safe while it is suspended.

import { CFG } from './config.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.station = 0;
    this.beatTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenT = 0;
  }

  /** Create the context on a user gesture (autoplay policy). Safe to call twice. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this._startEngine();
      this._startSiren();
      this.setStation(0);
    } catch {
      this.ctx = null;
    }
  }

  _note(freq, when, dur, type, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  _hat(when) {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.05;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(when);
  }

  _scheduleBeat() {
    if (!this.ctx) return;
    const st = CFG.radio[this.station];
    const beatSec = 60 / st.bpm;
    const when = this.ctx.currentTime + 0.08;
    const bass = st.bass[this.step % st.bass.length];
    const lead = st.lead[this.step % st.lead.length];
    this._note(bass, when, beatSec * 0.9, st.wave, 0.5);
    if (this.step % 2 === 0) this._note(lead * 2, when, beatSec * 0.7, 'sine', 0.16);
    this._hat(when + beatSec / 2);
    this.step += 1;
    this.beatTimer = window.setTimeout(() => this._scheduleBeat(), beatSec * 1000);
  }

  setStation(i) {
    this.station = ((i % CFG.radio.length) + CFG.radio.length) % CFG.radio.length;
    if (this.beatTimer) {
      window.clearTimeout(this.beatTimer);
      this.beatTimer = null;
    }
    this.step = 0;
    if (this.ctx) this._scheduleBeat();
  }

  get stationName() {
    return CFG.radio[this.station].name;
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filt);
    filt.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  /** Call every frame: the hum follows the car's speed. */
  engine(speed, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const target = inCar ? Math.min(0.16, 0.03 + speed * 0.004) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 2.2, this.ctx.currentTime, 0.1);
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  /** Call every frame: the siren wails while the heat is on. */
  siren(dt, wanted) {
    if (!this.ctx || !this.sirenOsc) return;
    this.sirenT += dt;
    if (this.sirenT > 0.45) {
      this.sirenT = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 700;
    }
    this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.05 : 0, this.ctx.currentTime, 0.2);
  }

  shoot() {
    if (!this.ctx) return;
    const when = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.09;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(when);
  }

  blip(freq = 880) {
    if (!this.ctx) return;
    this._note(freq, this.ctx.currentTime, 0.12, 'sine', 0.3);
    this._note(freq * 1.5, this.ctx.currentTime + 0.1, 0.18, 'sine', 0.25);
  }

  missionDone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this._note(f, t + i * 0.09, 0.22, 'triangle', 0.3));
  }
}
