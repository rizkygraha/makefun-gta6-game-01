// Sound, all synthesized with WebAudio — no audio files. Three radio stations
// (a step-sequenced synth loop each), engine hum, a two-tone siren, and SFX.
// Everything is guarded: with no user gesture yet, or no audio device, the
// game simply stays quiet.
import { RADIO_STATIONS } from './config.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Per-station step patterns: 16 steps, -1 = rest. Bass roots + a lead line.
const PATTERNS = [
  { bass: [45, -1, 45, -1, 48, -1, 45, -1, 43, -1, 43, -1, 50, -1, 48, -1], lead: [69, -1, 72, 76, -1, 74, -1, 72, 69, -1, 67, -1, 72, -1, 76, 79] },
  { bass: [41, -1, -1, 44, -1, 41, -1, -1, 46, -1, -1, 44, -1, 41, 39, -1], lead: [65, -1, 68, -1, 70, -1, 68, 65, -1, 63, -1, 65, 68, -1, 70, -1] },
  { bass: [38, -1, 38, -1, 38, -1, 41, -1, 38, -1, 38, -1, 43, -1, 41, -1], lead: [62, -1, -1, 62, -1, 65, -1, -1, 62, -1, 64, -1, 62, -1, -1, 60] },
];

export function createAudio() {
  const A = {
    ctx: null, master: null, noiseBuf: null,
    radioGain: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenT: 0, sirenHigh: false,
    nextNoteAt: 0, step: 0,
  };

  function ensure() {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.32;
      A.master.connect(A.ctx.destination);
      const len = A.ctx.sampleRate * 0.5;
      A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      A.radioGain = A.ctx.createGain();
      A.radioGain.gain.value = 0.16;
      A.radioGain.connect(A.master);
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 50;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      A.engineOsc.connect(A.engineGain);
      A.engineGain.connect(A.master);
      A.engineOsc.start();
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'sine';
      A.sirenOsc.frequency.value = 720;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain);
      A.sirenGain.connect(A.master);
      A.sirenOsc.start();
      A.nextNoteAt = A.ctx.currentTime + 0.1;
      return true;
    } catch {
      return false;
    }
  }

  function note(freq, at, dur, type, gain, dest) {
    const osc = A.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(g);
    g.connect(dest || A.radioGain);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function noise(at, dur, gain, freq) {
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    const filter = A.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq || 1800;
    filter.Q.value = 0.8;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(A.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  const api = {
    ensure,
    update(G, dt) {
      if (!A.ctx || A.ctx.state !== 'running') return;
      const st = RADIO_STATIONS[G.radio.station];
      const pat = PATTERNS[G.radio.station];
      const stepDur = 60 / st.bpm / 2; // eighth notes
      // Schedule radio steps a little ahead.
      while (A.nextNoteAt < A.ctx.currentTime + 0.12) {
        const s = A.step % 16;
        const bass = pat.bass[s];
        const lead = pat.lead[s];
        if (bass >= 0) note(midiToFreq(bass), A.nextNoteAt, stepDur * 1.8, st.wave, 0.5);
        if (lead >= 0) note(midiToFreq(lead), A.nextNoteAt, stepDur * 0.9, st.wave === 'sawtooth' ? 'square' : 'sine', 0.22);
        A.step += 1;
        A.nextNoteAt += stepDur;
      }
      // Engine hum follows the player's car speed.
      const speed = G.player.onFoot ? 0 : Math.abs(G.player.car ? G.player.car.speed : 0);
      A.engineOsc.frequency.setTargetAtTime(46 + speed * 2.6, A.ctx.currentTime, 0.08);
      A.engineGain.gain.setTargetAtTime(G.player.onFoot ? 0 : 0.05, A.ctx.currentTime, 0.1);
      // Two-tone siren while wanted.
      if (G.wanted > 0) {
        A.sirenT += dt;
        if (A.sirenT > 0.42) {
          A.sirenT = 0;
          A.sirenHigh = !A.sirenHigh;
          A.sirenOsc.frequency.setTargetAtTime(A.sirenHigh ? 960 : 720, A.ctx.currentTime, 0.02);
        }
        A.sirenGain.gain.setTargetAtTime(0.045, A.ctx.currentTime, 0.1);
      } else {
        A.sirenGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.1);
      }
    },
    sfx(name) {
      if (!ensure() || !A.ctx || A.ctx.state !== 'running') return;
      const t = A.ctx.currentTime;
      try {
        if (name === 'shoot') noise(t, 0.12, 0.5, 2400);
        else if (name === 'enemyShoot') noise(t, 0.1, 0.22, 1600);
        else if (name === 'punch') noise(t, 0.08, 0.3, 500);
        else if (name === 'empty' || name === 'reload') note(1200, t, 0.05, 'square', 0.12);
        else if (name === 'pickup') { note(midiToFreq(76), t, 0.12, 'sine', 0.3); note(midiToFreq(81), t + 0.09, 0.18, 'sine', 0.3); }
        else if (name === 'payout') { [69, 73, 76, 81].forEach((m, i) => note(midiToFreq(m), t + i * 0.09, 0.22, 'triangle', 0.3)); }
        else if (name === 'crash') noise(t, 0.3, 0.6, 300);
        else if (name === 'down') { note(midiToFreq(64), t, 0.2, 'sawtooth', 0.2); note(midiToFreq(57), t + 0.12, 0.3, 'sawtooth', 0.2); }
      } catch { /* audio is best-effort */ }
    },
  };
  // First gesture unlocks audio.
  window.addEventListener('pointerdown', ensure, { once: false });
  window.addEventListener('keydown', ensure, { once: false });
  return api;
}
