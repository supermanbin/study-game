import { describe, expect, it } from 'vitest';
import { landscapeLayout, portraitLayout, type Box } from './game';

const left = (b: Box) => b.x - b.w / 2;
const right = (b: Box) => b.x + b.w / 2;
const top = (b: Box) => b.y - b.h / 2;
const bottom = (b: Box) => b.y + b.h / 2;
const overlap = (a: Box, b: Box) => left(a) < right(b) && left(b) < right(a) && top(a) < bottom(b) && top(b) < bottom(a);

describe('landscapeLayout', () => {
  it('reproduces today\'s constants', () => {
    expect(landscapeLayout()).toEqual({
      kind: 'landscape',
      width: 1280,
      height: 720,
      field: {
        width: 1280, height: 720, ceilingY: 140, groundY: 700, warningY: 520, spawnXMin: 120, spawnXMax: 1160,
        tossY: 190, tossInset: 70, pegRowsY: [240, 320, 400, 480], pegSpacing: 195, pegCounts: [6, 5], floorH: 40,
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
    });
  });
});

describe.each([1280, 1400, 1558, 1560])('portraitLayout(%i)', H => {
  const l = portraitLayout(H);
  const { field, hud } = l;
  const items: Box[] = (['freeze', 'magnifier'] as const).map(k => ({
    x: hud.items.x[k], y: hud.items.y, w: hud.items.w, h: hud.items.h,
  }));
  const boxes: Box[] = [hud.band, hud.score, hud.combo, hud.time, hud.pause, hud.reveal, ...items];

  it('has a pile zone as large as the landscape one', () => {
    expect(field.groundY).toBe(H - 40);
    expect(field.groundY - field.warningY).toBe(440);
    expect(720 * 440).toBeGreaterThanOrEqual(1280 * 180);
  });

  it('keeps the band inside the width and above the ceiling', () => {
    expect(left(hud.band)).toBeGreaterThanOrEqual(0);
    expect(right(hud.band)).toBeLessThanOrEqual(720);
    expect(bottom(hud.band)).toBeLessThanOrEqual(field.ceilingY);
  });

  it('keeps every HUD box inside 0..720', () => {
    for (const b of boxes) {
      expect(left(b)).toBeGreaterThanOrEqual(0);
      expect(right(b)).toBeLessThanOrEqual(720);
    }
  });

  it('does not overlap the top-row boxes', () => {
    const row = [hud.score, hud.combo, hud.time, hud.pause];
    for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) expect(overlap(row[i], row[j])).toBe(false);
  });

  it('ends the items left of the boss HP bar', () => {
    const barStart = hud.boss.x - 30 - 252 - 12;
    for (const b of items) expect(right(b)).toBeLessThan(barStart);
  });

  it('keeps text at 22 or more', () => {
    for (const s of [hud.score, hud.combo, hud.time, hud.reveal, hud.prompt]) expect(s.fontSize).toBeGreaterThanOrEqual(22);
    expect(hud.items.fontSize).toBeGreaterThanOrEqual(22);
  });
});
