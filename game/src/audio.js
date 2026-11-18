// NEON TIDE — audio.js
// WebAudio synth: three radio stations (a step sequencer playing bass, lead
// and hats from each station's scale) plus one-shot sound effects and a
// two-tone police siren. No audio files. Everything is guarded so the game
// plays exactly the same with sound unavailable.

import { CFG } from './config.js';

const SEMI = (n) => Math.pow(2, n / 12);

export class AudioSys {
  constructor(game) {
    this.g = game;
    this.ctx = null;
    this.master = null;
    this.radioOn = false;
    this.station = 0;
    this.step = 0;
    this.nextTime = 0;
    this.sirenOn = false;
    this.sirenTone = 0;
    this.sirenNext = 0;
    this._timer = null;
  }

  // Call from a user gesture (click / key). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      this._timer = setInterval(() => this._tick(), 60);
    } catch (e) {
      this.ctx = null;
    }
  }

  setStation(i) {
    this.station = ((i % CFG.radio.length) + CFG.radio.length) % CFG.radio.length;
    this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
  }

  setSiren(on) {
    this.sirenOn = on;
  }

  _note(freq, time, dur, type, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    gn.gain.setValueAtTime(0, time);
    gn.gain.linearRampToValueAtTime(vol, time + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(gn);
    gn.connect(this.master);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  _noise(time, dur, vol, freq) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = freq || 3000;
    const gn = this.ctx.createGain();
    gn.gain.value = vol;
    src.connect(flt);
    flt.connect(gn);
    gn.connect(this.master);
    src.start(time);
  }

  _tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const st = CFG.radio[this.station];
    const stepDur = 60 / st.bpm / 4; // 16th notes
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    // Chord roots for a 4-bar loop (semitones from the station root).
    const roots = [0, -4, 5, 7];
    while (this.nextTime < this.ctx.currentTime + 0.22) {
      const bar = Math.floor(this.step / 16) % 4;
      const s16 = this.step % 16;
      const root = st.root * SEMI(roots[bar]);
      // Bass on every beat.
      if (s16 % 4 === 0) this._note(root / 2, this.nextTime, stepDur * 3.2, 'sine', 0.5);
      // Lead arp: walk the scale, one note per 8th.
      if (s16 % 2 === 0) {
        const deg = st.scale[(this.step * 3 + bar) % st.scale.length];
        this._note(root * SEMI(deg) * 2, this.nextTime, stepDur * 1.6, st.wave, 0.10);
      }
      // Hat on the off-beats.
      if (s16 % 4 === 2) this._noise(this.nextTime, 0.03, 0.05, 6000);
      this.nextTime += stepDur;
      this.step++;
    }
    // Police siren: two alternating tones.
    if (this.sirenOn && this.ctx.currentTime >= this.sirenNext) {
      this.sirenTone = 1 - this.sirenTone;
      this._note(this.sirenTone ? 740 : 960, this.ctx.currentTime, 0.34, 'sine', 0.05);
      this.sirenNext = this.ctx.currentTime + 0.38;
    }
  }

  sfx(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shoot':
        this._noise(t, 0.07, 0.22, 1800);
        this._note(170, t, 0.07, 'square', 0.12);
        break;
      case 'dry':
        this._note(900, t, 0.03, 'square', 0.08);
        break;
      case 'reload':
        this._note(500, t, 0.04, 'square', 0.08);
        this._note(700, t + 0.09, 0.04, 'square', 0.08);
        break;
      case 'hit':
        this._note(140, t, 0.12, 'sine', 0.25);
        break;
      case 'whizz':
        this._noise(t, 0.12, 0.06, 5000);
        break;
      case 'pickup':
        this._note(660, t, 0.09, 'sine', 0.16);
        this._note(880, t + 0.08, 0.09, 'sine', 0.16);
        this._note(1320, t + 0.16, 0.14, 'sine', 0.14);
        break;
      case 'steal':
        this._note(220, t, 0.16, 'sawtooth', 0.12);
        break;
      case 'door':
        this._note(180, t, 0.08, 'sine', 0.2);
        break;
      case 'crash':
        this._noise(t, 0.22, 0.3, 700);
        this._note(70, t, 0.2, 'sine', 0.3);
        break;
      case 'stage':
        this._note(880, t, 0.1, 'sine', 0.15);
        break;
      case 'job':
        this._note(523, t, 0.1, 'sine', 0.15);
        this._note(784, t + 0.1, 0.14, 'sine', 0.15);
        break;
      case 'complete':
        [523, 659, 784, 1047].forEach((f, i) => this._note(f, t + i * 0.09, 0.14, 'sine', 0.15));
        break;
      case 'down':
        this._note(330, t, 0.1, 'square', 0.1);
        this._note(220, t + 0.08, 0.16, 'square', 0.1);
        break;
      case 'wasted':
      case 'busted':
        [392, 330, 262, 196].forEach((f, i) => this._note(f, t + i * 0.16, 0.2, 'sawtooth', 0.1));
        break;
      default:
        break;
    }
  }
}
