// NEON TIDE — save.js
// localStorage saves: cash, REP, job progress, Tide Tapes, day and time.
// One key, one JSON object, guarded so a broken or missing save never
// stops the game.

const KEY = 'neon-tide-save-v1';

export function defaultSave() {
  return {
    cash: 420,
    rep: 0,
    jobIndex: 0,
    tapes: 0,
    tapesFound: [],
    day: 1,
    timeMinutes: 22 * 60 + 15,
    chapter: 1,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return Object.assign(defaultSave(), data);
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

// Human-readable clock line for the title screen's CONTINUE card.
export function clockLine(day, timeMinutes) {
  const h = Math.floor(timeMinutes / 60) % 24;
  const m = Math.floor(timeMinutes % 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return 'Day ' + day + '  ' + hh + ':' + mm;
}
