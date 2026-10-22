import { describe, it, expect } from 'vitest';
import { pickLine, Throttle } from './pickLine';
import { mulberry32 } from '../core/rng';

describe('pickLine', () => {
  it('never repeats lastId over 500 draws', () => {
    const rng = mulberry32(42);
    const lines = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    let last: string | undefined;
    for (let i = 0; i < 500; i++) {
      const l = pickLine(lines, last, rng);
      expect(l.id).not.toBe(last);
      last = l.id;
    }
  });
  it('returns the only line of a single-line list', () => {
    expect(pickLine([{ id: 'x' }], 'x', mulberry32(1)).id).toBe('x');
  });
});

describe('Throttle', () => {
  it('allows only after the interval', () => {
    const t = new Throttle(80);
    expect(t.allow(0)).toBe(true);
    expect(t.allow(50)).toBe(false);
    expect(t.allow(80)).toBe(true);
  });
});
