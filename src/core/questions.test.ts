import { describe, expect, test } from 'vitest';
import { LEVELS, getLevel } from './levels';
import { mulberry32 } from './rng';
import { difficultyAt, evalLabel, generateQuestion } from './questions';

describe('questions', () => {
  test.each(LEVELS.map(l => [l.id, l] as const))('level %i invariants', (_, level) => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion(level, i, {}, rng);
        expect(level.kinds).toContain(q.kind);
        expect(level.facts).toContainEqual(q.fact);
        expect(q.options).toHaveLength(difficultyAt(i).optionCount);
        expect(new Set(q.options.map(o => o.label)).size).toBe(q.options.length);
        q.options.forEach((o, idx) => expect(o.id).toBe(idx));
        for (const o of q.options) {
          expect(o.correct).toBe(evalLabel(o.label) === q.answer);
          expect(evalLabel(o.label)).toBeGreaterThanOrEqual(0);
        }
        const nCorrect = q.options.filter(o => o.correct).length;
        if (q.kind === 'reverse') expect(nCorrect).toBeGreaterThanOrEqual(1);
        else expect(nCorrect).toBe(1);
      }
    }
  });

  test('prompt formats and kind-specific ranges', () => {
    const level = getLevel(6);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion(level, i, {}, rng);
        seen.add(q.kind);
        if (q.kind === 'mul') {
          expect(q.prompt).toMatch(/^\d × \d = \?$/);
        } else if (q.kind === 'reverse') {
          expect(q.prompt).toMatch(/^\d+ = \? × \?$/);
        } else if (q.kind === 'div') {
          expect(q.prompt).toMatch(/^\d+ ÷ \d = \?$/);
          const m = q.prompt.match(/^(\d+) ÷ (\d) = \?$/)!;
          const dividend = Number(m[1]);
          const divisor = Number(m[2]);
          const quotient = q.answer;
          expect(divisor).toBeGreaterThanOrEqual(1);
          expect(quotient).toBeGreaterThanOrEqual(1);
          expect(quotient).toBeLessThanOrEqual(9);
          expect(dividend).toBe(divisor * quotient);
        } else {
          expect(q.prompt).toMatch(/^\d × \d [+−] \d+ = \?$/);
          const m = q.prompt.match(/^(\d) × (\d) ([+−]) (\d+) = \?$/)!;
          const c = Number(m[4]);
          expect(c).toBeGreaterThanOrEqual(1);
          expect(c).toBeLessThanOrEqual(20);
          const v = Number(m[1]) * Number(m[2]) + (m[3] === '+' ? c : -c);
          expect(v).toBe(q.answer);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
    expect(seen.size).toBe(4);
  });

  test('avoid is never returned', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = generateQuestion(getLevel(1), 0, {}, mulberry32(seed), '2x3:mul');
      expect(q.statKey).not.toBe('2x3:mul');
    }
  });

  test('weighting favours struggling facts', () => {
    const rng = mulberry32(7);
    const stats = { '2x3:mul': { correct: 0, wrong: 8, missed: 0, streak: 0 } } as const;
    let hits = 0;
    for (let n = 0; n < 3000; n++) {
      if (generateQuestion(getLevel(1), 0, stats, rng).statKey === '2x3:mul') hits++;
    }
    expect(hits / 3000).toBeGreaterThan(0.15);
  });

  test('difficultyAt', () => {
    expect(difficultyAt(0)).toEqual({ optionCount: 4, closeRatio: 0, fallSpeed: 1 });
    expect(difficultyAt(6).optionCount).toBe(4);
    expect(difficultyAt(7).optionCount).toBe(5);
    expect(difficultyAt(13).optionCount).toBe(5);
    expect(difficultyAt(14).optionCount).toBe(6);
    expect(difficultyAt(19).optionCount).toBe(6);
    expect(difficultyAt(19).fallSpeed).toBeCloseTo(1.6);
  });

  test('evalLabel', () => {
    expect(evalLabel('3 × 4')).toBe(12);
    expect(evalLabel('27')).toBe(27);
  });

  test('answerText', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const q = generateQuestion(getLevel(1), 0, {}, mulberry32(seed));
      const m = q.prompt.match(/^(\d) × (\d) = \?$/)!;
      expect(q.answerText).toBe(`${m[1]} × ${m[2]} = ${q.answer}`);
    }
    const r = generateQuestion(getLevel(3), 0, {}, mulberry32(1));
    if (r.kind === 'reverse') expect(r.answerText).toMatch(/^\d+ = \d × \d$/);
  });

  test('tiny answers never hang and stay unique', () => {
    const lvl = { ...getLevel(6), facts: [{ a: 1, b: 1 }] };
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion(lvl, i, {}, rng);
        expect(new Set(q.options.map(o => o.label)).size).toBe(q.options.length);
      }
    }
  });
});
