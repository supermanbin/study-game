import { describe, expect, it } from 'vitest';
import { RestTimer, StuckTimer, isResting, outOfField } from './motion';

describe('isResting', () => {
  it('slow and supported is resting', () => {
    expect(isResting(0.5, true)).toBe(true);
  });

  it('slow but unsupported is not resting', () => {
    expect(isResting(0.5, false)).toBe(false);
  });

  it('supported but fast is not resting', () => {
    expect(isResting(0.9, true)).toBe(false);
  });
});

describe('RestTimer', () => {
  it('accumulates while resting', () => {
    const t = new RestTimer();
    expect(t.update(1000, true)).toBe(1000);
    expect(t.update(600, true)).toBe(1600);
    expect(t.ms).toBe(1600);
  });

  it('a non-resting frame resets to zero', () => {
    const t = new RestTimer();
    t.update(1000, true);
    expect(t.update(16, false)).toBe(0);
    expect(t.ms).toBe(0);
  });

  it('reset() clears the accumulated time', () => {
    const t = new RestTimer();
    t.update(1200, true);
    t.reset();
    expect(t.ms).toBe(0);
  });
});

describe('StuckTimer', () => {
  it('fires once slow and unsupported for the full nudge time, then resets', () => {
    const t = new StuckTimer();
    expect(t.update(999, true, false)).toBe(false);
    expect(t.update(1, true, false)).toBe(true);
    expect(t.update(16, true, false)).toBe(false);
  });

  it('supported frame resets the accumulation', () => {
    const t = new StuckTimer();
    t.update(500, true, false);
    expect(t.update(500, true, true)).toBe(false);
    expect(t.update(999, true, false)).toBe(false);
    expect(t.update(1, true, false)).toBe(true);
  });

  it('a fast frame resets the accumulation', () => {
    const t = new StuckTimer();
    t.update(900, true, false);
    expect(t.update(16, false, false)).toBe(false);
    expect(t.update(999, true, false)).toBe(false);
  });
});

describe('outOfField', () => {
  it('left of field beyond margin is out', () => {
    expect(outOfField(-101, 300, 1280, 700)).toBe(true);
  });

  it('right of field beyond margin is out', () => {
    expect(outOfField(1381, 300, 1280, 700)).toBe(true);
  });

  it('below ground beyond margin is out', () => {
    expect(outOfField(640, 901, 1280, 700)).toBe(true);
  });

  it('inside the field is not out', () => {
    expect(outOfField(640, 300, 1280, 700)).toBe(false);
  });
});
