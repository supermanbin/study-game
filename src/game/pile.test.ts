import { describe, expect, it } from 'vitest';
import { PileOverflowTracker } from './pile';

describe('PileOverflowTracker', () => {
  it('fires only after the pile stays above the line for the full hold time', () => {
    const t = new PileOverflowTracker(320, 2000);
    expect(t.update(1000, 300)).toBe(false);
    expect(t.update(999, 300)).toBe(false);
    expect(t.update(1, 300)).toBe(true);
  });

  it('a frame below the line resets the hold', () => {
    const t = new PileOverflowTracker(320, 2000);
    expect(t.update(1500, 300)).toBe(false);
    expect(t.update(16, 400)).toBe(false);
    expect(t.update(1500, 300)).toBe(false);
    expect(t.update(499, 300)).toBe(false);
    expect(t.update(1, 300)).toBe(true);
  });

  it('a frame with no pile (null) resets the hold', () => {
    const t = new PileOverflowTracker(320, 2000);
    expect(t.update(1999, 300)).toBe(false);
    expect(t.update(16, null)).toBe(false);
    expect(t.update(1999, 300)).toBe(false);
    expect(t.update(1, 300)).toBe(true);
  });

  it('top exactly on the line is not above it', () => {
    const t = new PileOverflowTracker(320, 2000);
    expect(t.update(5000, 320)).toBe(false);
  });
});
