import { describe, expect, it } from 'vitest';
import { designSize, layoutKindFor, portraitHeight, renderScaleFor, switchAction } from './select';

const legacy = (dpr: number, vw: number, vh: number) =>
  Math.min(3, Math.max(1, Math.ceil(dpr * Math.max(vw / 1280, vh / 720) * 2) / 2));

describe('layoutKindFor', () => {
  it('is portrait only when strictly taller than wide', () => {
    expect(layoutKindFor(1280, 720)).toBe('landscape');
    expect(layoutKindFor(720, 720)).toBe('landscape');
    expect(layoutKindFor(390, 844)).toBe('portrait');
  });
});

describe('portraitHeight', () => {
  it('follows the aspect, clamped to 1280..1560', () => {
    expect(portraitHeight(390, 844)).toBe(1558);
    expect(portraitHeight(720, 1280)).toBe(1280);
    expect(portraitHeight(768, 1024)).toBe(1280);
    expect(portraitHeight(360, 900)).toBe(1560);
  });
});

describe('designSize', () => {
  it('returns the design size per kind', () => {
    expect(designSize(1280, 720)).toEqual({ kind: 'landscape', width: 1280, height: 720 });
    expect(designSize(390, 844)).toEqual({ kind: 'portrait', width: 720, height: 1558 });
  });
});

describe('renderScaleFor', () => {
  it('equals the legacy formula in landscape', () => {
    for (const [dpr, vw, vh] of [[1, 1280, 720], [2, 1512, 860], [3, 3000, 2000], [1, 800, 600]]) {
      expect(renderScaleFor(designSize(vw, vh), dpr, vw, vh)).toBe(legacy(dpr, vw, vh));
    }
  });
  it('gives 2 for a 390×844 phone at 3× DPR', () => {
    expect(renderScaleFor(designSize(390, 844), 3, 390, 844)).toBe(2);
  });
});

describe('switchAction', () => {
  it('maps every scene for same and different kind', () => {
    const cases: [string, string, string][] = [
      ['Menu', 'none', 'relayout'],
      ['LevelSelect', 'none', 'relayout'],
      ['Cards', 'none', 'relayout'],
      ['Settings', 'none', 'relayout'],
      ['Game', 'gameMatch', 'gameMismatch'],
      ['Result', 'none', 'none'],
    ];
    for (const [key, same, diff] of cases) {
      expect(switchAction('landscape', 'landscape', key)).toBe(same);
      expect(switchAction('landscape', 'portrait', key)).toBe(diff);
    }
  });
});
