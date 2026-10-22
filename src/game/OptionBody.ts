import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH } from '../config';
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

const COLORS = [0xff8a65, 0x4fc3f7, 0x81c784, 0xffd54f, 0xba68c8, 0x4db6ac, 0xf06292];
const GREY = 0xbdbdbd;
const BALL_DEPTH = 10;
const LABEL_DEPTH = 11;
/** Toss launch: thrown in from just inside the side walls. */
const TOSS_LEFT_X = 70;
const TOSS_RIGHT_X = GAME_WIDTH - 70;
const byBody = new WeakMap<MatterJS.BodyType, OptionBody>();
/** A support contact older than this no longer counts. */
const SUPPORT_WINDOW_MS = 100;

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
 * One answer ball: a Matter circle driving a rotating container (ball graphics with a stripe so the spin
 * shows). The label is a separate, never-rotating Text that follows the ball via `syncLabel()`.
 */
export class OptionBody {
  readonly questionSerial: number;
  readonly optionId: number;
  readonly label: string;
  readonly correct: boolean;
  readonly radius: number;
  state: OptionState = 'falling';
  /** Scene time of the last contact with the ground or a grey ball (set by GameScene). */
  lastSupportMs = -Infinity;
  /** Continuous resting time (supported and slow). */
  readonly rest = new RestTimer();
  /** Slow-but-unsupported detector (stuck on pegs). */
  readonly stuck = new StuckTimer();
  /** True once `launch` has put the ball into the world. */
  spawned = false;
  body: MatterJS.BodyType | null = null;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  /** Child of the container: pop-in scale and shake offset live here, so the body is never scaled. */
  private readonly face: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly color: number;
  private dropX: number;
  private launchIndex = 0;
  /** Horizontal shake offset in world space, applied to both the ball face and the label. */
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
    this.color = COLORS[spec.colorIndex % COLORS.length];

    this.bg = scene.add.graphics();
    this.face = scene.add.container(0, 0, [this.bg]);
    this.container = scene.add.container(spec.x, TOSS_Y, [this.face]).setVisible(false).setDepth(BALL_DEPTH);
    this.container.setSize(this.radius * 2, this.radius * 2);
    this.text = scene.add
      .text(spec.x, TOSS_Y, spec.label, {
        fontFamily: FONT_FAMILY,
        fontSize: expr ? '28px' : '40px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#00000055',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(LABEL_DEPTH)
      .setVisible(false);
    this.draw(this.color);
  }

  /** Creates the body at the toss/drop start, sets its launch velocity and spin, and pops the ball in. */
  launch(t: PhysicsTuning, index: number, x?: number): void {
    if (this.state === 'removed' || this.body) return;
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
    this.placeAtStart(t);
    this.container.setVisible(true);
    this.text.setVisible(true);
    this.syncLabel();
    this.face.setScale(0.2);
    this.text.setScale(0.2);
    this.scene.tweens.add({ targets: [this.face, this.text], scale: 1, duration: 220, ease: 'Back.Out' });
  }

  /** Moves the body back to its toss/drop start with a fresh launch velocity (e.g. after escaping). */
  respawn(t: PhysicsTuning): void {
    if (!this.body || this.state === 'removed') return;
    this.placeAtStart(t);
    this.rest.reset();
    this.syncLabel();
  }

  /** Recent contact with the ground or a grey ball. */
  supported(nowMs: number): boolean {
    return nowMs - this.lastSupportMs < SUPPORT_WINDOW_MS;
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

  /** Keeps the upright label on the ball (call every frame). */
  syncLabel(): void {
    if (!this.text.active) return;
    const c = this.container;
    this.text.setPosition(c.x + this.shakeX, c.y);
    // The face sits in the rotating container: express the world-x shake in its local frame.
    this.face.setPosition(this.shakeX * Math.cos(c.rotation), -this.shakeX * Math.sin(c.rotation));
  }

  get clickable(): boolean {
    return this.state === 'falling';
  }

  setGrey(): void {
    if (this.state === 'removed' || this.state === 'resolved') return;
    this.state = 'grey';
    this.draw(GREY);
    this.text.setColor('#757575');
  }

  shake(): void {
    if (this.state === 'removed') return;
    this.scene.tweens.add({
      targets: this,
      shakeX: { from: -10, to: 10 },
      duration: 50,
      yoyo: true,
      repeat: 3,
      onUpdate: () => this.syncLabel(),
      onComplete: () => {
        this.shakeX = 0;
        this.syncLabel();
      },
    });
  }

  /** Fades out over 300 ms, then destroys. Removed from physics immediately. */
  vanish(): void {
    if (this.state === 'removed') return;
    this.state = 'removed';
    // Pop-in (face, text) and shake (this) tweens must not fight the fade-out.
    this.scene.tweens.killTweensOf([this, this.face, this.text]);
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
    if (!this.container.visible) {
      this.container.destroy();
      this.text.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: [this.container, this.text],
      alpha: 0,
      scale: 1.25,
      duration: 300,
      onComplete: () => {
        this.container.destroy();
        this.text.destroy();
      },
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

  private draw(fill: number): void {
    const g = this.bg;
    const r = this.radius;
    g.clear();
    g.fillStyle(fill, 1).fillCircle(0, 0, r);
    // White stripe from the rim inward: shows the spin.
    g.fillStyle(0xffffff, 0.9).fillRect(-4, -r + 4, 8, 14);
    g.fillStyle(0xffffff, 0.35).fillCircle(-r * 0.32, -r * 0.35, r * 0.27);
    g.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, r - 2);
  }
}
