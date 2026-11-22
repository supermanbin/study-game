import type Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { layoutFor, type Layout } from './game';
import { designSize, LAYOUT_SETTLE_MS, switchAction } from './select';

/** Bakes every texture a layout needs (`bakeLayout`; injected so this module never imports the scenes). */
export type LayoutBaker = (scene: Phaser.Scene, layout: Layout) => void;

/** Emitted on `game.events` while Game runs, with `true` when the window shape differs from the applied layout. */
export const LAYOUT_MISMATCH_EVENT = 'layout-mismatch';

/** Registry key of the layout waiting for the next scene start (unset when the window matches `layout`). */
const PENDING = 'pendingLayout';

let bakeFor: LayoutBaker | undefined;

/**
 * Watches the window shape. A flip counts once it has been stable for LAYOUT_SETTLE_MS: the new layout becomes
 * pending (applied at the next scene start), menu pages reopen in it at once, and Game is told whether the window
 * still matches its layout (it pauses with a hint and keeps its layout).
 */
export function installLayoutWatcher(game: Phaser.Game, bake: LayoutBaker): void {
  bakeFor = bake;
  let timer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => settle(game), LAYOUT_SETTLE_MS);
  });
}

function settle(game: Phaser.Game): void {
  const wanted = designSize(innerWidth, innerHeight);
  const applied = game.registry.get('layout') as Layout;
  if (wanted.kind !== applied.kind) game.registry.set(PENDING, layoutFor(wanted));
  else game.registry.remove(PENDING);
  const active = game.scene.getScenes(true)[0];
  if (!active) return;
  const key = active.scene.key;
  switch (switchAction(applied.kind, wanted.kind, key)) {
    case 'relayout':
      startScene(active, key, active.sys.settings.data as object | undefined);
      break;
    case 'gameMismatch':
      game.events.emit(LAYOUT_MISMATCH_EVENT, true);
      break;
    case 'gameMatch':
      game.events.emit(LAYOUT_MISMATCH_EVENT, false);
      break;
    case 'none':
      break;
  }
}

/**
 * Applies the pending layout, if any: bakes its textures (between scenes, through `baker`), makes it the
 * registry `layout` and resizes the canvas, so the next scene start gets a camera of the new size.
 */
export function applyPendingLayout(game: Phaser.Game, baker: Phaser.Scene): boolean {
  const next = game.registry.get(PENDING) as Layout | undefined;
  if (!next) return false;
  game.registry.remove(PENDING);
  bakeFor?.(baker, next);
  game.registry.set('layout', next);
  game.scale.setGameSize(next.width * RENDER_SCALE, next.height * RENDER_SCALE);
  return true;
}

/** Every scene change goes through here, so a pending layout takes effect at the next scene. */
export function startScene(from: Phaser.Scene, key: string, data?: object): void {
  applyPendingLayout(from.game, from);
  from.scene.start(key, data);
}
