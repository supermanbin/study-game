import { describe, expect, it } from 'vitest';
import { ALL_FACTS, factKey, koujue, parseFactKey } from './facts';

describe('facts', () => {
  it('has 45 facts with a <= b', () => {
    expect(ALL_FACTS).toHaveLength(45);
    expect(ALL_FACTS.every(f => f.a >= 1 && f.a <= f.b && f.b <= 9)).toBe(true);
  });
  it('normalizes fact keys', () => {
    expect(factKey(4, 3)).toBe('3x4');
    expect(parseFactKey('3x4')).toEqual({ a: 3, b: 4 });
  });
  it.each([
    [1, 1, '一一得一'], [3, 3, '三三得九'], [2, 5, '二五一十'], [3, 4, '三四十二'],
    [4, 5, '四五二十'], [5, 5, '五五二十五'], [6, 9, '六九五十四'], [9, 9, '九九八十一'],
  ])('koujue %i×%i', (a, b, s) => expect(koujue({ a, b })).toBe(s));
});
