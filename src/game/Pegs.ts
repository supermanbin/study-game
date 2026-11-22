import type Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import type { FieldLayout } from '../layout/game';
import { pegPositions } from '../layout/pegs';
import { bakeShape, clayImage, type ClayTex } from '../ui/clay';
import { CLAY } from '../ui/palette';
import { PEG_RADIUS } from './tuning';

const PEG_LABEL = 'peg';
const PEG_DEPTH = 9;
/** Clay images are baked at RENDER_SCALE and shown at 1/RENDER_SCALE. */
const TEX_SCALE = 1 / RENDER_SCALE;
const FLASH_SCALE = 1.6;
const BRIGHTEN_MS = 60;

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

  constructor(scene: Phaser.Scene, enabled: boolean, field: FieldLayout) {
    this.scene = scene;
    if (!enabled) return;
    const tex = (this.tex = bakeShape(scene, 'peg')); // both pre-baked in Boot (bakeAll)
    this.lit = bakeShape(scene, 'peg', CLAY.pegFlash);
    for (const { x, y } of pegPositions(field)) {
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
