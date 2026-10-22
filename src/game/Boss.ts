import Phaser from 'phaser';
import { BOSS_HP } from '../core/levels';

const BOSS_DEPTH = 100;
const SEG_W = 14;
const SEG_GAP = 2;

export type BossMode = 'monster' | 'defeated' | 'chest';

/** Compact boss in the top-right of the question band: cute monster, 16-segment HP bar, then a treasure chest. */
export class Boss {
  mode: BossMode = 'monster';
  private readonly body: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private hp = BOSS_HP;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
  ) {
    this.art = scene.add.graphics();
    this.body = scene.add.container(x, y, [this.art]).setDepth(BOSS_DEPTH).setSize(60, 52);
    this.bar = scene.add.graphics().setDepth(BOSS_DEPTH);
    this.drawMonster(false);
    this.drawBar();
  }

  /** The container, for flashes. */
  get target(): Phaser.GameObjects.Container {
    return this.body;
  }

  setHp(hp: number): void {
    this.hp = Phaser.Math.Clamp(hp, 0, BOSS_HP);
    this.drawBar();
  }

  hit(): void {
    if (this.mode !== 'monster') return;
    this.drawMonster(true);
    this.scene.time.delayedCall(250, () => this.mode === 'monster' && this.drawMonster(false));
    this.scene.tweens.add({ targets: this.body, x: { from: this.x - 8, to: this.x + 8 }, duration: 40, yoyo: true, repeat: 3, onComplete: () => this.body.setX(this.x) });
    this.scene.tweens.add({ targets: this.body, scaleY: 0.8, scaleX: 1.15, duration: 80, yoyo: true });
  }

  defeat(): void {
    if (this.mode !== 'monster') return;
    this.mode = 'defeated';
    this.drawMonster(true);
    this.scene.tweens.add({ targets: this.body, angle: 20, y: this.y + 10, alpha: 0.6, duration: 400 });
    this.scene.tweens.add({ targets: this.bar, alpha: 0, duration: 400 });
  }

  chestMode(): void {
    if (this.mode === 'chest') return;
    this.mode = 'chest';
    this.scene.tweens.killTweensOf(this.body);
    this.body.setAngle(0).setAlpha(1).setScale(1).setPosition(this.x, this.y);
    this.drawChest();
    this.scene.tweens.add({ targets: this.body, scale: { from: 0.4, to: 1 }, duration: 300, ease: 'Back.Out' });
  }

  private drawMonster(hurt: boolean): void {
    const g = this.art.clear();
    g.fillStyle(0x7e57c2, 1).fillEllipse(0, 4, 56, 48);
    g.fillStyle(0xb39ddb, 1).fillTriangle(-22, -16, -14, -30, -6, -18).fillTriangle(22, -16, 14, -30, 6, -18);
    g.fillStyle(0xffffff, 1).fillCircle(-11, -2, 8).fillCircle(11, -2, 8);
    g.fillStyle(0x311b92, 1);
    if (hurt) {
      g.lineStyle(3, 0x311b92, 1).lineBetween(-15, -6, -7, 2).lineBetween(-7, -6, -15, 2).lineBetween(7, -6, 15, 2).lineBetween(15, -6, 7, 2);
      g.fillEllipse(0, 16, 14, 8);
    } else {
      g.fillCircle(-11, -1, 4).fillCircle(11, -1, 4);
      g.fillRect(-8, 13, 16, 4);
      g.fillStyle(0xffffff, 1).fillTriangle(-6, 13, -2, 13, -4, 18).fillTriangle(2, 13, 6, 13, 4, 18);
    }
  }

  private drawChest(): void {
    const g = this.art.clear();
    g.fillStyle(0x8d6e63, 1).fillRoundedRect(-28, -4, 56, 30, 4);
    g.fillStyle(0xa1887f, 1).fillRoundedRect(-28, -22, 56, 20, { tl: 14, tr: 14, bl: 0, br: 0 });
    g.fillStyle(0xffca28, 1).fillRect(-28, -4, 56, 4).fillRect(-5, -6, 10, 14);
    g.fillStyle(0xfff59d, 1).fillCircle(-18, -26, 3).fillCircle(16, -28, 2);
  }

  private drawBar(): void {
    const g = this.bar.clear();
    const total = BOSS_HP * (SEG_W + SEG_GAP) - SEG_GAP;
    const left = this.x - 30 - total - 12;
    const top = this.y + 8;
    for (let i = 0; i < BOSS_HP; i++) {
      g.fillStyle(i < this.hp ? 0xe53935 : 0xd7ccc8, 1).fillRoundedRect(left + i * (SEG_W + SEG_GAP), top, SEG_W, 12, 3);
    }
  }
}
