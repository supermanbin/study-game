import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH, RENDER_SCALE } from '../config';
import { bakeBall, bakeStripe, clayImage, labelStyleFor } from '../ui/clay';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { RestTimer, StuckTimer } from './motion';
import { clearOfPegsX } from './Pegs';
import type { PhysicsTuning } from './physicsTuning';
import {
  BALL_DENSITY,
  BALL_FRICTION,
  EXPR_RADIUS,
  HEAVY_DENSITY,
  NUMBER_RADIUS,
  QUESTION_AREA_BOTTOM,
  SPAWN_X_MAX,
  SPAWN_X_MIN,
  TOSS_Y,
} from './tuning';

/** `resolved`: the question was answered; the ball waits for its fade-out and is no longer clickable. */
export type OptionState = 'falling' | 'grey' | 'resolved' | 'removed';

/** Shell (non-rotating clay ball), stripe overlay (rotates with the body), upright label. */
const SHELL_DEPTH = 10;
const STRIPE_DEPTH = 10.5;
const LABEL_DEPTH = 11;
/** Clay images are baked at RENDER_SCALE and shown at 1/RENDER_SCALE. */
const TEX_SCALE = 1 / RENDER_SCALE;
/** Toss launch: thrown in from just inside the side walls. */
const TOSS_LEFT_X = 70;
const TOSS_RIGHT_X = GAME_WIDTH - 70;
const byBody = new WeakMap<MatterJS.BodyType, OptionBody>();
/** Grace window for direct ground contact only (contact flicker); propagated support gets none. */
const GROUND_GRACE_MS = 100;

export interface OptionSpec {
  questionSerial: number;
  optionId: number;
  label: string;
  correct: boolean;
  /** Drop-launch x (ignored by toss launches). */
  x: number;
  colorIndex: number;
}

/**
 * Visual scale shared by shell, stripe and label (pop-in, squash, fade-out). Tweens target this object, never
 * the physics container, so the body is never scaled; `syncVisuals()` applies it.
 */
class VisualScale {
  scaleX = 1;
  scaleY = 1;
  setScale(x: number, y = x): this {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }
}

/**
 * One answer ball, in two layers (spec §5): a non-rotating clay shell image (shadow, base, light from the upper
 * left) that follows the body, and the Matter container, which rotates with the body and holds only a short
 * white stripe so the spin shows. The label is a separate, never-rotating Text. `syncVisuals()` keeps shell and
 * label on the body. Hit testing uses the physics circle only.
 */
export class OptionBody {
  readonly questionSerial: number;
  readonly optionId: number;
  readonly label: string;
  readonly correct: boolean;
  readonly radius: number;
  state: OptionState = 'falling';
  /** Scene time of the last direct contact with the ground (set by GameScene). */
  lastGroundMs = -Infinity;
  /** Supported this frame: grounded, or chained to a grounded ball (set by GameScene each frame). */
  supported = false;
  /** Continuous resting time (supported and slow). */
  readonly rest = new RestTimer();
  /** Slow-but-unsupported detector (stuck on pegs). */
  readonly stuck = new StuckTimer();
  /** True once `launch` has put the ball into the world. */
  spawned = false;
  body: MatterJS.BodyType | null = null;

  private readonly scene: Phaser.Scene;
  /** Matter game object: rotates with the body; holds only the stripe. Never scaled. */
  private readonly container: Phaser.GameObjects.Container;
  private readonly stripe: Phaser.GameObjects.Image;
  private readonly shell: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private readonly look = new VisualScale();
  private readonly color: number;
  private dropX: number;
  private launchIndex = 0;
  private launchedMs = 0;
  private squashedMs = -Infinity;
  /** Horizontal shake offset in world space, applied to shell, stripe and label. */
  private shakeX = 0;

  static fromBody(body: MatterJS.BodyType): OptionBody | undefined {
    return byBody.get(body.parent ?? body);
  }

  constructor(scene: Phaser.Scene, spec: OptionSpec) {
    this.scene = scene;
    this.questionSerial = spec.questionSerial;
    this.optionId = spec.optionId;
    this.label = spec.label;
    this.correct = spec.correct;
    this.dropX = spec.x;
    const expr = spec.label.includes('×');
    this.radius = expr ? EXPR_RADIUS : NUMBER_RADIUS;
    this.color = BALL_COLORS[spec.colorIndex % BALL_COLORS.length];

    // Pre-baked in Boot (bakeAll): these only look up cached textures.
    this.shell = clayImage(scene, spec.x, TOSS_Y, bakeBall(scene, this.color, this.radius)).setDepth(SHELL_DEPTH).setVisible(false);
    this.stripe = clayImage(scene, 0, 0, bakeStripe(scene, this.radius));
    this.container = scene.add.container(spec.x, TOSS_Y, [this.stripe]).setVisible(false).setDepth(STRIPE_DEPTH);
    this.container.setSize(this.radius * 2, this.radius * 2);
    this.text = scene.add
      .text(spec.x, TOSS_Y, spec.label, {
        fontFamily: FONT_FAMILY,
        fontSize: expr ? '28px' : '40px',
        fontStyle: 'bold',
        ...labelStyleFor(this.color),
        shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,.18)', blur: 2, fill: true, stroke: true },
      })
      .setOrigin(0.5)
      .setDepth(LABEL_DEPTH)
      .setVisible(false);
  }

  /** Creates the body at the toss/drop start, sets its launch velocity and spin, and pops the ball in. */
  launch(t: PhysicsTuning, index: number, x?: number): void {
    if (this.state === 'removed' || this.state === 'resolved' || this.body) return;
    this.launchIndex = index;
    if (x !== undefined) this.dropX = x;
    this.scene.matter.add.gameObject(this.container, {
      shape: { type: 'circle', radius: this.radius },
      restitution: t.bounce,
      frictionAir: t.air,
      friction: BALL_FRICTION,
      density: BALL_DENSITY,
    });
    const body = (this.container as unknown as { body: MatterJS.BodyType }).body;
    byBody.set(body, this);
    this.body = body;
    this.spawned = true;
    this.launchedMs = this.scene.time.now;
    this.placeAtStart(t);
    this.container.setVisible(true);
    this.shell.setVisible(true);
    this.text.setVisible(true);
    this.look.setScale(0.2);
    this.syncVisuals();
    this.scene.tweens.add({
      targets: this.look,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Back.Out',
      onUpdate: () => this.syncVisuals(),
    });
  }

  /** Moves the body back to its toss/drop start with a fresh launch velocity (e.g. after escaping). */
  respawn(t: PhysicsTuning): void {
    if (!this.body || this.state === 'removed') return;
    this.placeAtStart(t);
    this.rest.reset();
    this.syncVisuals();
  }

  /** Recent direct contact with the ground. */
  grounded(nowMs: number): boolean {
    return nowMs - this.lastGroundMs < GROUND_GRACE_MS;
  }

  /** Small sideways push for a ball stuck on the pegs. */
  nudge(): void {
    if (this.body) this.scene.matter.body.setVelocity(this.body, { x: Math.random() < 0.5 ? -2 : 2, y: -1 });
  }

  /** Wrong/missed balls get heavier and sink into the pile. */
  heavy(): void {
    if (this.body) this.scene.matter.body.setDensity(this.body, HEAVY_DENSITY);
  }

  speed(): number {
    return this.body ? this.body.speed : 0;
  }

  /**
   * The visual scale (shell, stripe and label together) to squash on a hard hit; never the physics container,
   * since scaling that would scale the body. Null while the pop-in tween runs, during a previous squash, or when
   * removed.
   */
  squashTarget(nowMs: number): VisualScale | null {
    if (this.state === 'removed' || !this.body) return null;
    if (nowMs - this.launchedMs < 300 || nowMs - this.squashedMs < 150) return null;
    this.squashedMs = nowMs;
    return this.look;
  }

  /** Keeps shell and upright label on the body and applies shake and visual scale (call every frame). */
  syncVisuals(): void {
    if (!this.text.active) return;
    const c = this.container;
    const { scaleX: sx, scaleY: sy } = this.look;
    this.shell.setPosition(c.x + this.shakeX, c.y).setScale(sx * TEX_SCALE, sy * TEX_SCALE);
    this.text.setPosition(c.x + this.shakeX, c.y).setScale(sx, sy);
    // The stripe sits in the rotating container: express the world-x shake in its local frame.
    this.stripe
      .setPosition(this.shakeX * Math.cos(c.rotation), -this.shakeX * Math.sin(c.rotation))
      .setScale(sx * TEX_SCALE, sy * TEX_SCALE);
  }

  /** Debug/e2e: body radius, shell geometry and the two layers' angles. */
  debugInfo(): { radius: number; shellW: number; shellOriginX: number; shellX: number; shellY: number; x: number; y: number; shellAngle: number; stripeAngle: number } {
    return {
      radius: this.body?.circleRadius ?? this.radius,
      shellW: this.shell.displayWidth,
      shellOriginX: this.shell.originX,
      shellX: this.shell.x,
      shellY: this.shell.y,
      x: this.body?.position.x ?? this.container.x,
      y: this.body?.position.y ?? this.container.y,
      shellAngle: this.shell.angle,
      stripeAngle: this.container.angle,
    };
  }

  get clickable(): boolean {
    return this.state === 'falling';
  }

  setGrey(): void {
    if (this.state === 'removed' || this.state === 'resolved') return;
    this.state = 'grey';
    this.shell.setTexture(bakeBall(this.scene, CLAY.faded, this.radius, true).key);
    this.stripe.setAlpha(0.5);
    const faded = labelStyleFor(CLAY.faded);
    this.text.setColor(faded.color).setStroke(faded.stroke, faded.strokeThickness).setShadow(0, 0, 'rgba(0,0,0,0)', 0);
  }

  shake(): void {
    if (this.state === 'removed') return;
    this.scene.tweens.add({
      targets: this,
      shakeX: { from: -10, to: 10 },
      duration: 50,
      yoyo: true,
      repeat: 3,
      onUpdate: () => this.syncVisuals(),
      onComplete: () => {
        this.shakeX = 0;
        this.syncVisuals();
      },
    });
  }

  /** Fades out over 300 ms, then destroys. Removed from physics immediately. */
  vanish(): void {
    if (this.state === 'removed') return;
    this.state = 'removed';
    // Pop-in / squash (look) and shake (this) tweens must not fight the fade-out.
    this.scene.tweens.killTweensOf([this, this.look]);
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
    const destroy = () => {
      this.shell.destroy();
      this.container.destroy();
      this.text.destroy();
    };
    if (!this.container.visible) {
      destroy();
      return;
    }
    this.scene.tweens.add({ targets: [this.shell, this.container, this.text], alpha: 0, duration: 300 });
    this.scene.tweens.add({
      targets: this.look,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 300,
      onUpdate: () => this.syncVisuals(),
      onComplete: destroy,
    });
  }

  /** Top edge of the body in world space, or null when not in the world. */
  topY(): number | null {
    return this.body ? this.body.bounds.min.y : null;
  }

  contains(x: number, y: number): boolean {
    if (!this.body) return false;
    return this.scene.matter.intersectPoint(x, y, [this.body]).length > 0;
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }

  private placeAtStart(t: PhysicsTuning): void {
    const body = this.body!;
    const m = this.scene.matter;
    // The body must start fully below the ceiling (bottom edge at QUESTION_AREA_BOTTOM).
    const minY = QUESTION_AREA_BOTTOM + this.radius + 2;
    let x: number, y: number, vx: number, vy: number;
    if (t.launch === 'toss') {
      const left = this.launchIndex % 2 === 0;
      y = Math.max(TOSS_Y, minY);
      x = clearOfPegsX(left ? TOSS_LEFT_X : TOSS_RIGHT_X, y, this.radius, this.radius, GAME_WIDTH - this.radius);
      vx = (left ? 1 : -1) * Phaser.Math.FloatBetween(5, 11);
      vy = Phaser.Math.FloatBetween(-7, -2);
    } else {
      y = minY;
      // Keep the ball horizontally clear of the top peg row so it never spawns overlapping a peg.
      x = clearOfPegsX(this.dropX, y, this.radius, SPAWN_X_MIN, SPAWN_X_MAX);
      vx = Phaser.Math.FloatBetween(-2, 2);
      vy = 0;
    }
    m.body.setPosition(body, { x, y }, false);
    m.body.setVelocity(body, { x: vx, y: vy });
    m.body.setAngularVelocity(body, Phaser.Math.FloatBetween(-0.15, 0.15));
    this.container.setPosition(x, y);
  }
}
