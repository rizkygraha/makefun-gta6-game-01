// random.js — a small seeded random generator (mulberry32) so the city,
// traffic and shots are deterministic: the same seed always builds the
// same Tidewater and stages the same screenshot frames.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded RNG with the helpers the game uses. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of an array. */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** A shuffled copy of an array (Fisher–Yates). */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i];
        out[i] = out[j];
        out[j] = t;
      }
      return out;
    },
  };
}
