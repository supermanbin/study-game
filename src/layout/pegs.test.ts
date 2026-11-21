import { describe, expect, it } from 'vitest';
import { EXPR_RADIUS, PEG_RADIUS } from '../game/tuning';
import { landscapeLayout, portraitLayout } from './game';
import { clearOfPegsX, pegPositions } from './pegs';

describe.each([
  ['landscape', landscapeLayout()],
  ['portrait 1280', portraitLayout(1280)],
  ['portrait 1560', portraitLayout(1560)],
])('pegs (%s)', (_name, layout) => {
  const { field } = layout;
  const pegs = pegPositions(field);
  const minGap = 2 * (EXPR_RADIUS + PEG_RADIUS);

  it('builds staggered rows with the layout counts', () => {
    expect(field.pegRowsY.map(y => pegs.filter(p => p.y === y).length)).toEqual(
      field.pegRowsY.map((_, r) => field.pegCounts[r % 2]),
    );
  });

  it('leaves room for the largest ball between any two pegs', () => {
    for (let i = 0; i < pegs.length; i++) {
      for (let j = i + 1; j < pegs.length; j++) {
        expect(Math.hypot(pegs[i].x - pegs[j].x, pegs[i].y - pegs[j].y)).toBeGreaterThan(minGap);
      }
    }
  });

  it('leaves room for the largest ball between the outer pegs and the walls', () => {
    for (const p of pegs) expect(Math.min(p.x, field.width - p.x) - PEG_RADIUS).toBeGreaterThan(2 * EXPR_RADIUS);
  });

  it('keeps every peg above the warning line', () => {
    for (const p of pegs) expect(p.y + PEG_RADIUS).toBeLessThan(field.warningY);
  });

  describe('clearOfPegsX', () => {
    const row0 = pegs.filter(p => p.y === field.pegRowsY[0]);
    const y = field.ceilingY + EXPR_RADIUS + 2;
    const overlaps = (x: number) => row0.some(p => Math.hypot(p.x - x, p.y - y) < EXPR_RADIUS + PEG_RADIUS);

    it('moves an expression ball off every row-0 peg and stays in range', () => {
      for (let x = field.spawnXMin; x <= field.spawnXMax; x += 5) {
        const out = clearOfPegsX(x, y, EXPR_RADIUS, field.spawnXMin, field.spawnXMax, field);
        expect(overlaps(out)).toBe(false);
        expect(out).toBeGreaterThanOrEqual(field.spawnXMin);
        expect(out).toBeLessThanOrEqual(field.spawnXMax);
      }
    });

    it('leaves a clear x unchanged', () => {
      const mid = (row0[0].x + row0[1].x) / 2; // halfway between two row-0 pegs
      expect(overlaps(mid)).toBe(false);
      expect(clearOfPegsX(mid, y, EXPR_RADIUS, field.spawnXMin, field.spawnXMax, field)).toBe(mid);
    });
  });
});
