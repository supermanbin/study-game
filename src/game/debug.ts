import type Phaser from 'phaser';
import type { LevelId } from '../core/types';
import type { ProgressData, Settings } from '../core/progress';
import type { ProgressStore } from '../core/store';

export interface DebugState {
  scene: string;
  questionIndex?: number;
  score?: number;
  status?: string;
  timeLeftMs?: number;
  bossHp?: number;
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
}

declare global {
  interface Window {
    __funyDebug?: FunyDebug;
  }
}

export function debugEnabled(): boolean {
  return import.meta.env.DEV || location.search.includes('debug');
}

export function installDebug(game: Phaser.Game): void {
  if (!debugEnabled()) return;
  const active = (): (Phaser.Scene & DebuggableScene) | undefined =>
    game.scene.getScenes(true).find(s => s.scene.key !== 'BootScene') as (Phaser.Scene & DebuggableScene) | undefined;

  window.__funyDebug = {
    answerCorrect: () => active()?.debugAnswer?.(true),
    answerWrong: () => active()?.debugAnswer?.(false),
    missCurrent: () => active()?.debugMiss?.(),
    doubleClickCorrect: () => active()?.debugDoubleClickCorrect?.(),
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
    press: () => {
      /* filled in by Task 11's Button registry */
    },
    state: () => {
      const s = active();
      return { scene: s?.scene.key ?? 'none', ...(s?.debugState?.() ?? {}) };
    },
  };
}
