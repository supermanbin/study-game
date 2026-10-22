import type Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { PEG_RADIUS, PEG_ROWS_Y, PEG_SPACING } from './tuning';

const PEG_LABEL = 'peg';
const PEG_DEPTH = 9;

/** Peg centres: staggered rows of 6 / 5 pegs, PEG_SPACING apart, centred across the width. */
export function pegPositions(width = GAME_WIDTH): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  PEG_ROWS_Y.forEach((y, r) => {
    const n = r % 2 === 0 ? 6 : 5;
    const x0 = (width - (n - 1) * PEG_SPACING) / 2;
    for (let i = 0; i < n; i++) out.push({ x: x0 + i * PEG_SPACING, y });
  });
  return out;
}

/** Static bouncy pegs (pachinko style) between the question band and the pile. */
export class Pegs {
  private readonly scene: Phaser.Scene;
  private readonly arcs: Phaser.GameObjects.Arc[] = [];

  static isPeg(body: MatterJS.BodyType): boolean {
    return (body.parent ?? body).label === PEG_LABEL;
  }

  constructor(scene: Phaser.Scene, enabled: boolean) {
    this.scene = scene;
    if (!enabled) return;
    for (const { x, y } of pegPositions()) {
      const arc = scene.add.circle(x, y, PEG_RADIUS, 0xffd166).setStrokeStyle(3, 0xfff3bf).setDepth(PEG_DEPTH);
      scene.matter.add.gameObject(arc, {
        isStatic: true,
        shape: { type: 'circle', radius: PEG_RADIUS },
        restitution: 0.9,
        label: PEG_LABEL,
      });
      this.arcs.push(arc);
    }
  }

  /** Brief scale pulse on the peg that owns `body`. */
  flash(body: MatterJS.BodyType): void {
    const arc = (body.parent ?? body).gameObject as Phaser.GameObjects.Arc | null | undefined;
    if (!arc || !this.arcs.includes(arc)) return;
    this.scene.tweens.killTweensOf(arc);
    arc.setScale(1);
    this.scene.tweens.add({ targets: arc, scale: 1.6, duration: 70, yoyo: true });
  }

  destroy(): void {
    for (const arc of this.arcs) {
      this.scene.tweens.killTweensOf(arc);
      arc.destroy(); // also removes the Matter body
    }
    this.arcs.length = 0;
  }
}
