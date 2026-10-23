import type Phaser from 'phaser';
import { GAME_WIDTH, RENDER_SCALE } from '../config';
import { bakeShape, clayImage, type ClayTex } from '../ui/clay';
import { CLAY } from '../ui/palette';
import { PEG_RADIUS, PEG_ROWS_Y, PEG_SPACING } from './tuning';

const PEG_LABEL = 'peg';
const PEG_DEPTH = 9;
/** Clay images are baked at RENDER_SCALE and shown at 1/RENDER_SCALE. */
const TEX_SCALE = 1 / RENDER_SCALE;
const FLASH_SCALE = 1.6;
const BRIGHTEN_MS = 60;

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

/**
 * Returns an x near `x` where a ball of radius `r` centred at height `y` does not overlap any row-0 peg,
 * staying inside [min, max]. Shifts away from the offending peg, or the other way when that leaves the range.
 */
export function clearOfPegsX(x: number, y: number, r: number, min: number, max: number, width = GAME_WIDTH): number {
  const minD = r + PEG_RADIUS + 2;
  const dy = Math.abs(PEG_ROWS_Y[0] - y);
  let out = Math.min(max, Math.max(min, x));
  if (dy >= minD) return out;
  const needDx = Math.sqrt(minD * minD - dy * dy) + 1;
  for (const p of pegPositions(width)) {
    if (p.y !== PEG_ROWS_Y[0] || Math.abs(out - p.x) >= needDx) continue;
    const away = out >= p.x ? p.x + needDx : p.x - needDx;
    const other = out >= p.x ? p.x - needDx : p.x + needDx;
    out = away >= min && away <= max ? away : other;
  }
  return out;
}

/**
 * Static bouncy pegs (pachinko style) between the question band and the pile: a clay peg image that is the Matter
 * game object of a static circle of PEG_RADIUS.
 *
 * Matter's Transform mixin scales the body relative to the image scale the body was created at (1/RENDER_SCALE
 * here), so the body is PEG_RADIUS × scale × RENDER_SCALE: exactly PEG_RADIUS at rest, and the flash pulse grows
 * it like the former arc did (×1.6 at the peak).
 */
export class Pegs {
  private readonly scene: Phaser.Scene;
  private readonly arcs: Phaser.GameObjects.Image[] = [];
  private tex?: ClayTex;
  private lit?: ClayTex;

  static isPeg(body: MatterJS.BodyType): boolean {
    return (body.parent ?? body).label === PEG_LABEL;
  }

  constructor(scene: Phaser.Scene, enabled: boolean) {
    this.scene = scene;
    if (!enabled) return;
    const tex = (this.tex = bakeShape(scene, 'peg')); // both pre-baked in Boot (bakeAll)
    this.lit = bakeShape(scene, 'peg', CLAY.pegFlash);
    for (const { x, y } of pegPositions()) {
      const arc = clayImage(scene, x, y, tex).setDepth(PEG_DEPTH);
      scene.matter.add.gameObject(arc, {
        isStatic: true,
        shape: { type: 'circle', radius: PEG_RADIUS },
        restitution: 0.9,
        label: PEG_LABEL,
      });
      // Setting the body re-centres the origin; the clay texture's body centre is off-centre (shadow padding).
      arc.setOrigin(tex.originX, tex.originY);
      this.arcs.push(arc);
    }
  }

  /** Brief scale pulse and a ~60 ms brighten on the peg that owns `body`. */
  flash(body: MatterJS.BodyType): void {
    const arc = (body.parent ?? body).gameObject as Phaser.GameObjects.Image | null | undefined;
    if (!arc || !this.arcs.includes(arc)) return;
    this.scene.tweens.killTweensOf(arc);
    arc.setScale(TEX_SCALE);
    this.scene.tweens.add({ targets: arc, scale: FLASH_SCALE * TEX_SCALE, duration: 70, yoyo: true });
    // A brighter clay peg (same size and origin, its own shadow), not a white fill over the shadow too.
    arc.setTexture(this.lit!.key);
    this.scene.time.delayedCall(BRIGHTEN_MS, () => arc.active && arc.setTexture(this.tex!.key));
  }

  destroy(): void {
    for (const arc of this.arcs) {
      this.scene.tweens.killTweensOf(arc);
      arc.destroy(); // also removes the Matter body
    }
    this.arcs.length = 0;
  }
}
