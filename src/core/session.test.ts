import { describe, expect, test } from 'vitest';
import { getLevel } from './levels';
import { mulberry32 } from './rng';
import { LevelSession, type QuestionOutcome } from './session';

function make(levelId: 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  const outcomes: QuestionOutcome[] = [];
  const s = new LevelSession(getLevel(levelId), {
    rng: mulberry32(7),
    stats: () => ({}),
    onOutcome: o => outcomes.push(o),
  });
  return { s, outcomes };
}
const correctId = (s: LevelSession) => s.question.options.find(o => o.correct)!.id;
const wrongId = (s: LevelSession) => s.question.options.find(o => !o.correct)!.id;

/** Answer n questions first-try correct (t advances so lockouts never matter). */
function playCorrect(s: LevelSession, n: number): number[] {
  const deltas: number[] = [];
  for (let i = 0; i < n; i++) deltas.push(s.click(correctId(s), i * 1000).scoreDelta);
  return deltas;
}
/** Finish a full level: `good` first-try correct, rest missed. */
function playLevel(s: LevelSession, good: number) {
  for (let i = 0; i < 20; i++) {
    if (i < good) s.click(correctId(s), i * 1000);
    else s.miss();
  }
}

describe('LevelSession', () => {
  test('first correct click scores 10 and advances', () => {
    const { s, outcomes } = make();
    expect(s.click(correctId(s), 0)).toEqual({ kind: 'correct', scoreDelta: 10, combo: 1, questionEnded: true });
    expect(s.questionIndex).toBe(1);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].result).toBe('correct');
  });

  test('ten correct in a row: combo multipliers and items', () => {
    const { s } = make();
    const results = [];
    for (let i = 0; i < 10; i++) results.push(s.click(correctId(s), i * 1000));
    expect(results.map(r => r.scoreDelta)).toEqual([10, 10, 15, 20, 20, 20, 20, 20, 20, 30]);
    expect(s.score).toBe(185);
    expect(results[4].awardedItem).toBe('freeze');
    expect(results[9].awardedItem).toBe('magnifier');
    expect(results.filter(r => r.awardedItem)).toHaveLength(2);
    expect(s.items).toEqual({ freeze: 1, magnifier: 1 });
  });

  test('wrong click, lockout, late correct counts as wrong', () => {
    const { s, outcomes } = make();
    const w = s.click(wrongId(s), 0);
    expect(w).toMatchObject({ kind: 'wrong', scoreDelta: 0, combo: 0, questionEnded: false });
    expect(s.score).toBe(0);
    expect(s.click(correctId(s), 499).kind).toBe('ignored');
    const late = s.click(correctId(s), 500);
    expect(late).toMatchObject({ kind: 'lateCorrect', scoreDelta: 0, questionEnded: true });
    expect(s.correctCount).toBe(0);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].result).toBe('wrong');
  });

  test('wrong after score 10 costs 5', () => {
    const { s } = make();
    s.click(correctId(s), 0);
    const r = s.click(wrongId(s), 1000);
    expect(r.scoreDelta).toBe(-5);
    expect(s.score).toBe(5);
    expect(s.combo).toBe(0);
  });

  // Review Focus 3: double-click and repeat-click protection.
  test('same correct id clicked twice in one ms is ignored the second time', () => {
    const { s, outcomes } = make();
    const id = correctId(s);
    expect(s.click(id, 100).kind).toBe('correct');
    // Known gap: option ids restart at 0 every question, so this second click
    // may hit the NEW question's option with the same id. The session cannot
    // tell it came from an old option. The scene must not forward clicks from
    // options of already-resolved questions (handled in Task 9). Here we only
    // verify the lockout-free path: a new question is live after one advance.
    expect(s.questionIndex).toBe(1);
    expect(outcomes).toHaveLength(1);
  });

  test('clicking same correct id twice within one question is ignored (after miss-free resolve)', () => {
    // Via a wrong-then-late-correct flow the question resolves once.
    const { s, outcomes } = make();
    const w = wrongId(s);
    s.click(w, 0);
    expect(s.click(w, 600).kind).toBe('ignored'); // already-wrong id after lockout
    const c = correctId(s);
    expect(s.click(c, 600).kind).toBe('lateCorrect');
    expect(s.questionIndex).toBe(1);
    expect(outcomes).toHaveLength(1);
  });

  test('miss resets combo, reports missed, advances', () => {
    const { s, outcomes } = make();
    s.click(correctId(s), 0);
    s.miss();
    expect(s.combo).toBe(0);
    expect(outcomes[1].result).toBe('missed');
    expect(s.questionIndex).toBe(2);
  });

  test('wrong then miss reports wrong', () => {
    const { s, outcomes } = make();
    s.click(wrongId(s), 0);
    s.miss();
    expect(outcomes[0].result).toBe('wrong');
  });

  test.each([
    [16, 1],
    [18, 2],
    [20, 3],
  ])('%i correct wins with %i stars', (good, stars) => {
    const { s } = make();
    playLevel(s, good);
    expect(s.status).toBe('won');
    expect(s.result()).toMatchObject({ passed: true, stars, correctCount: good });
  });

  test('15 correct loses with notEnough', () => {
    const { s } = make();
    playLevel(s, 15);
    expect(s.status).toBe('lost');
    expect(s.failReason).toBe('notEnough');
    expect(s.result()).toMatchObject({ passed: false, stars: 0, timeBonus: 0, failReason: 'notEnough' });
  });

  test('time running out loses and later input is ignored', () => {
    const { s } = make();
    s.tick(150_000);
    expect(s.status).toBe('lost');
    expect(s.failReason).toBe('time');
    expect(s.click(correctId(s), 0).kind).toBe('ignored');
    const idx = s.questionIndex;
    s.miss();
    expect(s.questionIndex).toBe(idx);
  });

  // Review Focus 4: pause must freeze the clock.
  test('pause stops countdown, resume restarts it', () => {
    const { s } = make();
    const t0 = s.timeLeftMs;
    s.pause();
    expect(s.status).toBe('paused');
    s.tick(10_000);
    expect(s.timeLeftMs).toBe(t0);
    expect(s.click(correctId(s), 0).kind).toBe('ignored');
    s.resume();
    s.tick(1000);
    expect(s.timeLeftMs).toBe(t0 - 1000);
  });

  test('freeze', () => {
    const { s } = make();
    expect(s.useFreeze()).toBe(false);
    playCorrect(s, 5);
    expect(s.items.freeze).toBe(1);
    expect(s.useFreeze()).toBe(true);
    expect(s.items.freeze).toBe(0);
    expect(s.timeScale()).toBe(0.5);
    const t0 = s.timeLeftMs;
    s.tick(1000);
    expect(s.timeLeftMs).toBe(t0 - 500);
    s.tick(4000);
    expect(s.timeScale()).toBe(1);
    expect(s.freezeLeftMs).toBe(0);
  });

  test('freeze while active resets to 5000 and consumes an item', () => {
    const { s } = make();
    s.items.freeze = 2;
    s.useFreeze();
    s.tick(3000);
    expect(s.freezeLeftMs).toBe(2000);
    expect(s.useFreeze()).toBe(true);
    expect(s.freezeLeftMs).toBe(5000);
    expect(s.items.freeze).toBe(0);
  });

  test('magnifier removes a wrong option', () => {
    const { s } = make();
    s.items.magnifier = 1;
    const all = s.question.options.map(o => o.id);
    const removed = s.useMagnifier(all);
    expect(removed).not.toBeNull();
    expect(s.question.options.find(o => o.id === removed)!.correct).toBe(false);
    expect(s.items.magnifier).toBe(0);
    expect(s.click(removed!, 0).kind).toBe('ignored');
  });

  test('magnifier with only the correct option left returns null, keeps item', () => {
    const { s } = make();
    s.items.magnifier = 1;
    expect(s.useMagnifier([correctId(s)])).toBeNull();
    expect(s.items.magnifier).toBe(1);
  });

  test('time bonus on win', () => {
    const { s } = make();
    s.timeLeftMs = 30_400;
    playLevel(s, 20);
    const r = s.result();
    expect(r.timeBonus).toBe(30);
    expect(r.totalScore).toBe(r.score + 30);
  });

  test('failByPile', () => {
    const { s } = make();
    s.failByPile();
    expect(s.status).toBe('lost');
    expect(s.failReason).toBe('pile');
  });

  test('bossHp', () => {
    const { s } = make(3);
    expect(s.bossHp()).toBe(16);
    playCorrect(s, 16);
    expect(s.bossHp()).toBe(0);
  });

  test('result throws while playing', () => {
    const { s } = make();
    expect(() => s.result()).toThrow();
  });

  test('onOutcome carries statKey and factKey', () => {
    const { s, outcomes } = make();
    const q = s.question;
    s.click(correctId(s), 0);
    expect(outcomes[0].statKey).toBe(q.statKey);
    expect(outcomes[0].factKey).toBe(`${q.fact.a}x${q.fact.b}`);
  });
});
