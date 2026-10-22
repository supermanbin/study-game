import { describe, it, expect } from 'vitest';
import {
  statKey,
  weightOf,
  recordResult,
  pickWeighted,
  type StatRecord,
} from './stats';

describe('statKey', () => {
  it('builds an order-normalized fact key plus kind', () => {
    expect(statKey({ a: 3, b: 4 }, 'div')).toBe('3x4:div');
    expect(statKey({ a: 4, b: 3 }, 'mul')).toBe('3x4:mul');
  });
});

describe('weightOf', () => {
  it('is 1 for facts without a record', () => {
    expect(weightOf(undefined)).toBe(1);
  });

  it('adds 0.5 per wrong/missed answer when streak is 0', () => {
    expect(weightOf({ correct: 0, wrong: 2, missed: 0, streak: 0 })).toBe(3);
  });

  it('halves the penalty for each streak point', () => {
    expect(weightOf({ correct: 1, wrong: 2, missed: 0, streak: 1 })).toBe(2);
  });

  it('caps the wrong+missed term at 4', () => {
    expect(weightOf({ correct: 0, wrong: 9, missed: 3, streak: 0 })).toBe(5);
  });
});

describe('recordResult', () => {
  it('counts correct and extends the streak', () => {
    let s = recordResult({}, '3x4:mul', 'wrong');
    s = recordResult(s, '3x4:mul', 'correct');
    expect(s['3x4:mul']).toEqual({ correct: 1, wrong: 1, missed: 0, streak: 1 });
  });

  it('resets the streak on missed', () => {
    let s = recordResult({}, '3x4:mul', 'correct');
    s = recordResult(s, '3x4:mul', 'correct');
    s = recordResult(s, '3x4:mul', 'missed');
    expect(s['3x4:mul']).toEqual({ correct: 2, wrong: 0, missed: 1, streak: 0 });
  });

  it('resets the streak on wrong', () => {
    let s = recordResult({}, '3x4:mul', 'correct');
    s = recordResult(s, '3x4:mul', 'wrong');
    expect(s['3x4:mul']!.streak).toBe(0);
    expect(s['3x4:mul']!.wrong).toBe(1);
  });

  it('does not mutate its input', () => {
    const before = recordResult({}, '3x4:mul', 'wrong');
    const snapshot = JSON.parse(JSON.stringify(before));
    const after = recordResult(before, '3x4:mul', 'correct');
    expect(before).toEqual(snapshot);
    expect(after).not.toBe(before);
    expect(after['3x4:mul']).not.toBe(before['3x4:mul']);
  });

  it('keeps other keys untouched', () => {
    const base = recordResult({}, '2x5:div', 'wrong');
    const next = recordResult(base, '3x4:mul', 'correct');
    expect(next['2x5:div']).toBe(base['2x5:div']);
  });
});

describe('pickWeighted', () => {
  const items = ['a', 'b'];
  const weight = (x: string): number => (x === 'a' ? 1 : 3);

  it('picks by cumulative weight (low roll picks first item)', () => {
    expect(pickWeighted(items, weight, () => 0.2)).toBe('a');
  });

  it('picks by cumulative weight (high roll picks heavier item)', () => {
    expect(pickWeighted(items, weight, () => 0.5)).toBe('b');
  });

  it('returns the last item when roll is just under 1', () => {
    expect(pickWeighted(items, weight, () => 0.999999)).toBe('b');
  });

  it('is deterministic for a given rng', () => {
    const rec: StatRecord = { correct: 0, wrong: 1, missed: 0, streak: 0 };
    const w = (x: string) => (x === 'a' ? weightOf(rec) : 1);
    const r1 = pickWeighted(items, w, () => 0.7);
    const r2 = pickWeighted(items, w, () => 0.7);
    expect(r1).toBe(r2);
  });
});
