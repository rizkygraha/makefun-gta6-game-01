// NEON TIDE — sound, all synthesised with WebAudio: three radio stations
// (a step sequencer, no audio files) plus effects. Nothing plays until the
// player first interacts — browsers require a gesture — and nothing here
// throws when audio is unavailable.

import { RADIO } from './config.js';

function midi(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// 16-step patterns, one bar each. Notes are MIDI numbers, 0 = rest.
const PATTERNS = {
  synth: {
    bass: [33, 0, 33, 0, 36, 0, 33, 0, 31, 0, 31, 0, 36, 0, 38, 0],
    arp: [57, 60, 64, 69, 64, 60, 57, 60, 55, 59, 62, 67, 62, 59, 55, 59],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
  lofi: {
    bass: [45, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0],
    arp: [57, 60, 64, 67, 53, 57, 60, 65, 55, 59, 62, 67, 55, 59, 62, 67],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  },
  bass: {
    bass: [33, 33, 0, 33, 36, 0, 33, 0, 31, 31, 0, 31, 38, 0, 36, 0],
    arp: [0, 0, 69, 0, 0, 0, 67, 0, 0, 0, 69, 0, 0, 72, 0, 0],
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let step = 0;
  let nextStepTime = 0;
  let timer = null;
  let sirenHigh = false;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 42;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      timer = setInterval(schedule, 90);
      nextStepTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, gain, when = 0, slideTo = 0) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // A failed blip is silence, never a crash.
    }
  }

  function schedule() {
    if (!ctx) return;
    const stationDef = RADIO[station];
    const pattern = PATTERNS[stationDef.mood];
    const stepDur = 60 / stationDef.bpm / 4;
    while (nextStepTime < ctx.currentTime + 0.3) {
      const s = step % 16;
      const t = nextStepTime - ctx.currentTime;
      if (pattern.bass[s]) blip(midi(pattern.bass[s]), stepDur * 1.8, 'triangle', 0.5, t);
      if (pattern.arp[s]) blip(midi(pattern.arp[s]), stepDur * 0.9, stationDef.mood === 'bass' ? 'square' : 'sine', 0.16, t);
      if (pattern.kick[s]) blip(120, 0.12, 'sine', 0.5, t, 45);
      step += 1;
      nextStepTime += stepDur;
    }
  }

  return {
    ensure,
    station() { return station; },
    nextStation() {
      station = (station + 1) % RADIO.length;
      return RADIO[station];
    },
    shoot(name) {
      if (!ctx) return;
      if (name === 'SMG') blip(900, 0.07, 'square', 0.16, 0, 220);
      else if (name === 'SHOTGUN') blip(300, 0.16, 'square', 0.3, 0, 70);
      else blip(700, 0.09, 'square', 0.22, 0, 160);
    },
    enemyShot() {
      if (!ctx) return;
      blip(600, 0.06, 'square', 0.05, 0, 180);
    },
    reload() {
      blip(1400, 0.04, 'square', 0.12);
      blip(1000, 0.04, 'square', 0.12, 0.09);
    },
    engineStart() {
      blip(90, 0.4, 'sawtooth', 0.2, 0, 160);
    },
    gameOver() {
      blip(392, 0.3, 'triangle', 0.25);
      blip(311, 0.3, 'triangle', 0.25, 0.3);
      blip(233, 0.7, 'triangle', 0.25, 0.6);
    },
    /** Called every frame: engine hum follows speed, siren follows heat. */
    update(speed, wanted) {
      if (!ctx) return;
      try {
        engineOsc.frequency.value = 40 + Math.abs(speed) * 2.2;
        engineGain.gain.value = wanted !== undefined && speed > 0.5 ? 0.035 : 0.012;
        sirenTimer -= 1 / 60;
        if (sirenTimer <= 0) {
          sirenTimer = 0.45;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.value = sirenHigh ? 950 : 700;
        }
        sirenGain.gain.value = wanted > 0 ? 0.02 : 0;
      } catch {
        // Audio stays silent rather than breaking the frame.
      }
    },
  };
}
