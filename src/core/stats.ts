import type { Fact, QuestionKind, StatKey } from './types';
import type { Rng } from './rng';
import { factKey } from './facts';

export type QuestionResult = 'correct' | 'wrong' | 'missed';

export interface StatRecord {
  correct: number;
  wrong: number;
  missed: number;
  streak: number;
}

export type StatsMap = Partial<Record<StatKey, StatRecord>>;

export function statKey(f: Fact, kind: QuestionKind): StatKey {
  return `${factKey(f.a, f.b)}:${kind}`;
}

/** Returns a new map; the input is never mutated. */
export function recordResult(stats: StatsMap, key: StatKey, r: QuestionResult): StatsMap {
  const prev: StatRecord = stats[key] ?? { correct: 0, wrong: 0, missed: 0, streak: 0 };
  const next: StatRecord =
    r === 'correct'
      ? { ...prev, correct: prev.correct + 1, streak: prev.streak + 1 }
      : r === 'wrong'
        ? { ...prev, wrong: prev.wrong + 1, streak: 0 }
        : { ...prev, missed: prev.missed + 1, streak: 0 };
  return { ...stats, [key]: next };
}

/** Higher weight = asked more often. Unseen facts weigh 1. */
export function weightOf(rec: StatRecord | undefined): number {
  if (!rec) return 1;
  return 1 + Math.min(rec.wrong + rec.missed, 4) * 0.5 ** rec.streak;
}

/** Weighted random pick using the supplied rng (cumulative-weight walk). */
export function pickWeighted<T>(items: readonly T[], weight: (t: T) => number, rng: Rng): T {
  if (items.length === 0) throw new Error('pickWeighted: empty items');
  const weights = items.map(weight);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    if (roll < weights[i]) return items[i];
    roll -= weights[i];
  }
  // Floating-point slack: fall back to the last item.
  return items[items.length - 1];
}
