import type { Fact, QuestionKind, StatKey } from './types';
import type { LevelSpec } from './levels';
import type { Rng } from './rng';
import { randInt, shuffle } from './rng';
import type { StatsMap } from './stats';
import { pickWeighted, statKey, weightOf } from './stats';

export interface QuestionOption { id: number; label: string; correct: boolean }

export interface Question {
  kind: QuestionKind;
  fact: Fact;
  statKey: StatKey;
  prompt: string;
  /** Numeric answer (target product for reverse). */
  answer: number;
  /** Full solved line shown on a miss, e.g. `3 × 9 = 27`. */
  answerText: string;
  options: QuestionOption[];
}

export interface Difficulty { optionCount: 4 | 5 | 6; closeRatio: number; fallSpeed: number }

export function difficultyAt(index: number): Difficulty {
  const optionCount = index <= 6 ? 4 : index <= 13 ? 5 : 6;
  return { optionCount, closeRatio: index / 19, fallSpeed: 1 + (0.6 * index) / 19 };
}

/** Parses `27` or `3 × 4`. */
export function evalLabel(label: string): number {
  return label
    .split('×')
    .map(s => Number(s.trim()))
    .reduce((p, n) => p * n, 1);
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)];
}

/** Numeric distractors: unique, non-negative, never equal to the answer. */
function numericLabels(answer: number, a: number, b: number, count: number, closeRatio: number, rng: Rng): string[] {
  const used = new Set<number>([answer]);
  const closeSet = new Set<number>();
  for (const d of [1, 2, a, b]) {
    closeSet.add(answer + d);
    closeSet.add(answer - d);
  }
  if (answer >= 10 && answer <= 99) closeSet.add(Number(String(answer).split('').reverse().join('')));
  const closeAll = [...closeSet];
  const farMax = Math.max(answer + 30, 20);
  const farAll: number[] = [];
  for (let v = 0; v <= farMax; v++) if (Math.abs(v - answer) >= 5) farAll.push(v);

  const take = (pool: number[]): number | undefined => {
    const avail = pool.filter(v => v >= 0 && !used.has(v));
    return avail.length ? pick(rng, avail) : undefined;
  };

  const out: number[] = [];
  while (out.length < count) {
    const wantClose = rng() < closeRatio;
    const v = (wantClose ? take(closeAll) : undefined) ?? take(farAll) ?? take(closeAll);
    if (v === undefined) {
      // Both pools exhausted (cannot happen for valid inputs); widen the range.
      let n = farMax + 1;
      while (used.has(n)) n++;
      used.add(n);
      out.push(n);
      continue;
    }
    used.add(v);
    out.push(v);
  }
  return out.map(String);
}

function reverseLabels(target: number, f: Fact, count: number, closeRatio: number, rng: Rng): { correct: string[]; labels: string[] } {
  const all: Array<[number, number]> = [];
  for (let x = 1; x <= 9; x++) for (let y = 1; y <= 9; y++) all.push([x, y]);
  const label = ([x, y]: [number, number]) => `${x} × ${y}`;
  const good = shuffle(rng, all.filter(([x, y]) => x * y === target));
  const correct = good.slice(0, Math.min(good.length, randInt(rng, 1, 2)));
  const bad = all.filter(([x, y]) => x * y !== target);
  const near = bad.filter(
    ([x, y]) => Math.abs(x * y - target) <= 6 || good.some(([gx, gy]) => x === gx || x === gy || y === gx || y === gy) || x === f.a || y === f.b,
  );
  const used = new Set(correct.map(label));
  const labels = correct.map(label);
  const take = (pool: Array<[number, number]>) => {
    const avail = pool.filter(p => !used.has(label(p)));
    return avail.length ? pick(rng, avail) : undefined;
  };
  while (labels.length < count) {
    const p = (rng() < closeRatio ? take(near) : undefined) ?? take(bad);
    if (!p) break;
    used.add(label(p));
    labels.push(label(p));
  }
  return { correct: correct.map(label), labels };
}

export function generateQuestion(level: LevelSpec, index: number, stats: StatsMap, rng: Rng, avoid?: StatKey): Question {
  const diff = difficultyAt(index);
  let candidates = level.facts.flatMap(f => level.kinds.map(kind => ({ fact: f, kind, key: statKey(f, kind) })));
  if (avoid && candidates.length > 1) {
    const rest = candidates.filter(c => c.key !== avoid);
    if (rest.length > 0) candidates = rest;
  }
  const { fact, kind, key } = pickWeighted(candidates, c => weightOf(stats[c.key]), rng);
  const { a, b } = fact;
  const product = a * b;
  const flip = rng() < 0.5;
  const [x, y] = flip ? [b, a] : [a, b];

  let prompt: string;
  let answer: number;
  let answerText: string;
  let labels: string[];

  if (kind === 'reverse') {
    const r = reverseLabels(product, fact, diff.optionCount, diff.closeRatio, rng);
    prompt = `${product} = ? × ?`;
    answer = product;
    answerText = `${product} = ${r.correct[0]}`;
    labels = r.labels;
  } else {
    if (kind === 'mul') {
      prompt = `${x} × ${y} = ?`;
      answer = product;
      answerText = `${x} × ${y} = ${answer}`;
    } else if (kind === 'div') {
      const divisor = flip ? a : b;
      answer = flip ? b : a;
      prompt = `${product} ÷ ${divisor} = ?`;
      answerText = `${product} ÷ ${divisor} = ${answer}`;
    } else {
      const canSub = product >= 1;
      const plus = !canSub || rng() < 0.5;
      const c = plus ? randInt(rng, 1, Math.min(20, 100 - product)) : randInt(rng, 1, Math.min(20, product));
      answer = plus ? product + c : product - c;
      prompt = `${x} × ${y} ${plus ? '+' : '−'} ${c} = ?`;
      answerText = `${prompt.slice(0, -1)}${answer}`;
    }
    labels = [String(answer), ...numericLabels(answer, a, b, diff.optionCount - 1, diff.closeRatio, rng)];
  }

  const options = shuffle(rng, labels).map((label, id) => ({ id, label, correct: evalLabel(label) === answer }));
  return { kind, fact, statKey: key, prompt, answer, answerText, options };
}
