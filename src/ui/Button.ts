import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';

export interface ButtonOpts {
  disabled?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
  /** Extra lines under the label (e.g. level name), drawn inside the button. */
  subtitle?: string;
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
  const w = opts.width ?? 280;
  const h = Math.max(64, opts.height ?? 72);
  const disabled = opts.disabled ?? false;
  const fill = disabled ? 0xbdbdbd : (opts.color ?? 0x43a047);

  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 20);
  g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
  g.lineStyle(4, 0xffffff, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
  const text = scene.add
    .text(0, opts.subtitle ? -32 : 0, label, {
      fontFamily: FONT_FAMILY,
      fontSize: `${opts.fontSize ?? 36}px`,
      color: disabled ? '#757575' : '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  const children: Phaser.GameObjects.GameObject[] = [g, text];
  if (opts.subtitle) {
    children.push(
      scene.add
        .text(0, 6, opts.subtitle, { fontFamily: FONT_FAMILY, fontSize: '20px', color: disabled ? '#757575' : '#fffde7' })
        .setOrigin(0.5),
    );
  }
  const c = scene.add.container(x, y, children);
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
    c.setInteractive({ useHandCursor: true })
      .on('pointerover', () => c.setScale(1.05))
      .on('pointerout', () => c.setScale(1))
      .on('pointerdown', onClick);
  }
  return c;
}
