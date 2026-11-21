import type { LayoutKind } from '../core/types';

export interface DesignSize {
  kind: LayoutKind;
  width: number;
  height: number;
}

export const LANDSCAPE_WIDTH = 1280;
export const LANDSCAPE_HEIGHT = 720;
export const PORTRAIT_WIDTH = 720;
export const PORTRAIT_MIN_H = 1280;
export const PORTRAIT_MAX_H = 1560;
/** A viewport flip must be stable this long before it counts. */
export const LAYOUT_SETTLE_MS = 300;

/** Portrait iff the viewport is strictly taller than wide. */
export function layoutKindFor(vw: number, vh: number): LayoutKind {
  return vw < vh ? 'portrait' : 'landscape';
}

/** Portrait design height: the viewport aspect at 720 wide, clamped to [1280, 1560]. */
export function portraitHeight(vw: number, vh: number): number {
  return Math.min(PORTRAIT_MAX_H, Math.max(PORTRAIT_MIN_H, Math.round((PORTRAIT_WIDTH * vh) / vw)));
}

export function designSize(vw: number, vh: number): DesignSize {
  if (layoutKindFor(vw, vh) === 'portrait') {
    return { kind: 'portrait', width: PORTRAIT_WIDTH, height: portraitHeight(vw, vh) };
  }
  return { kind: 'landscape', width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT };
}

/** Canvas resolution multiplier, in half steps between 1 and 3 (the landscape formula is unchanged). */
export function renderScaleFor(size: DesignSize, dpr: number, vw: number, vh: number): number {
  const fit = Math.max(vw / size.width, vh / size.height);
  return Math.min(3, Math.max(1, Math.ceil(dpr * fit * 2) / 2));
}

export type SwitchAction = 'none' | 'relayout' | 'gameMismatch' | 'gameMatch';

/** What to do when the wanted layout (after settling) is compared with the applied one, per active scene. */
export function switchAction(applied: LayoutKind, wanted: LayoutKind, sceneKey: string): SwitchAction {
  if (wanted === applied) return sceneKey === 'Game' ? 'gameMatch' : 'none';
  if (sceneKey === 'Game') return 'gameMismatch';
  return ['Menu', 'LevelSelect', 'Cards', 'Settings'].includes(sceneKey) ? 'relayout' : 'none';
}
