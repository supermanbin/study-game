import type Phaser from 'phaser';
import type { LevelId } from '../core/types';
import type { ProgressData, Settings } from '../core/progress';
import type { ProgressStore } from '../core/store';
import { pressButton } from '../ui/Button';

export interface DebugState {
  scene: string;
  questionIndex?: number;
  score?: number;
  status?: string;
  timeLeftMs?: number;
  /** Game-clock ms spent playing the current level (unaffected by `notime`). */
  gameMs?: number;
  bossHp?: number;
  bossMode?: string;
  pileCount?: number;
  /** True while the next question waits (miss reveal or post-correct fade). */
  nextQuestionPending?: boolean;
  /** Balls in the world: body radius, clay shell geometry, shell / stripe angles (Review Focus 3). */
  balls?: { radius: number; shellW: number; shellOriginX: number; shellX: number; shellY: number; x: number; y: number; shellAngle: number; stripeAngle: number }[];
  stars?: number;
  litCards?: number;
  settings?: Settings;
}

export interface FunyDebug {
  answerCorrect(): void;
  answerWrong(): void;
  missCurrent(): void;
  /** Fires the pointer-click path twice synchronously on the same correct option. */
  doubleClickCorrect(): void;
  /** Fires the pointer path on a 'resolved' option of the current question (must change nothing). */
  clickResolvedOption(): void;
  startLevel(id: LevelId): void;
  unlockAll(): void;
  press(label: string): void;
  state(): DebugState;
}

/** Implemented by scenes that want to expose state or test actions. */
export interface DebuggableScene {
  debugState?(): Partial<DebugState>;
  debugAnswer?(correct: boolean): void;
  debugMiss?(): void;
  debugDoubleClickCorrect?(): void;
  debugClickResolved?(): void;
}

declare global {
  interface Window {
    __funyDebug?: FunyDebug;
  }
}

export function debugEnabled(): boolean {
  return import.meta.env.DEV || location.search.includes('debug');
}

/** Called from MenuScene.create, so the hook appears only once Boot is done. Idempotent. */
export function installDebug(game: Phaser.Game): void {
  if (!debugEnabled() || window.__funyDebug) return;
  const active = (): (Phaser.Scene & DebuggableScene) | undefined =>
    game.scene.getScenes(true).find(s => s.scene.key !== 'BootScene') as (Phaser.Scene & DebuggableScene) | undefined;

  window.__funyDebug = {
    answerCorrect: () => active()?.debugAnswer?.(true),
    answerWrong: () => active()?.debugAnswer?.(false),
    missCurrent: () => active()?.debugMiss?.(),
    doubleClickCorrect: () => active()?.debugDoubleClickCorrect?.(),
    clickResolvedOption: () => active()?.debugClickResolved?.(),
    startLevel: (id: LevelId) => {
      for (const s of game.scene.getScenes(true)) if (s.scene.key !== 'Game') game.scene.stop(s.scene.key);
      game.scene.start('Game', { levelId: id });
    },
    unlockAll: () => {
      const p = game.registry.get('progress') as ProgressData;
      const next: ProgressData = { ...p, unlockedLevel: 6, updatedAt: Date.now() };
      game.registry.set('progress', next);
      void (game.registry.get('store') as ProgressStore).save(next);
    },
    press: (label: string) => {
      const s = active();
      if (s) pressButton(s, label);
    },
    state: () => {
      const s = active();
      const settings = (game.registry.get('progress') as ProgressData | undefined)?.settings;
      return { scene: s?.scene.key ?? 'none', settings, ...(s?.debugState?.() ?? {}) };
    },
  };
}
