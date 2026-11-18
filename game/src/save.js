// Saves. One localStorage key, one JSON blob: cash, REP, jobs done, tapes,
// and where Mara was standing. CONTINUE reads it back on the title screen.

const KEY = 'neon-tide-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      rep: state.rep,
      jobIndex: state.missions.jobIndex,
      jobsDone: state.missions.jobsDone,
      tapes: state.missions.tapes,
      day: state.day,
      px: state.player.pos.x,
      pz: state.player.pos.z,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; a new game just starts fresh
  }
}
