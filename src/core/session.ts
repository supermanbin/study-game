import type { FactKey, LevelId, StatKey } from './types';
import type { LevelSpec } from './levels';
import { BOSS_HP, PASS_CORRECT, QUESTIONS_PER_LEVEL, THREE_STAR_CORRECT, TWO_STAR_CORRECT } from './levels';
import type { Rng } from './rng';
import { randInt } from './rng';
import type { QuestionResult, StatsMap } from './stats';
import type { Question } from './questions';
import { generateQuestion } from './questions';
import { factKey } from './facts';

export type ItemKind = 'freeze' | 'magnifier';
export type SessionStatus = 'playing' | 'paused' | 'won' | 'lost';
export type FailReason = 'time' | 'pile' | 'notEnough';

export interface QuestionOutcome { statKey: StatKey; factKey: FactKey; result: QuestionResult }

export interface ClickResult {
  kind: 'correct' | 'lateCorrect' | 'wrong' | 'ignored';
  scoreDelta: number;
  combo: number;
  awardedItem?: ItemKind;
  questionEnded: boolean;
}

export interface LevelResult {
  levelId: LevelId;
  passed: boolean;
  failReason?: FailReason;
  correctCount: number;
  score: number;
  timeBonus: number;
  totalScore: number;
  stars: 0 | 1 | 2 | 3;
}

export interface SessionOpts {
  rng: Rng;
  stats: () => StatsMap;
  onOutcome?: (o: QuestionOutcome) => void;
}

const WRONG_PENALTY = 5;
const LOCKOUT_MS = 500;
const FREEZE_MS = 5000;

function multiplier(combo: number): number {
  return combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
}

export class LevelSession {
  readonly level: LevelSpec;
  question: Question;
  questionIndex = 0;
  score = 0;
  combo = 0;
  correctCount = 0;
  timeLeftMs: number;
  status: SessionStatus = 'playing';
  failReason?: FailReason;
  items: Record<ItemKind, number> = { freeze: 0, magnifier: 0 };
  freezeLeftMs = 0;

  private readonly opts: SessionOpts;
  private lockUntil = 0;
  private anyWrong = false;
  private wrongIds = new Set<number>();
  private removedIds = new Set<number>();

  constructor(level: LevelSpec, opts: SessionOpts) {
    this.level = level;
    this.opts = opts;
    this.timeLeftMs = level.timeLimitSec * 1000;
    this.question = generateQuestion(level, 0, opts.stats(), opts.rng);
  }

  click(optionId: number, nowMs: number): ClickResult {
    const ignored: ClickResult = { kind: 'ignored', scoreDelta: 0, combo: this.combo, questionEnded: false };
    if (this.status !== 'playing' || nowMs < this.lockUntil) return ignored;
    const opt = this.question.options.find(o => o.id === optionId);
    if (!opt || this.wrongIds.has(optionId) || this.removedIds.has(optionId)) return ignored;

    if (!opt.correct) {
      this.anyWrong = true;
      this.wrongIds.add(optionId);
      this.lockUntil = nowMs + LOCKOUT_MS;
      this.combo = 0;
      const lost = Math.min(WRONG_PENALTY, this.score);
      this.score -= lost;
      return { kind: 'wrong', scoreDelta: lost === 0 ? 0 : -lost, combo: 0, questionEnded: false };
    }

    if (this.anyWrong) {
      this.endQuestion('wrong');
      return { kind: 'lateCorrect', scoreDelta: 0, combo: this.combo, questionEnded: true };
    }

    this.combo++;
    this.correctCount++;
    const delta = Math.round(10 * multiplier(this.combo));
    this.score += delta;
    let awardedItem: ItemKind | undefined;
    if (this.combo === 5) awardedItem = 'freeze';
    else if (this.combo === 10) awardedItem = 'magnifier';
    if (awardedItem) this.items[awardedItem]++;
    const combo = this.combo;
    this.endQuestion('correct');
    return { kind: 'correct', scoreDelta: delta, combo, awardedItem, questionEnded: true };
  }

  /** All correct options of the current question came to rest (rest-based miss, decided by the scene). */
  miss(): void {
    if (this.status !== 'playing') return;
    this.combo = 0;
    this.endQuestion(this.anyWrong ? 'wrong' : 'missed');
  }

  tick(dtMs: number): void {
    if (this.status !== 'playing') return;
    const scale = this.timeScale();
    this.freezeLeftMs = Math.max(0, this.freezeLeftMs - dtMs);
    this.timeLeftMs = Math.max(0, this.timeLeftMs - dtMs * scale);
    if (this.timeLeftMs <= 0) this.finish('lost', 'time');
  }

  timeScale(): number {
    return this.freezeLeftMs > 0 ? 0.5 : 1;
  }

  useFreeze(): boolean {
    if (this.status !== 'playing' || this.items.freeze <= 0) return false;
    this.items.freeze--;
    this.freezeLeftMs = FREEZE_MS;
    return true;
  }

  /** Removes one wrong option among the active ones; returns its id, or null (item kept). */
  useMagnifier(activeOptionIds: number[]): number | null {
    if (this.status !== 'playing' || this.items.magnifier <= 0) return null;
    const cands = this.question.options.filter(
      o => !o.correct && activeOptionIds.includes(o.id) && !this.removedIds.has(o.id) && !this.wrongIds.has(o.id),
    );
    if (cands.length === 0) return null;
    const pick = cands[randInt(this.opts.rng, 0, cands.length - 1)];
    this.removedIds.add(pick.id);
    this.items.magnifier--;
    return pick.id;
  }

  failByPile(): void {
    if (this.status !== 'playing' && this.status !== 'paused') return;
    this.finish('lost', 'pile');
  }

  pause(): void {
    if (this.status === 'playing') this.status = 'paused';
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'playing';
  }

  bossHp(): number {
    return Math.max(0, BOSS_HP - this.correctCount);
  }

  result(): LevelResult {
    if (this.status !== 'won' && this.status !== 'lost') throw new Error('result(): session not finished');
    const passed = this.status === 'won';
    const timeBonus = passed ? Math.floor(this.timeLeftMs / 1000) : 0;
    const stars = !passed ? 0 : this.correctCount >= THREE_STAR_CORRECT ? 3 : this.correctCount >= TWO_STAR_CORRECT ? 2 : 1;
    return {
      levelId: this.level.id,
      passed,
      failReason: passed ? undefined : this.failReason,
      correctCount: this.correctCount,
      score: this.score,
      timeBonus,
      totalScore: this.score + timeBonus,
      stars: stars as 0 | 1 | 2 | 3,
    };
  }

  private finish(status: 'won' | 'lost', reason?: FailReason): void {
    this.status = status;
    this.failReason = reason;
  }

  private endQuestion(result: QuestionResult): void {
    const q = this.question;
    this.opts.onOutcome?.({ statKey: q.statKey, factKey: factKey(q.fact.a, q.fact.b), result });
    this.questionIndex++;
    if (this.questionIndex >= QUESTIONS_PER_LEVEL) {
      if (this.correctCount >= PASS_CORRECT) this.finish('won');
      else this.finish('lost', 'notEnough');
      return;
    }
    this.anyWrong = false;
    this.wrongIds.clear();
    this.removedIds.clear();
    this.lockUntil = 0;
    this.question = generateQuestion(this.level, this.questionIndex, this.opts.stats(), this.opts.rng, q.statKey);
  }
}
