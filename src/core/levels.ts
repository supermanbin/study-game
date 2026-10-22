import { ALL_FACTS } from './facts';
import type { Fact, LevelId, QuestionKind } from './types';

export const QUESTIONS_PER_LEVEL = 20;
export const PASS_CORRECT = 16;
export const TWO_STAR_CORRECT = 18;
export const THREE_STAR_CORRECT = 20;
export const BOSS_HP = 16;

export interface LevelSpec {
  id: LevelId;
  name: string;
  kinds: QuestionKind[];
  facts: Fact[];
  timeLimitSec: number;
  boss: boolean;
}

const all = [...ALL_FACTS];

export const LEVELS: readonly LevelSpec[] = [
  { id: 1, name: '1～5 的乘法', kinds: ['mul'], facts: all.filter(f => f.b <= 5), timeLimitSec: 140, boss: false },
  { id: 2, name: '6～9 的乘法', kinds: ['mul'], facts: all.filter(f => f.b >= 6), timeLimitSec: 130, boss: false },
  { id: 3, name: '乘法大挑战', kinds: ['mul', 'reverse'], facts: all, timeLimitSec: 110, boss: true },
  { id: 4, name: '乘加乘减', kinds: ['mulAddSub'], facts: all, timeLimitSec: 110, boss: false },
  { id: 5, name: '表内除法', kinds: ['div'], facts: all, timeLimitSec: 100, boss: false },
  { id: 6, name: '终极大混战', kinds: ['mul', 'reverse', 'mulAddSub', 'div'], facts: all, timeLimitSec: 110, boss: true },
];

export function getLevel(id: LevelId): LevelSpec {
  return LEVELS[id - 1];
}
