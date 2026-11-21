import type { LayoutKind } from '../core/types';

/** The part of a Layout the menu-side screens read. */
export interface ScreenSize {
  kind: LayoutKind;
  width: number;
  height: number;
}

export interface Pt { x: number; y: number }
export interface TextSpot { y: number; size: number }

const R = Math.round;

export interface MenuScreen {
  balls: { y: number; step: number };
  title: TextSpot;
  subtitle: TextSpot;
  start: Pt;
  cards: Pt;
  settings: Pt;
}

export function menuScreen(L: ScreenSize): MenuScreen {
  if (L.kind === 'landscape') {
    const x = L.width / 2;
    return {
      balls: { y: 62, step: 130 },
      title: { y: 170, size: 96 },
      subtitle: { y: 255, size: 30 },
      start: { x, y: 380 },
      cards: { x, y: 495 },
      settings: { x, y: 595 },
    };
  }
  const H = L.height;
  const x = L.width / 2;
  return {
    balls: { y: R(0.17 * H), step: 130 },
    title: { y: R(0.27 * H), size: 96 },
    subtitle: { y: R(0.35 * H), size: 30 },
    start: { x, y: R(0.5 * H) },
    cards: { x, y: R(0.61 * H) },
    settings: { x, y: R(0.7 * H) },
  };
}

export interface LevelSelectScreen {
  title: TextSpot;
  tile: { w: number; h: number; fontSize: number; subtitleSize: number };
  tiles: Pt[];
  starsDy: number;
  lock: { dx: number; dy: number };
  back: Pt;
}

export function levelSelectScreen(L: ScreenSize): LevelSelectScreen {
  const landscape = L.kind === 'landscape';
  const tile = landscape ? { w: 340, h: 150, fontSize: 40, subtitleSize: 20 } : { w: 310, h: 200, fontSize: 40, subtitleSize: 24 };
  const tiles: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    if (landscape) tiles.push({ x: 240 + (i % 3) * 400, y: 200 + Math.floor(i / 3) * 190 });
    else tiles.push({ x: [190, 530][i % 2], y: R([0.27, 0.46, 0.65][Math.floor(i / 2)] * L.height) });
  }
  return {
    title: { y: landscape ? 60 : R(0.08 * L.height), size: 56 },
    tile,
    tiles,
    starsDy: tile.h / 2 - 29,
    lock: { dx: tile.w / 2 - 40, dy: -tile.h / 2 + 33 },
    back: landscape ? { x: 640, y: 620 } : { x: L.width / 2, y: L.height - 110 },
  };
}

export interface SettingsScreen {
  title: TextSpot;
  rows: { button: Pt; toggle: Pt; state: Pt }[];
  stateSize: number;
  back: Pt;
}

export function settingsScreen(L: ScreenSize): SettingsScreen {
  const landscape = L.kind === 'landscape';
  const y0 = landscape ? 230 : R(0.3 * L.height);
  const step = landscape ? 120 : R(0.13 * L.height);
  const bx = landscape ? 640 : 300;
  const tx = landscape ? 850 : 560;
  return {
    title: { y: landscape ? 90 : R(0.12 * L.height), size: 64 },
    rows: [0, 1, 2].map(i => {
      const y = y0 + i * step;
      return { button: { x: bx, y }, toggle: { x: tx, y: y - 8 }, state: { x: tx, y: y + 34 } };
    }),
    stateSize: 22,
    back: landscape ? { x: 640, y: 620 } : { x: L.width / 2, y: L.height - 128 },
  };
}
