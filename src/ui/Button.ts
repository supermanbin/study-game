import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { bakeRoundRect, bakeRoundRectPair, clayImage, labelStyleFor, type ClayTex } from './clay';
import { CLAY } from './palette';

export interface ButtonOpts {
  disabled?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
  /** Extra lines under the label (e.g. level name), drawn inside the button. */
  subtitle?: string;
}

/** Pressed buttons sink this many design px. */
const PRESS_SINK = 3;

/** Geometry and fill of a button with these options (shared by createButton and the Boot pre-bake). */
function buttonLook(opts: ButtonOpts): { w: number; h: number; radius: number; fill: number; disabled: boolean } {
  const w = opts.width ?? 280;
  const h = Math.max(64, opts.height ?? 72);
  const disabled = opts.disabled ?? false;
  const fill = disabled ? CLAY.faded : (opts.color ?? CLAY.primary);
  return { w, h, radius: Math.min(24, h / 3), fill, disabled };
}

/** Bakes (or looks up) a button's textures: raised, and pressed unless disabled. Boot pre-bakes via this. */
export function bakeButton(scene: Phaser.Scene, opts: ButtonOpts = {}): { raised: ClayTex; pressed?: ClayTex } {
  const { w, h, radius, fill, disabled } = buttonLook(opts);
  return disabled ? { raised: bakeRoundRect(scene, w, h, radius, fill) } : bakeRoundRectPair(scene, w, h, radius, fill);
}

const registry = new WeakMap<Phaser.Scene, Map<string, () => void>>();

/** Triggers the button registered under `label` in `scene`; disabled buttons are never registered. */
export function pressButton(scene: Phaser.Scene, label: string): boolean {
  const fn = registry.get(scene)?.get(label);
  if (!fn) return false;
  fn();
  return true;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const { w, h, disabled, fill } = buttonLook(opts);
  const { raised, pressed } = bakeButton(scene, opts);

  const body = clayImage(scene, 0, 0, raised);
  // Disabled buttons are faded clay: labelStyleFor gives them the faded ink darkened to ≥ 3:1.
  const labelStyle = labelStyleFor(fill);
  const text = scene.add
    .text(0, opts.subtitle ? -32 : 0, label, { fontFamily: FONT_FAMILY, fontSize: `${opts.fontSize ?? 36}px`, fontStyle: 'bold', ...labelStyle })
    .setOrigin(0.5);
  const parts: [Phaser.GameObjects.Image | Phaser.GameObjects.Text, number][] = [[body, 0], [text, text.y]];
  if (opts.subtitle) {
    const sub = scene.add
      .text(0, 6, opts.subtitle, { fontFamily: FONT_FAMILY, fontSize: '20px', ...labelStyle, strokeThickness: Math.min(3, labelStyle.strokeThickness) })
      .setOrigin(0.5);
    parts.push([sub, 6]);
  }
  const c = scene.add.container(x, y, parts.map(p => p[0]));
  c.setSize(w, h);

  if (!disabled) {
    let map = registry.get(scene);
    if (!map) {
      map = new Map();
      registry.set(scene, map);
      // Phaser reuses one scene instance per key; drop stale handlers when the scene shuts down.
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => registry.delete(scene));
    }
    map.set(label, onClick);

    const setPressed = (down: boolean) => {
      body.setTexture(down ? pressed!.key : raised.key);
      for (const [obj, y0] of parts) obj.setY(y0 + (down ? PRESS_SINK : 0));
    };
    // Only a press that started on this button may click it: pressing A and releasing on B clicks neither.
    let armed = false;
    // The hit area is the button rect only (the texture also carries shadow padding).
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => {
        armed = true;
        setPressed(true);
      })
      .on('pointerup', () => {
        const fire = armed;
        armed = false;
        setPressed(false);
        if (fire) onClick();
      })
      .on('pointerout', () => {
        armed = false;
        setPressed(false);
      });
    c.input!.cursor = 'pointer';
  }
  return c;
}
