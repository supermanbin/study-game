import type { FactKey, LevelId } from './types';
import { recordResult, type StatsMap } from './stats';
import type { QuestionOutcome, LevelResult } from './session';

export const PROGRESS_VERSION = 1;
export const CARD_LIT_THRESHOLD = 3;

export interface Settings { music: boolean; voice: boolean; sfx: boolean }
export interface LevelRecord { bestStars: 0 | 1 | 2 | 3; bestScore: number }

export interface ProgressData {
  version: 1;
  profileId: string;
  updatedAt: number;
  unlockedLevel: LevelId;
  levels: Partial<Record<LevelId, LevelRecord>>;
  stats: StatsMap;
  cards: Partial<Record<FactKey, number>>;
  settings: Settings;
}

export function defaultProgress(now: number, profileId = 'default'): ProgressData {
  return {
    version: PROGRESS_VERSION,
    profileId,
    updatedAt: now,
    unlockedLevel: 1,
    levels: {},
    stats: {},
    cards: {},
    settings: { music: true, voice: true, sfx: true },
  };
}

/** Returns new data; the input is never mutated. Cards count first-try correct answers only. */
export function recordOutcome(d: ProgressData, o: QuestionOutcome, now: number): ProgressData {
  const cards = o.result === 'correct' ? { ...d.cards, [o.factKey]: (d.cards[o.factKey] ?? 0) + 1 } : d.cards;
  return { ...d, stats: recordResult(d.stats, o.statKey, o.result), cards, updatedAt: now };
}

/** Failed runs only touch updatedAt. */
export function applyLevelResult(d: ProgressData, r: LevelResult, now: number): ProgressData {
  if (!r.passed) return { ...d, updatedAt: now };
  const prev = d.levels[r.levelId];
  const record: LevelRecord = {
    bestStars: Math.max(prev?.bestStars ?? 0, r.stars) as LevelRecord['bestStars'],
    bestScore: Math.max(prev?.bestScore ?? 0, r.totalScore),
  };
  const next = Math.min(6, r.levelId + 1) as LevelId;
  return {
    ...d,
    levels: { ...d.levels, [r.levelId]: record },
    unlockedLevel: Math.max(d.unlockedLevel, next) as LevelId,
    updatedAt: now,
  };
}

export function isCardLit(d: ProgressData, k: FactKey): boolean {
  return (d.cards[k] ?? 0) >= CARD_LIT_THRESHOLD;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isLevel = (v: unknown): v is LevelId => isNum(v) && Number.isInteger(v) && v >= 1 && v <= 6;

function validStatRecord(v: unknown): boolean {
  return isObj(v) && isNum(v.correct) && isNum(v.wrong) && isNum(v.missed) && isNum(v.streak);
}
function validLevelRecord(v: unknown): boolean {
  return isObj(v) && isNum(v.bestScore) && (v.bestStars === 0 || v.bestStars === 1 || v.bestStars === 2 || v.bestStars === 3);
}

/** Invalid or wrong-version input yields defaultProgress. */
export function parseProgress(raw: unknown, now: number): ProgressData {
  if (
    !isObj(raw) ||
    raw.version !== PROGRESS_VERSION ||
    typeof raw.profileId !== 'string' ||
    !isNum(raw.updatedAt) ||
    !isLevel(raw.unlockedLevel) ||
    !isObj(raw.levels) ||
    !Object.entries(raw.levels).every(([k, v]) => isLevel(Number(k)) && validLevelRecord(v)) ||
    !isObj(raw.stats) ||
    !Object.values(raw.stats).every(validStatRecord) ||
    !isObj(raw.cards) ||
    !Object.values(raw.cards).every(isNum) ||
    !isObj(raw.settings) ||
    typeof raw.settings.music !== 'boolean' ||
    typeof raw.settings.voice !== 'boolean' ||
    typeof raw.settings.sfx !== 'boolean'
  ) {
    return defaultProgress(now);
  }
  return raw as unknown as ProgressData;
}
