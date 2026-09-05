// SeededRandom: deterministic pseudo-random number generator for world generation.
// Uses a mulberry32 algorithm — fast, good distribution, deterministic given seed.
// Same seed always produces the same sequence, enabling reproducible world generation.
//
// No hardcoded world content — this is a generic utility.

/**
 * SeededRandom: deterministic PRNG for procedural world generation.
 *
 * Uses mulberry32 algorithm. Given the same seed, produces the same sequence
 * of random numbers, enabling reproducible worlds.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number | string) {
    this.state = this.hashSeed(seed);
  }

  /** Hash a seed (number or string) into a 32-bit unsigned integer. */
  private hashSeed(seed: number | string): number {
    if (typeof seed === "number") {
      return seed >>> 0;
    }
    // Simple string hash (FNV-1a style).
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /**
   * Generate the next random number in [0, 1).
   * mulberry32 algorithm.
   */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Generate a random integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Generate a random float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Return true with probability p (0 to 1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a random element from an array. */
  pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick n distinct random elements from an array (without replacement). */
  sample<T>(arr: T[], n: number): T[] {
    if (n > arr.length) {
      throw new Error(`Cannot sample ${n} elements from array of length ${arr.length}`);
    }
    const copy = [...arr];
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  /** Shuffle an array (Fisher-Yates), returns a new array. */
  shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** Get the current internal state (for serialization). */
  getState(): number {
    return this.state;
  }

  /** Set the internal state (for deserialization / resuming). */
  setState(state: number): void {
    this.state = state >>> 0;
  }

  /** Create a new SeededRandom from a sub-seed derived from this generator. */
  fork(): SeededRandom {
    return new SeededRandom(this.nextInt(0, 0xffffffff));
  }
}
