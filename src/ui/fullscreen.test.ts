import { describe, expect, it } from 'vitest';
import { shouldRequestFullscreen } from './fullscreen';

describe('shouldRequestFullscreen', () => {
  const ok = { maxTouchPoints: 5, fullscreenEnabled: true, fullscreenElement: null };
  it('is true only on touch devices that support fullscreen and are not fullscreen yet', () => {
    expect(shouldRequestFullscreen(ok)).toBe(true);
    expect(shouldRequestFullscreen({ ...ok, maxTouchPoints: 0 })).toBe(false);
    expect(shouldRequestFullscreen({ ...ok, fullscreenEnabled: false })).toBe(false);
    expect(shouldRequestFullscreen({ ...ok, fullscreenElement: {} })).toBe(false);
  });
});
