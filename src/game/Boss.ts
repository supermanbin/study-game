import Phaser from 'phaser';
import { BOSS_HP } from '../core/levels';
import { bakeShape, clayImage, type ClayTex } from '../ui/clay';

const BOSS_DEPTH = 100;
/** HP segment step (design px), as before; the clay segment is 12×16 (SHAPE_SIZE.hpOn). */
const SEG_STEP = 16;
const SEG_W = 12;
const HURT_MS = 250;

export type BossMode = 'monster' | 'defeated' | 'chest';

/** Swaps a clay image's texture, keeping its origin on the shape (raised and inset textures pad differently). */
function setClay(img: Phaser.GameObjects.Image, tex: ClayTex): void {
  img.setTexture(tex.key).setOrigin(tex.originX, tex.originY);
}

/** Compact boss in the top-right of the question band: clay monster, 16-segment HP bar, then a treasure chest. */
export class Boss {
  mode: BossMode = 'monster';
  private readonly body: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Container;
  private readonly segs: Phaser.GameObjects.Image[];
  private hp = BOSS_HP;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
  ) {
    // Textures are pre-baked in Boot (bakeAll); these are cache lookups.
    this.art = clayImage(scene, 0, 0, bakeShape(scene, 'monster'));
    this.body = scene.add.container(x, y, [this.art]).setDepth(BOSS_DEPTH).setSize(60, 52);
    const total = BOSS_HP * SEG_STEP - (SEG_STEP - SEG_W);
    const left = x - 30 - total - 12;
    const on = bakeShape(scene, 'hpOn');
    this.segs = Array.from({ length: BOSS_HP }, (_, i) => clayImage(scene, left + i * SEG_STEP + SEG_W / 2, y + 14, on));
    this.bar = scene.add.container(0, 0, this.segs).setDepth(BOSS_DEPTH);
  }

  /** The container (squash target). */
  get target(): Phaser.GameObjects.Container {
    return this.body;
  }

  setHp(hp: number): void {
    this.hp = Phaser.Math.Clamp(hp, 0, BOSS_HP);
    const on = bakeShape(this.scene, 'hpOn');
    const off = bakeShape(this.scene, 'hpOff');
    this.segs.forEach((s, i) => setClay(s, i < this.hp ? on : off));
  }

  /** Hurt face for 250 ms, squash-and-rebound and a sideways wiggle. */
  hit(): void {
    if (this.mode !== 'monster') return;
    this.showMonster(true);
    this.scene.time.delayedCall(HURT_MS, () => this.mode === 'monster' && this.showMonster(false));
    this.scene.tweens.add({ targets: this.body, x: { from: this.x - 8, to: this.x + 8 }, duration: 40, yoyo: true, repeat: 3, onComplete: () => this.body.setX(this.x) });
    this.scene.tweens.add({ targets: this.body, scaleY: { from: 1, to: 0.75 }, scaleX: { from: 1, to: 1.2 }, duration: 90, yoyo: true });
  }

  defeat(): void {
    if (this.mode !== 'monster') return;
    this.mode = 'defeated';
    this.showMonster(true);
    this.scene.tweens.add({ targets: this.body, angle: 20, y: this.y + 10, alpha: 0.6, duration: 400 });
    this.scene.tweens.add({ targets: this.bar, alpha: 0, duration: 400 });
  }

  chestMode(): void {
    if (this.mode === 'chest') return;
    this.mode = 'chest';
    this.scene.tweens.killTweensOf(this.body);
    this.body.setAngle(0).setAlpha(1).setScale(1).setPosition(this.x, this.y);
    setClay(this.art, bakeShape(this.scene, 'chest'));
    this.scene.tweens.add({ targets: this.body, scale: { from: 0.4, to: 1 }, duration: 300, ease: 'Back.Out' });
  }

  private showMonster(hurt: boolean): void {
    setClay(this.art, bakeShape(this.scene, hurt ? 'monsterHurt' : 'monster'));
  }
}
