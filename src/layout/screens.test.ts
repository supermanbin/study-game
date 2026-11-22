import { describe, expect, it } from 'vitest';
import { koujue } from '../core/facts';
import { ALL_FACTS } from '../core/facts';
import { cardGrid, cardPages, cardsScreen, levelSelectScreen, menuScreen, resultScreen, settingsScreen, type ScreenSize } from './screens';

const land: ScreenSize = { kind: 'landscape', width: 1280, height: 720 };
const port = (height: number): ScreenSize => ({ kind: 'portrait', width: 720, height });

// ButtonOpts sizes (buttons are at least 64 high, default 72).
const MENU_SIZES = { start: [360, 88], cards: [360, 72], settings: [360, 72] } as const;
const ROW_BUTTON = [300, 72] as const;
const BACK = [220, 72] as const;
const TOGGLE = [84, 44] as const;

type Rect = { x: number; y: number; w: number; h: number };
const rect = (p: { x: number; y: number }, [w, h]: readonly [number, number]): Rect => ({ x: p.x, y: p.y, w, h });

const within = (r: Rect, W: number, H: number) =>
  r.x - r.w / 2 >= 0 && r.x + r.w / 2 <= W && r.y - r.h / 2 >= 0 && r.y + r.h / 2 <= H;
const overlap = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe('landscape screens equal today\'s coordinates', () => {
  it('menu', () => {
    expect(menuScreen(land)).toEqual({
      balls: { y: 62, step: 130 },
      title: { y: 170, size: 96 },
      subtitle: { y: 255, size: 30 },
      start: { x: 640, y: 380 },
      cards: { x: 640, y: 495 },
      settings: { x: 640, y: 595 },
    });
  });
  it('level select', () => {
    const s = levelSelectScreen(land);
    expect(s.title).toEqual({ y: 60, size: 56 });
    expect(s.tile).toEqual({ w: 340, h: 150, fontSize: 40, subtitleSize: 20 });
    expect(s.tiles).toEqual([
      { x: 240, y: 200 }, { x: 640, y: 200 }, { x: 1040, y: 200 },
      { x: 240, y: 390 }, { x: 640, y: 390 }, { x: 1040, y: 390 },
    ]);
    expect(s.starsDy).toBe(46);
    expect(s.lock).toEqual({ dx: 130, dy: -42 });
    expect(s.back).toEqual({ x: 640, y: 620 });
  });
  it('settings', () => {
    const s = settingsScreen(land);
    expect(s.title).toEqual({ y: 90, size: 64 });
    expect(s.rows.map(r => r.button)).toEqual([{ x: 640, y: 230 }, { x: 640, y: 350 }, { x: 640, y: 470 }]);
    expect(s.rows.map(r => r.toggle)).toEqual([{ x: 850, y: 222 }, { x: 850, y: 342 }, { x: 850, y: 462 }]);
    expect(s.rows.map(r => r.state)).toEqual([{ x: 850, y: 264 }, { x: 850, y: 384 }, { x: 850, y: 504 }]);
    expect(s.stateSize).toBe(22);
    expect(s.back).toEqual({ x: 640, y: 620 });
  });
});

describe('portrait screens', () => {
  it('menu tile fractions of H', () => {
    const m = menuScreen(port(1558));
    expect(m.balls.y).toBe(Math.round(0.17 * 1558));
    expect(m.start).toEqual({ x: 360, y: 779 });
  });

  for (const H of [1280, 1558, 1560]) {
    describe(`H = ${H}`, () => {
      it('menu fits and does not overlap', () => {
        const m = menuScreen(port(H));
        const rects = (Object.keys(MENU_SIZES) as (keyof typeof MENU_SIZES)[]).map(k => rect(m[k], MENU_SIZES[k]));
        for (const r of rects) expect(within(r, 720, H)).toBe(true);
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false);
        // Title is 6 characters wide; decorative balls span 4 steps plus a ball.
        expect(6 * m.title.size).toBeLessThanOrEqual(720);
        expect(4 * m.balls.step + 120).toBeLessThanOrEqual(720);
        for (const y of [m.balls.y, m.title.y, m.subtitle.y]) expect(y > 0 && y < H).toBe(true);
        expect(m.balls.y).toBeLessThan(m.title.y);
        expect(m.title.y).toBeLessThan(m.subtitle.y);
        expect(m.subtitle.y).toBeLessThan(m.start.y - 44);
        expect(Math.min(m.title.size, m.subtitle.size)).toBeGreaterThanOrEqual(22);
      });

      it('level select fits and does not overlap', () => {
        const s = levelSelectScreen(port(H));
        const rects = s.tiles.map(p => rect(p, [s.tile.w, s.tile.h]));
        const back = rect(s.back, BACK);
        for (const r of [...rects, back]) expect(within(r, 720, H)).toBe(true);
        const all = [...rects, back];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j])).toBe(false);
        expect(s.title.y).toBeLessThan(rects[0].y - s.tile.h / 2);
        // Stars and lock stay inside their tile.
        expect(s.starsDy + 15).toBeLessThanOrEqual(s.tile.h / 2);
        expect(Math.abs(s.lock.dx) + 19).toBeLessThanOrEqual(s.tile.w / 2);
        expect(Math.abs(s.lock.dy) + 19).toBeLessThanOrEqual(s.tile.h / 2);
        for (const f of [s.title.size, s.tile.fontSize, s.tile.subtitleSize]) expect(f).toBeGreaterThanOrEqual(22);
      });

      it('settings fits and does not overlap', () => {
        const s = settingsScreen(port(H));
        const rects: Rect[] = [];
        for (const r of s.rows) {
          const b = rect(r.button, ROW_BUTTON);
          const t = rect(r.toggle, TOGGLE);
          expect(within(b, 720, H)).toBe(true);
          expect(within(t, 720, H)).toBe(true);
          expect(within(rect(r.state, [60, s.stateSize]), 720, H)).toBe(true);
          expect(overlap(b, t)).toBe(false);
          rects.push(b);
        }
        const back = rect(s.back, BACK);
        expect(within(back, 720, H)).toBe(true);
        rects.push(back);
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false);
        expect(s.title.y).toBeLessThan(rects[0].y - 36);
        expect(Math.min(s.title.size, s.stateSize)).toBeGreaterThanOrEqual(22);
      });
    });
  }
});

describe('cards and result', () => {
  it('cardPages splits 15 + 30 and covers all 45 once', () => {
    const [a, b] = cardPages();
    expect(a).toHaveLength(15);
    expect(b).toHaveLength(30);
    expect(a.every(f => f.b <= 5) && b.every(f => f.b >= 6)).toBe(true);
    expect([...a, ...b].map(f => `${f.a}x${f.b}`).sort()).toEqual(ALL_FACTS.map(f => `${f.a}x${f.b}`).sort());
  });

  it('landscape cardGrid keeps today\'s positions', () => {
    const g = cardGrid(land, 0);
    expect(g.fontSize).toBe(20);
    expect(g.cards).toHaveLength(45);
    const at = (a: number, b: number) => g.cards.find(c => c.fact.a === a && c.fact.b === b)!;
    expect(at(1, 1)).toMatchObject({ x: 640 - 59 * 9 + 59, y: 105, w: 112, h: 54 });
    expect(at(1, 9)).toMatchObject({ x: 640 - 59 * 9 + 59 + 8 * 118, y: 105 });
    expect(at(9, 9)).toMatchObject({ x: 640 - 59 * 9 + 59 + 8 * 118, y: 105 + 8 * 58 });
    expect(cardGrid(land, 1)).toEqual(g);
    expect(cardsScreen(land)).toEqual({ title: { x: 640, y: 40, size: 40 }, tabs: [], back: { x: 1130, y: 665 } });
  });

  it('landscape resultScreen equals today', () => {
    const r = resultScreen(land);
    expect(r.panel).toEqual({ x: 640, y: 282, w: 780, h: 510 });
    expect(r.starsY).toBe(255);
    expect(r.buttonsAt(3)).toEqual([{ x: 310, y: 600 }, { x: 640, y: 600 }, { x: 970, y: 600 }]);
    expect(r.buttonsAt(2)).toEqual([{ x: 475, y: 600 }, { x: 805, y: 600 }]);
    expect(r.confetti).toEqual({ y: 120, dx: 300 });
  });

  for (const H of [1280, 1558, 1560]) {
    describe(`portrait H = ${H}`, () => {
      const L = port(H);
      for (const page of [0, 1] as const) {
        it(`cards page ${page}`, () => {
          const g = cardGrid(L, page);
          const tabs = cardsScreen(L).tabs;
          expect(g.cards).toHaveLength(page === 0 ? 15 : 30);
          expect(new Set(g.cards.map(c => c.fact.b)).size).toBe(page === 0 ? 5 : 4);
          expect(new Set(g.cards.map(c => c.fact.a)).size).toBe(page === 0 ? 5 : 9);
          expect(g.fontSize).toBeGreaterThanOrEqual(28);
          const rects = g.cards.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
          for (const c of g.cards) {
            expect(c.w).toBeGreaterThanOrEqual(koujue(c.fact).length * 28 + 16);
            expect(c.y - c.h / 2).toBeGreaterThan(tabs[0].y + 32);
          }
          for (const r of rects) expect(within(r, 720, H)).toBe(true);
          for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false);
          expect(Math.max(...rects.map(r => r.y + r.h / 2))).toBeLessThan(cardsScreen(L).back.y - 36);
        });
      }

      it('result fits', () => {
        const r = resultScreen(L);
        expect(within(r.panel, 720, H)).toBe(true);
        for (const n of [2, 3] as const) {
          const rects = r.buttonsAt(n).map(p => rect(p, [290, 84]));
          for (const b of rects) {
            expect(within(b, 720, H)).toBe(true);
            expect(b.y - 42).toBeGreaterThan(r.panel.y + r.panel.h / 2);
          }
          for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false);
        }
        const ys = [r.title.y, r.reason.y, r.starsY, r.counts.correct.y, r.counts.score.y, r.counts.bonus.y];
        expect([...ys].sort((a, b) => a - b)).toEqual(ys);
        for (const y of ys) expect(Math.abs(y - r.panel.y)).toBeLessThan(r.panel.h / 2);
        expect(Math.min(r.title.size, r.reason.size, ...Object.values(r.counts).map(c => c.size))).toBeGreaterThanOrEqual(22);
      });
    });
  }
});
