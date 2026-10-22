import { describe, it, expect } from 'vitest';
import { defaultProgress, recordOutcome, applyLevelResult, isCardLit, parseProgress } from './progress';
import type { QuestionOutcome, LevelResult } from './session';
import type { LevelId } from './types';

const out = (kind: string, result: QuestionOutcome['result']): QuestionOutcome => ({
  statKey: `3x4:${kind}` as QuestionOutcome['statKey'],
  factKey: '3x4',
  result,
});
const lr = (levelId: LevelId, stars: 0 | 1 | 2 | 3, totalScore: number, passed = stars > 0): LevelResult => ({
  levelId, passed, correctCount: 16, score: totalScore, timeBonus: 0, totalScore, stars,
});

describe('defaultProgress', () => {
  it('has expected defaults', () => {
    const d = defaultProgress(1);
    expect(d.unlockedLevel).toBe(1);
    expect(d.profileId).toBe('default');
    expect(d.version).toBe(1);
    expect(d.updatedAt).toBe(1);
    expect(d.settings).toEqual({ music: true, voice: true, sfx: true });
    expect(defaultProgress(1, 'kid').profileId).toBe('kid');
  });
});

describe('cards', () => {
  it('lights after 3 correct across kinds', () => {
    let d = defaultProgress(0);
    d = recordOutcome(d, out('mul', 'correct'), 1);
    d = recordOutcome(d, out('div', 'correct'), 2);
    expect(isCardLit(d, '3x4')).toBe(false);
    d = recordOutcome(d, out('mulAddSub', 'correct'), 3);
    expect(isCardLit(d, '3x4')).toBe(true);
    expect(d.updatedAt).toBe(3);
    expect(d.stats['3x4:div']?.correct).toBe(1);
  });
  it('wrong/missed do not add to cards', () => {
    let d = defaultProgress(0);
    d = recordOutcome(d, out('mul', 'wrong'), 1);
    d = recordOutcome(d, out('mul', 'missed'), 2);
    expect(d.cards['3x4']).toBeUndefined();
    expect(d.stats['3x4:mul']?.wrong).toBe(1);
  });
});

describe('applyLevelResult', () => {
  it('unlocks next level and records best', () => {
    const d = applyLevelResult(defaultProgress(0), lr(1, 2, 150), 5);
    expect(d.unlockedLevel).toBe(2);
    expect(d.levels[1]).toEqual({ bestStars: 2, bestScore: 150 });
    expect(d.updatedAt).toBe(5);
  });
  it('keeps best on replay', () => {
    let d = applyLevelResult(defaultProgress(0), lr(1, 2, 150), 5);
    d = applyLevelResult(d, lr(1, 1, 100), 6);
    expect(d.levels[1]).toEqual({ bestStars: 2, bestScore: 150 });
    d = applyLevelResult(d, lr(1, 3, 200), 7);
    expect(d.levels[1]).toEqual({ bestStars: 3, bestScore: 200 });
  });
  it('failed result changes only updatedAt', () => {
    const base = applyLevelResult(defaultProgress(0), lr(1, 1, 100), 1);
    const d = applyLevelResult(base, lr(2, 0, 999, false), 9);
    expect(d).toEqual({ ...base, updatedAt: 9 });
  });
  it('never lowers unlockedLevel; level 6 caps at 6', () => {
    let d = { ...defaultProgress(0), unlockedLevel: 4 as LevelId };
    d = applyLevelResult(d, lr(1, 1, 10), 1);
    expect(d.unlockedLevel).toBe(4);
    d = applyLevelResult({ ...d, unlockedLevel: 6 }, lr(6, 3, 10), 2);
    expect(d.unlockedLevel).toBe(6);
  });
});

describe('immutability', () => {
  it('does not mutate inputs', () => {
    const d = defaultProgress(0);
    const snap = JSON.stringify(d);
    recordOutcome(d, out('mul', 'correct'), 1);
    applyLevelResult(d, lr(1, 3, 10), 1);
    expect(JSON.stringify(d)).toBe(snap);
  });
});

describe('parseProgress', () => {
  it('accepts a valid round-trip', () => {
    let d = recordOutcome(defaultProgress(0), out('mul', 'correct'), 1);
    d = applyLevelResult(d, lr(1, 3, 10), 2);
    expect(parseProgress(JSON.parse(JSON.stringify(d)), 99)).toEqual(d);
  });
  it('rejects bad input', () => {
    const def = defaultProgress(7);
    expect(parseProgress(null, 7)).toEqual(def);
    expect(parseProgress('x', 7)).toEqual(def);
    expect(parseProgress({ ...def, version: 99 }, 7)).toEqual(def);
    expect(parseProgress({ ...def, unlockedLevel: 9 }, 7)).toEqual(def);
    expect(parseProgress({ ...def, levels: [] }, 7)).toEqual(def);
    expect(parseProgress({ ...def, stats: null }, 7)).toEqual(def);
    expect(parseProgress({ ...def, cards: { '3x4': 'a' } }, 7)).toEqual(def);
    expect(parseProgress({ ...def, settings: { music: 1 } }, 7)).toEqual(def);
    expect(parseProgress({ ...def, profileId: 5 }, 7)).toEqual(def);
  });
});
