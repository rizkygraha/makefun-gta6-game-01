// WebAudio synth. No audio files: every station is a looping oscillator
// pattern, every effect a shaped noise burst. Silent until the first user
// gesture, so headless screenshot runs never block on audio.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.radioTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.16;
      this.radioGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      return true;
    } catch {
      return false;
    }
  }

  setStation(i) {
    this.station = i;
    this.step = 0;
  }

  startRadio() {
    if (!this.ensure()) return;
    if (this.radioTimer) return;
    this.radioTimer = setInterval(() => this._radioStep(), 190);
  }

  stopRadio() {
    if (this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  _radioStep() {
    if (!this.ctx || this.muted) return;
    const roots = [55, 65.41, 49];
    const root = roots[this.station % roots.length];
    const scale = [1, 1.189, 1.335, 1.498, 1.782, 2];
    const note = scale[this.step % scale.length];
    const osc = this.ctx.createOscillator();
    osc.type = this.station === 2 ? 'triangle' : 'sawtooth';
    osc.frequency.value = root * note;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(this.radioGain);
    osc.start(t);
    osc.stop(t + 0.2);
    if (this.step % 2 === 0) this._hat();
    this.step += 1;
  }

  _hat() {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * 0.03);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.25;
    src.connect(g);
    g.connect(this.radioGain);
    src.start();
  }

  _burst(duration, freq, type, vol) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.25), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  shoot() {
    this._burst(0.09, 900, 'square', 0.4);
  }

  hit() {
    this._burst(0.12, 220, 'sawtooth', 0.35);
  }

  pickup() {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.15);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.2);
    });
  }

  siren() {
    this._burst(0.5, 700, 'sine', 0.12);
  }

  setEngine(running, speedNorm) {
    if (!this.ensure() || this.muted) return;
    if (!running) {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch { /* already stopped */ }
        this.engineOsc = null;
        this.engineGain = null;
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 60 + speedNorm * 160;
    this.engineGain.gain.value = 0.03 + speedNorm * 0.06;
  }
}
