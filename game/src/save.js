// save.js — localStorage saves: chapter, cash, day, time, REP, the jobs
// finished, the tapes found and the properties owned. CONTINUE on the
// title screen reads this back.

const KEY = 'neon-tide-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable; the game still runs.
  }
}

/** The save shape the title screen shows. */
export function defaultSave() {
  return {
    chapter: 1,
    cash: 320,
    day: 1,
    time: '21:40',
    rep: 1,
    jobsDone: [],
    tapes: 0,
    properties: 0,
  };
}
