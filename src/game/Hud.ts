import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ItemKind } from '../core/session';
import { GROUND_Y, QUESTION_AREA_BOTTOM, WARNING_LINE_Y } from './tuning';

const HUD_DEPTH = 100;

/** Prompt, score/combo, countdown, item buttons, warning line, pause overlay. */
export class Hud {
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly reveal: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly combo: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly itemButtons: Record<ItemKind, Phaser.GameObjects.Text>;
  private readonly overlay: Phaser.GameObjects.Container;
  private revealTimer?: Phaser.Time.TimerEvent;
  private lastSecond = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    onItem: (kind: ItemKind) => void,
  ) {
    const font = { fontFamily: FONT_FAMILY };
    // The question band sits above the options so newly spawned ones emerge from under it.
    scene.add.graphics().setDepth(50).fillStyle(0xfff3c4, 1).fillRect(0, 0, GAME_WIDTH, QUESTION_AREA_BOTTOM);
    const g = scene.add.graphics().setDepth(1);
    g.fillStyle(0x8d6e63, 1).fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    g.lineStyle(4, 0xe53935, 0.7);
    for (let x = 0; x < GAME_WIDTH; x += 36) g.lineBetween(x, WARNING_LINE_Y, x + 20, WARNING_LINE_Y);

    this.prompt = scene.add
      .text(GAME_WIDTH / 2, 52, '', { ...font, fontSize: '64px', fontStyle: 'bold', color: '#3e2723' })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.reveal = scene.add
      .text(GAME_WIDTH / 2, 112, '', { ...font, fontSize: '32px', color: '#2e7d32' })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.score = scene.add.text(24, 18, '', { ...font, fontSize: '32px', color: '#5d4037' }).setDepth(HUD_DEPTH);
    this.combo = scene.add.text(24, 62, '', { ...font, fontSize: '28px', color: '#ef6c00' }).setDepth(HUD_DEPTH);
    this.timer = scene.add
      .text(GAME_WIDTH - 24, 18, '', { ...font, fontSize: '40px', fontStyle: 'bold', color: '#5d4037' })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);

    const mkButton = (kind: ItemKind, x: number) =>
      scene.add
        .text(x, GROUND_Y - 8, '', {
          ...font,
          fontSize: '26px',
          color: '#ffffff',
          backgroundColor: '#5c6bc0',
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0, 1)
        .setDepth(HUD_DEPTH)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => onItem(kind));
    this.itemButtons = { freeze: mkButton('freeze', 16), magnifier: mkButton('magnifier', 176) };

    const shade = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45);
    const label = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '暂停中 · 按空格继续', { ...font, fontSize: '56px', color: '#ffffff' })
      .setOrigin(0.5);
    this.overlay = scene.add.container(0, 0, [shade, label]).setDepth(HUD_DEPTH + 10).setVisible(false);
  }

  isItemButton(obj: Phaser.GameObjects.GameObject): boolean {
    return obj === this.itemButtons.freeze || obj === this.itemButtons.magnifier;
  }

  setPrompt(text: string): void {
    this.prompt.setText(text);
  }

  showAnswer(text: string, ms: number): void {
    this.revealTimer?.remove();
    this.reveal.setText(text);
    this.revealTimer = this.scene.time.delayedCall(ms, () => this.reveal.setText(''));
  }

  setScore(score: number, combo: number): void {
    this.score.setText(`得分 ${score}`);
    this.combo.setText(combo >= 2 ? `连对 ×${combo}` : '');
  }

  /** Updates the countdown; returns true when a new whole second below 10 s was entered (tick sound). */
  setTime(ms: number): boolean {
    const sec = Math.ceil(ms / 1000);
    if (sec === this.lastSecond) return false;
    const first = this.lastSecond === -1;
    this.lastSecond = sec;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    this.timer.setText(`时间 ${m}:${String(s).padStart(2, '0')}`);
    this.timer.setColor(sec < 10 ? '#e53935' : '#5d4037');
    return !first && sec < 10;
  }

  setItems(items: Record<ItemKind, number>): void {
    this.itemButtons.freeze.setText(`1 冰冻 ×${items.freeze}`).setAlpha(items.freeze > 0 ? 1 : 0.5);
    this.itemButtons.magnifier.setText(`2 放大镜 ×${items.magnifier}`).setAlpha(items.magnifier > 0 ? 1 : 0.5);
  }

  setPaused(paused: boolean): void {
    this.overlay.setVisible(paused);
  }
}
