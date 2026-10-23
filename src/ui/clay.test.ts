import { describe, expect, it } from 'vitest';
import { clayKey, clayParams, contrastRatio, labelStyleFor, shade } from './clay';
import { BALL_COLORS, CLAY } from './palette';

const cssToNum = (css: string): number => parseInt(css.replace('#', ''), 16);

describe('shade', () => {
  it('keeps the colour at 0 and reaches black / white at -1 / 1', () => {
    expect(shade(0x808080, 0)).toBe(0x808080);
    expect(shade(0xff8a6b, -1)).toBe(0x000000);
    expect(shade(0xff8a6b, 1)).toBe(0xffffff);
  });

  it('moves each channel proportionally', () => {
    expect(shade(0x804020, -0.5)).toBe(0x402010);
    expect(shade(0x000000, 0.5)).toBe(0x808080);
  });
});

describe('clayParams', () => {
  it('stays inside the material ranges (fraction of size)', () => {
    const p = clayParams(100);
    expect(p.dropX).toBeGreaterThanOrEqual(8);
    expect(p.dropX).toBeLessThanOrEqual(12);
    expect(p.dropY).toBeGreaterThanOrEqual(8);
    expect(p.dropY).toBeLessThanOrEqual(12);
    expect(p.dark).toBeGreaterThanOrEqual(10);
    expect(p.dark).toBeLessThanOrEqual(12);
    expect(p.light).toBeGreaterThanOrEqual(8);
    expect(p.light).toBeLessThanOrEqual(10);
    expect(p.dropBlur).toBeCloseTo(18, 0);
  });

  it('scales linearly with size', () => {
    expect(clayParams(50).dark * 2).toBeCloseTo(clayParams(100).dark);
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 1);
    expect(contrastRatio(0xffffff, 0xffffff)).toBe(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio(0x5a4636, 0xf6efe6)).toBeCloseTo(contrastRatio(0xf6efe6, 0x5a4636));
  });
});

describe('labelStyleFor (Review Focus 1)', () => {
  /** Thick strokes surround the glyphs, so the stroke is what the text is read against. */
  const effective = (ball: number): number => {
    const s = labelStyleFor(ball);
    const bg = s.strokeThickness >= 4 ? cssToNum(s.stroke) : ball;
    return contrastRatio(cssToNum(s.color), bg);
  };

  it.each([...BALL_COLORS, CLAY.faded].map(c => [c.toString(16), c]))('label on %s reaches 3:1', (_hex, c) => {
    expect(effective(c)).toBeGreaterThanOrEqual(3);
  });

  it('keeps white labels on the coloured balls', () => {
    for (const c of BALL_COLORS) expect(labelStyleFor(c).color).toBe('#ffffff');
  });
});

describe('clayKey', () => {
  it('joins kind and parts, colours in hex', () => {
    expect(clayKey('ball', 0xff8a6b, 42, 2.5)).toBe('clay:ball:ff8a6b:42:2.5');
  });
});
