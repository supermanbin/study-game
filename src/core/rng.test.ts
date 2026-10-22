import { describe, expect, it } from 'vitest';
import { mulberry32, randInt, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic per seed and within [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const c = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = c(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('randInt stays in range and hits both ends', () => {
    const r = mulberry32(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = randInt(r, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen.has(3)).toBe(true);
    expect(seen.has(7)).toBe(true);
  });
  it('shuffle returns a new permutation without mutating input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(mulberry32(5), input);
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
