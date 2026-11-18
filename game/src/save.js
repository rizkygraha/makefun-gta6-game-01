// NEON TIDE — saves in localStorage (this browser only). A save keeps the
// cash, respect, day, clock and job, so CONTINUE can pick up where the
// player left off. Nothing leaves the machine.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      cash: game.cash,
      rep: game.rep,
      day: game.day,
      clock: game.clock,
      jobIndex: game.mission.jobIndex,
      tapes: game.stats.tapes,
      jobsDone: game.stats.jobsDone,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
