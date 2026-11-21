import { ALL_FACTS, koujue } from '../core/facts';
import type { Fact, LayoutKind } from '../core/types';

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

export interface Box { x: number; y: number; w: number; h: number }
export type CountLineKey = 'correct' | 'score' | 'bonus';

export interface ResultScreen {
  panel: Box;
  title: TextSpot & { x: number };
  reason: TextSpot & { x: number };
  starsY: number;
  counts: Record<CountLineKey, TextSpot & { x: number }>;
  /** Button centres top to bottom for n buttons (portrait) or left to right (landscape). */
  buttonsAt(n: 2 | 3): Pt[];
  confetti: { y: number; dx: number };
}

export function resultScreen(L: ScreenSize): ResultScreen {
  const cx = L.width / 2;
  if (L.kind === 'landscape') {
    return {
      panel: { x: 640, y: 282, w: 780, h: 510 },
      title: { x: cx, y: 90, size: 72 },
      reason: { x: cx, y: 160, size: 32 },
      starsY: 255,
      counts: {
        correct: { x: cx, y: 350, size: 40 },
        score: { x: cx, y: 405, size: 36 },
        bonus: { x: cx, y: 455, size: 36 },
      },
      buttonsAt: n => Array.from({ length: n }, (_, k) => ({ x: cx + (k - (n - 1) / 2) * 330, y: 600 })),
      confetti: { y: 120, dx: 300 },
    };
  }
  const H = L.height;
  const top = R(0.06 * H);
  return {
    panel: { x: cx, y: top + 310, w: 640, h: 620 },
    title: { x: cx, y: top + 80, size: 72 },
    reason: { x: cx, y: top + 150, size: 32 },
    starsY: top + 270,
    counts: {
      correct: { x: cx, y: top + 400, size: 40 },
      score: { x: cx, y: top + 465, size: 36 },
      bonus: { x: cx, y: top + 530, size: 36 },
    },
    buttonsAt: n => Array.from({ length: n }, (_, k) => ({ x: cx, y: H - R(0.08 * H) - (n - 1 - k) * 110 })),
    confetti: { y: top + 40, dx: 200 },
  };
}

/** Portrait pages: b <= 5 and b >= 6, each in ALL_FACTS order. */
export function cardPages(): [Fact[], Fact[]] {
  return [ALL_FACTS.filter(f => f.b <= 5), ALL_FACTS.filter(f => f.b >= 6)];
}

export interface CardCell { fact: Fact; x: number; y: number; w: number; h: number }
export interface CardGrid { fontSize: number; cards: CardCell[] }

const CARD_PX = 28;
const CARD_PAD = 16;
const CARD_GAP = 6;

export function cardGrid(L: ScreenSize, page: 0 | 1): CardGrid {
  if (L.kind === 'landscape') {
    const x0 = 640 - (118 * 9) / 2 + 118 / 2;
    return {
      fontSize: 20,
      cards: ALL_FACTS.map(fact => ({ fact, x: x0 + (fact.b - 1) * 118, y: 105 + (fact.a - 1) * 58, w: 112, h: 54 })),
    };
  }
  const facts = cardPages()[page];
  const cols = [...new Set(facts.map(f => f.b))].sort((a, b) => a - b);
  const width = new Map<number, number>();
  for (const b of cols) width.set(b, Math.max(...facts.filter(f => f.b === b).map(f => koujue(f).length)) * CARD_PX + CARD_PAD);
  const total = cols.reduce((t, b) => t + width.get(b)!, 0) + CARD_GAP * (cols.length - 1);
  const left = new Map<number, number>();
  let x = L.width / 2 - total / 2;
  for (const b of cols) {
    left.set(b, x + width.get(b)! / 2);
    x += width.get(b)! + CARD_GAP;
  }
  const y0 = R(0.2 * L.height) + 32;
  return {
    fontSize: CARD_PX,
    cards: facts.map(fact => ({ fact, x: left.get(fact.b)!, y: y0 + (fact.a - 1) * 72, w: width.get(fact.b)!, h: 64 })),
  };
}

export interface CardsScreen {
  title: TextSpot & { x: number };
  tabs: Pt[];
  back: Pt;
}

export function cardsScreen(L: ScreenSize): CardsScreen {
  if (L.kind === 'landscape') return { title: { x: 640, y: 40, size: 40 }, tabs: [], back: { x: 1130, y: 665 } };
  return {
    title: { x: L.width / 2, y: R(0.06 * L.height), size: 40 },
    tabs: [{ x: 250, y: R(0.13 * L.height) }, { x: 470, y: R(0.13 * L.height) }],
    back: { x: L.width / 2, y: L.height - 100 },
  };
}
