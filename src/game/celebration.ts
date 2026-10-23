import type { LevelResult } from '../core/session';

/**
 * Entrance celebration of the Result scene as pure data: what happens when, derived from the level result.
 * ResultScene maps each step to a tween / particle burst / sfx / voice and plays them through a Timeline.
 * Spec: docs/superpowers/specs/2026-10-23-result-celebration-design.md §5.2.
 */

export type CountLine = 'correct' | 'score' | 'bonus';

export type CelebrationStep =
  | { at: number; kind: 'title' }
  | { at: number; kind: 'reason' }
  | { at: number; kind: 'star'; index: 0 | 1 | 2 }
  | { at: number; kind: 'count'; line: CountLine; durationMs: number }
  | { at: number; kind: 'confetti' }
  | { at: number; kind: 'sfx'; name: 'pass' | 'correct' }
  | { at: number; kind: 'voice'; category: 'threeStars' | 'levelPass' | 'levelFail' };

/** Whole celebration, including the last effect's own run-out. */
export const CELEBRATION_MAX_MS = 2500;
export const STAR_FIRST_MS = 500;
export const STAR_GAP_MS = 350;
/** Confetti / voice follow the last star by this much. */
const AFTER_LAST_STAR_MS = 250;

/** How long each step kind keeps running after its `at` (sfx and voice are not waited for). */
export const STEP_OWN_MS = { title: 300, reason: 300, star: 250, confetti: 1000, sfx: 0, voice: 0 } as const;

/** Steps in ascending `at` order (stable for equal times). */
export function celebrationSteps(result: LevelResult): CelebrationStep[] {
  const steps: CelebrationStep[] = [{ at: 0, kind: 'title' }];
  if (!result.passed) {
    steps.push(
      { at: 200, kind: 'reason' },
      { at: 300, kind: 'count', line: 'correct', durationMs: 500 },
      { at: 600, kind: 'voice', category: 'levelFail' },
    );
    return sortByTime(steps);
  }
  steps.push(
    { at: 0, kind: 'sfx', name: 'pass' },
    { at: 300, kind: 'count', line: 'correct', durationMs: 500 },
    { at: 700, kind: 'count', line: 'score', durationMs: 600 },
    { at: 900, kind: 'count', line: 'bonus', durationMs: 600 },
  );
  let lastStarAt = STAR_FIRST_MS - STAR_GAP_MS;
  for (let i = 0; i < result.stars; i++) {
    lastStarAt = STAR_FIRST_MS + STAR_GAP_MS * i;
    steps.push({ at: lastStarAt, kind: 'star', index: i as 0 | 1 | 2 }, { at: lastStarAt, kind: 'sfx', name: 'correct' });
  }
  const finale = lastStarAt + AFTER_LAST_STAR_MS;
  if (result.stars === 3) steps.push({ at: finale, kind: 'confetti' }, { at: finale, kind: 'voice', category: 'threeStars' });
  else steps.push({ at: finale, kind: 'voice', category: 'levelPass' });
  return sortByTime(steps);
}

/** End of the latest step: its `at` plus the kind's own duration (a count's is its `durationMs`). */
export function celebrationDurationMs(steps: CelebrationStep[]): number {
  let end = 0;
  for (const s of steps) end = Math.max(end, s.at + (s.kind === 'count' ? s.durationMs : STEP_OWN_MS[s.kind]));
  return end;
}

function sortByTime(steps: CelebrationStep[]): CelebrationStep[] {
  return steps.slice().sort((a, b) => a.at - b.at);
}
