import { describe, expect, it } from 'vitest';
import { LEVELS, getLevel } from './levels';

describe('levels', () => {
  it('defines six levels', () => {
    expect(LEVELS.map(l => l.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('level 1 uses b <= 5, level 2 uses b >= 6', () => {
    expect(getLevel(1).facts).toHaveLength(15);
    expect(getLevel(1).facts.every(f => f.b <= 5)).toBe(true);
    expect(getLevel(2).facts).toHaveLength(30);
    expect(getLevel(2).facts.every(f => f.b >= 6)).toBe(true);
  });
  it('levels 3-6 use all 45 facts', () => {
    for (const id of [3, 4, 5, 6] as const) expect(getLevel(id).facts).toHaveLength(45);
  });
  it('time limits, bosses, kinds', () => {
    expect(LEVELS.map(l => l.timeLimitSec)).toEqual([140, 150, 110, 110, 120, 110]);
    expect(LEVELS.filter(l => l.boss).map(l => l.id)).toEqual([3, 6]);
    expect(LEVELS.map(l => l.kinds)).toEqual([
      ['mul'], ['mul'], ['mul', 'reverse'], ['mulAddSub'], ['div'], ['mul', 'reverse', 'mulAddSub', 'div'],
    ]);
  });
});
