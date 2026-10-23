import Phaser from 'phaser';
import { FONT_FAMILY, RENDER_SCALE } from '../config';
import { bakeBackground, bakeBall, bakeRoundRect, bakeShape, clayImage, css } from './clay';
import { CLAY } from './palette';

// Shared clay UI pieces for the scenes. Every texture is cached by key (clay.ts), so rebuilding a scene allocates
// nothing new.

/** Full-screen cream radial behind everything (depth -100). */
export function clayBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, bakeBackground(scene)).setOrigin(0, 0).setDepth(-100);
}

/** Corner radius of a clay panel of height h (shared with pre-baking, so the cache keys match). */
export const panelRadius = (h: number): number => Math.min(28, h / 3);
/** Corner radius of a clay plaque of height h. */
export const plaqueRadius = (h: number): number => h / 2.6;

/** Large rounded panel (corner radius `panelRadius`). Origin = centre. */
export function clayPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number = CLAY.panel): Phaser.GameObjects.Image {
  return clayImage(scene, x, y, bakeRoundRect(scene, w, h, panelRadius(h), color));
}

/** Small plaque / chip (corner radius `plaqueRadius`). Origin = centre. */
export function clayPlaque(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number = CLAY.plaque): Phaser.GameObjects.Image {
  return clayImage(scene, x, y, bakeRoundRect(scene, w, h, plaqueRadius(h), color));
}

/** "Clay text": accent fill, thick light stroke, small warm drop shadow (+N, combo). */
export const CLAY_TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_FAMILY,
  fontStyle: 'bold',
  color: css(CLAY.accent),
  stroke: '#fff7ec',
  strokeThickness: 8,
  shadow: { offsetX: 0, offsetY: 3, color: 'rgba(120,80,50,.35)', blur: 0, fill: true, stroke: true },
};

/** Three stars, `lit` of them raised yellow, the rest inset faded. Centred on (x, y); `size` = one star's box. */
export function clayStars(scene: Phaser.Scene, x: number, y: number, lit: 0 | 1 | 2 | 3, size: number): Phaser.GameObjects.Container {
  const step = size * 1.15;
  const items = [0, 1, 2].map(i => {
    const on = i < lit;
    return clayImage(scene, (i - 1) * step, i === 1 ? -size * 0.08 : 0, bakeShape(scene, on ? 'star' : 'starOff', undefined, size));
  });
  return scene.add.container(x, y, items);
}

/** Clay padlock (replaces the emoji). `size` = its height. */
export function clayLock(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Image {
  return clayImage(scene, x, y, bakeShape(scene, 'lock')).setScale(size / 36 / RENDER_SCALE);
}

const TRACK = { w: 84, h: 44 };
const KNOB_R = 16;

/**
 * On/off switch: inset track with a raised knob (mint, right when on; faded, left when off). With `onTap` the
 * switch is tappable (track rect; fires on release of a press that started on it).
 */
export function clayToggle(scene: Phaser.Scene, x: number, y: number, on: boolean, onTap?: () => void): Phaser.GameObjects.Container {
  const track = clayImage(scene, 0, 0, bakeRoundRect(scene, TRACK.w, TRACK.h, TRACK.h / 2, on ? 0xcfe9d6 : CLAY.hpOff, true));
  const knob = clayImage(scene, (on ? 1 : -1) * (TRACK.w / 2 - KNOB_R - 6), 0, bakeBall(scene, on ? 0x6fcf97 : CLAY.faded, KNOB_R, !on));
  const c = scene.add.container(x, y, [track, knob]).setSize(TRACK.w, TRACK.h);
  if (onTap) {
    let armed = false;
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, TRACK.w, TRACK.h), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => (armed = true))
      .on('pointerout', () => (armed = false))
      .on('pointerup', () => {
        if (!armed) return;
        armed = false;
        onTap();
      });
    c.input!.cursor = 'pointer';
  }
  return c;
}
