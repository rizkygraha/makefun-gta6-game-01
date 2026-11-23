// Save games in localStorage (this browser only). A save keeps the story
// position, cash, REP, tapes and health — enough for CONTINUE to mean something.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.jobIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(G) {
  try {
    const data = {
      jobIndex: G.mission.jobIndex,
      cash: G.cash,
      rep: G.rep,
      tapes: G.tapes,
      health: Math.round(G.player.health),
      day: G.day,
      clock: G.clock,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
