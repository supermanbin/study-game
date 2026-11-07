import { describe, expect, it } from 'vitest';
import type { LevelResult } from '../core/session';
import { CELEBRATION_MAX_MS, type CelebrationStep, celebrationDurationMs, celebrationSteps } from './celebration';

function res(over: Partial<LevelResult> = {}): LevelResult {
  return { levelId: 1, passed: true, correctCount: 20, score: 480, timeBonus: 55, totalScore: 535, stars: 3, ...over };
}

const failed = res({ passed: false, failReason: 'notEnough', correctCount: 12, stars: 0 });
const scripts: [string, LevelResult][] = [
  ['3 stars', res()],
  ['2 stars', res({ stars: 2, correctCount: 18 })],
  ['1 star', res({ stars: 1, correctCount: 16 })],
  ['failed', failed],
];

const ofKind = <K extends CelebrationStep['kind']>(steps: CelebrationStep[], kind: K) =>
  steps.filter((s): s is Extract<CelebrationStep, { kind: K }> => s.kind === kind);

describe('celebrationSteps', () => {
  it('steps are sorted by time', () => {
    for (const [, r] of scripts) {
      const steps = celebrationSteps(r);
      for (let i = 1; i < steps.length; i++) expect(steps[i].at).toBeGreaterThanOrEqual(steps[i - 1].at);
    }
  });

  it('passed page drops one star per earned star at 500 + 350·i, each with a correct sfx', () => {
    const steps = celebrationSteps(res({ stars: 2, correctCount: 18 }));
    expect(ofKind(steps, 'star')).toEqual([
      { at: 500, kind: 'star', index: 0 },
      { at: 850, kind: 'star', index: 1 },
    ]);
    expect(ofKind(steps, 'sfx').filter(s => s.name === 'correct').map(s => s.at)).toEqual([500, 850]);
  });

  it('passed page opens with title and pass sfx at 0 and counts correct/score/bonus at 300/700/900', () => {
    const steps = celebrationSteps(res());
    expect(ofKind(steps, 'title')).toEqual([{ at: 0, kind: 'title' }]);
    expect(ofKind(steps, 'sfx').filter(s => s.name === 'pass')).toEqual([{ at: 0, kind: 'sfx', name: 'pass' }]);
    expect(ofKind(steps, 'count')).toEqual([
      { at: 300, kind: 'count', line: 'correct', durationMs: 500 },
      { at: 700, kind: 'count', line: 'score', durationMs: 600 },
      { at: 900, kind: 'count', line: 'bonus', durationMs: 600 },
    ]);
    expect(ofKind(steps, 'reason')).toEqual([]);
  });

  it('three stars add confetti and the threeStars voice 250 ms after the last star', () => {
    const steps = celebrationSteps(res());
    expect(ofKind(steps, 'confetti')).toEqual([{ at: 1450, kind: 'confetti' }]);
    expect(ofKind(steps, 'voice')).toEqual([{ at: 1450, kind: 'voice', category: 'threeStars' }]);
  });

  it('one or two stars play levelPass instead of confetti', () => {
    const steps = celebrationSteps(res({ stars: 1, correctCount: 16 }));
    expect(ofKind(steps, 'confetti')).toEqual([]);
    expect(ofKind(steps, 'voice')).toEqual([{ at: 750, kind: 'voice', category: 'levelPass' }]);
  });

  it('failed page has no star, confetti or pass steps', () => {
    const steps = celebrationSteps(failed);
    expect(steps.every(s => ['title', 'reason', 'count', 'voice'].includes(s.kind))).toBe(true);
    expect(ofKind(steps, 'reason')).toEqual([{ at: 200, kind: 'reason' }]);
    expect(ofKind(steps, 'count')).toEqual([{ at: 300, kind: 'count', line: 'correct', durationMs: 500 }]);
    expect(ofKind(steps, 'voice')).toEqual([{ at: 600, kind: 'voice', category: 'levelFail' }]);
  });

  it('every script has exactly one voice step', () => {
    for (const [, r] of scripts) expect(ofKind(celebrationSteps(r), 'voice')).toHaveLength(1);
  });

  it('every script fits in CELEBRATION_MAX_MS', () => {
    for (const [, r] of scripts) expect(celebrationDurationMs(celebrationSteps(r))).toBeLessThanOrEqual(CELEBRATION_MAX_MS);
  });
});

describe('celebrationDurationMs', () => {
  it('is the latest step end: at plus the step kind’s own duration', () => {
    expect(celebrationDurationMs([{ at: 100, kind: 'count', line: 'score', durationMs: 600 }])).toBe(700);
    expect(celebrationDurationMs([{ at: 1450, kind: 'confetti' }, { at: 1450, kind: 'voice', category: 'threeStars' }])).toBe(2450);
    expect(celebrationDurationMs([])).toBe(0);
  });
});
