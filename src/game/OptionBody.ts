import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { FRICTION, FRICTION_AIR, NUMBER_RADIUS, PILL_H, PILL_W, RESTITUTION, SPAWN_Y } from './tuning';

export type OptionState = 'falling' | 'landed' | 'grey' | 'removed';

const COLORS = [0xff8a65, 0x4fc3f7, 0x81c784, 0xffd54f, 0xba68c8, 0x4db6ac, 0xf06292];
const GREY = 0xbdbdbd;
const byBody = new WeakMap<MatterJS.BodyType, OptionBody>();

export interface OptionSpec {
  questionSerial: number;
  optionId: number;
  label: string;
  correct: boolean;
  x: number;
  colorIndex: number;
}

/** One falling answer: a Matter body driving a container (circle for numbers, pill for `a × b`). */
export class OptionBody {
  readonly questionSerial: number;
  readonly optionId: number;
  readonly label: string;
  readonly correct: boolean;
  state: OptionState = 'falling';
  /** Touched the ground or another pile body. */
  onPile = false;
  body: MatterJS.BodyType | null = null;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly pill: boolean;
  private readonly color: number;

  static fromBody(body: MatterJS.BodyType): OptionBody | undefined {
    return byBody.get(body.parent ?? body);
  }

  constructor(scene: Phaser.Scene, spec: OptionSpec) {
    this.scene = scene;
    this.questionSerial = spec.questionSerial;
    this.optionId = spec.optionId;
    this.label = spec.label;
    this.correct = spec.correct;
    this.pill = spec.label.includes('×');
    this.color = COLORS[spec.colorIndex % COLORS.length];

    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, spec.label, {
        fontFamily: FONT_FAMILY,
        fontSize: this.pill ? '34px' : '40px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#00000055',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.face = scene.add.container(0, 0, [this.bg, this.text]);
    this.container = scene.add.container(spec.x, SPAWN_Y, [this.face]).setVisible(false).setDepth(10);
    const [w, h] = this.pill ? [PILL_W, PILL_H] : [NUMBER_RADIUS * 2, NUMBER_RADIUS * 2];
    this.container.setSize(w, h);
    this.draw(this.color);
  }

  /** Adds the physics body and starts falling. */
  drop(): void {
    if (this.state === 'removed' || this.body) return;
    const shape = this.pill
      ? { type: 'rectangle', width: PILL_W, height: PILL_H, chamfer: { radius: PILL_H / 2 } }
      : { type: 'circle', radius: NUMBER_RADIUS };
    this.scene.matter.add.gameObject(this.container, {
      shape,
      restitution: RESTITUTION,
      frictionAir: FRICTION_AIR,
      friction: FRICTION,
    });
    const body = (this.container as unknown as { body: MatterJS.BodyType }).body;
    // No spin: labels stay upright and readable.
    this.scene.matter.body.setInertia(body, Infinity);
    byBody.set(body, this);
    this.body = body;
    this.container.setVisible(true);
  }

  get clickable(): boolean {
    return this.state === 'falling' || this.state === 'landed';
  }

  setGrey(): void {
    if (this.state === 'removed') return;
    this.state = 'grey';
    this.draw(GREY);
    this.text.setColor('#757575');
  }

  shake(): void {
    if (this.state === 'removed') return;
    this.scene.tweens.add({ targets: this.face, x: { from: -10, to: 10 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.face.setX(0) });
  }

  /** Fades out over 300 ms, then destroys. Removed from physics immediately. */
  vanish(): void {
    if (this.state === 'removed') return;
    this.state = 'removed';
    this.onPile = false;
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
    if (!this.container.visible) {
      this.container.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 1.25,
      duration: 300,
      onComplete: () => this.container.destroy(),
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

  private draw(fill: number): void {
    const g = this.bg;
    g.clear();
    g.fillStyle(fill, 1);
    g.lineStyle(4, 0xffffff, 0.9);
    if (this.pill) {
      g.fillRoundedRect(-PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_H / 2);
      g.strokeRoundedRect(-PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_H / 2);
    } else {
      g.fillCircle(0, 0, NUMBER_RADIUS);
      g.strokeCircle(0, 0, NUMBER_RADIUS);
    }
  }
}
