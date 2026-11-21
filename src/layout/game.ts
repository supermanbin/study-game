import type { ItemKind } from '../core/session';
import type { DesignSize } from './select';

export interface Box { x: number; y: number; w: number; h: number }
export interface TextBox extends Box { fontSize: number }

export interface FieldLayout {
  width: number;
  height: number;
  ceilingY: number;
  groundY: number;
  warningY: number;
  spawnXMin: number;
  spawnXMax: number;
  tossY: number;
  tossInset: number;
  pegRowsY: readonly number[];
  pegSpacing: number;
  /** Pegs per row, [even rows, odd rows]. */
  pegCounts: readonly [number, number];
  floorH: number;
}

export interface HudLayout {
  band: Box;
  prompt: { x: number; y: number; fontSize: number };
  score: TextBox;
  combo: TextBox;
  time: TextBox & { prefix: string };
  pause: Box;
  items: { y: number; w: number; h: number; fontSize: number; x: Record<ItemKind, number>; keyHints: boolean };
  reveal: TextBox;
  boss: { x: number; y: number };
  pausePanel: { w: number; h: number; hint: string };
}

export interface Layout {
  kind: 'landscape' | 'portrait';
  width: number;
  height: number;
  field: FieldLayout;
  hud: HudLayout;
}

/** Height of the pile zone (groundY - warningY) in portrait: 720 × 440 holds at least today's pile area. */
export const PILE_H_PORTRAIT = 440;

export function landscapeLayout(): Layout {
  return {
    kind: 'landscape',
    width: 1280,
    height: 720,
    field: {
      width: 1280,
      height: 720,
      ceilingY: 140,
      groundY: 700,
      warningY: 520,
      spawnXMin: 120,
      spawnXMax: 1160,
      tossY: 190,
      tossInset: 70,
      pegRowsY: [240, 320, 400, 480],
      pegSpacing: 195,
      pegCounts: [6, 5],
      floorH: 40,
    },
    hud: {
      band: { x: 640, y: 70, w: 1252, h: 120 },
      prompt: { x: 640, y: 50, fontSize: 64 },
      score: { x: 119, y: 38, w: 190, h: 44, fontSize: 28 },
      combo: { x: 301, y: 38, w: 150, h: 36, fontSize: 24 },
      time: { x: 1171, y: 42, w: 170, h: 52, fontSize: 34, prefix: '时间 ' },
      pause: { x: 1042, y: 42, w: 64, h: 48 },
      items: { y: 106, w: 150, h: 38, fontSize: 21, x: { freeze: 99, magnifier: 261 }, keyHints: true },
      reveal: { x: 640, y: 110, w: 280, h: 44, fontSize: 30 },
      boss: { x: 1190, y: 92 },
      pausePanel: { w: 560, h: 440, hint: '点空白处或按空格继续' },
    },
  };
}

export function portraitLayout(height: number): Layout {
  const ceilingY = 226;
  const groundY = height - 40;
  const warningY = groundY - PILE_H_PORTRAIT;
  return {
    kind: 'portrait',
    width: 720,
    height,
    field: {
      width: 720,
      height,
      ceilingY,
      groundY,
      warningY,
      spawnXMin: 80,
      spawnXMax: 640,
      tossY: 276,
      tossInset: 70,
      pegRowsY: [1, 2, 3, 4].map(k => Math.round(ceilingY + ((warningY - ceilingY) * k) / 5)),
      pegSpacing: 160,
      pegCounts: [4, 3],
      floorH: 60,
    },
    hud: {
      band: { x: 360, y: 141, w: 696, h: 150 },
      prompt: { x: 360, y: 106, fontSize: 72 },
      score: { x: 87, y: 34, w: 150, h: 44, fontSize: 24 },
      combo: { x: 231, y: 34, w: 118, h: 40, fontSize: 22 },
      time: { x: 574, y: 34, w: 120, h: 44, fontSize: 28, prefix: '' },
      pause: { x: 676, y: 34, w: 64, h: 44 },
      items: { y: 186, w: 140, h: 40, fontSize: 22, x: { freeze: 94, magnifier: 246 }, keyHints: false },
      reveal: { x: 360, y: 250, w: 340, h: 44, fontSize: 30 },
      boss: { x: 660, y: 186 },
      pausePanel: { w: 560, h: 440, hint: '点空白处也能继续' },
    },
  };
}

export function layoutFor(size: DesignSize): Layout {
  return size.kind === 'portrait' ? portraitLayout(size.height) : landscapeLayout();
}
