// NEON TIDE — random.js
// Seeded RNG (mulberry32) so a seed always builds the same city and the same
// shot frames. Deterministic: same seed, same game.

// mulberry32: a tiny, well-tested seeded PRNG. Returns a function in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  f() { return this.next(); }
  // Float in [a, b).
  range(a, b) { return a + (b - a) * this.next(); }
  // Integer in [a, b] inclusive.
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  // True with probability p.
  chance(p) { return this.next() < p; }
  // One element of an array.
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // Random sign.
  sign() { return this.next() < 0.5 ? -1 : 1; }
}
