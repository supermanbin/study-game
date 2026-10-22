import { describe, expect, it } from 'vitest';
import { GAME_WIDTH } from '../config';
import { clearOfPegsX, pegPositions } from './Pegs';
import { EXPR_RADIUS, NUMBER_RADIUS, PEG_RADIUS, PEG_ROWS_Y, WARNING_LINE_Y } from './tuning';

describe('pegPositions', () => {
  const pegs = pegPositions();
  const minGap = 2 * (Math.max(EXPR_RADIUS, NUMBER_RADIUS) + PEG_RADIUS);

  it('builds staggered rows of 6 / 5 pegs', () => {
    expect(PEG_ROWS_Y.map(y => pegs.filter(p => p.y === y).length)).toEqual([6, 5, 6]);
  });

  it('leaves room for the largest ball between any two pegs', () => {
    for (let i = 0; i < pegs.length; i++) {
      for (let j = i + 1; j < pegs.length; j++) {
        const d = Math.hypot(pegs[i].x - pegs[j].x, pegs[i].y - pegs[j].y);
        expect(d).toBeGreaterThan(minGap);
      }
    }
  });

  it('leaves room for the largest ball between the outermost pegs and the walls', () => {
    for (const p of pegs) {
      expect(Math.min(p.x, GAME_WIDTH - p.x) - PEG_RADIUS).toBeGreaterThan(minGap - 2 * PEG_RADIUS);
    }
  });

  it('keeps every peg above the warning line', () => {
    for (const p of pegs) expect(p.y + PEG_RADIUS).toBeLessThan(WARNING_LINE_Y);
  });
});

describe('clearOfPegsX', () => {
  const row0 = pegPositions().filter(p => p.y === PEG_ROWS_Y[0]);
  const y = 140 + EXPR_RADIUS + 2;
  const overlaps = (x: number) => row0.some(p => Math.hypot(p.x - x, p.y - y) < EXPR_RADIUS + PEG_RADIUS);

  it('moves an expression ball off every row-0 peg and stays in range', () => {
    for (let x = 120; x <= 1160; x += 5) {
      const out = clearOfPegsX(x, y, EXPR_RADIUS, 120, 1160);
      expect(overlaps(out)).toBe(false);
      expect(out).toBeGreaterThanOrEqual(120);
      expect(out).toBeLessThanOrEqual(1160);
    }
  });

  it('leaves a clear x unchanged', () => {
    expect(clearOfPegsX(250, y, EXPR_RADIUS, 120, 1160)).toBe(250);
  });
});
