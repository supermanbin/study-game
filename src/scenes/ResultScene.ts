import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH } from '../config';
import type { LevelResult } from '../core/session';
import type { DebuggableScene, DebugState } from '../game/debug';

/** Minimal result screen; Task 11 replaces the body. */
export class ResultScene extends Phaser.Scene implements DebuggableScene {
  private result!: LevelResult;

  constructor() {
    super('Result');
  }

  init(data: { result: LevelResult }): void {
    this.result = data.result;
  }

  create(): void {
    const r = this.result;
    const cx = GAME_WIDTH / 2;
    const font = { fontFamily: FONT_FAMILY, color: '#3e2723' };
    this.cameras.main.setBackgroundColor('#fdf6e3');
    this.add.text(cx, 140, r.passed ? '过关啦！' : '未过关，再试一次吧', { ...font, fontSize: '64px' }).setOrigin(0.5);
    this.add.text(cx, 250, '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), { ...font, fontSize: '72px', color: '#f9a825' }).setOrigin(0.5);
    this.add.text(cx, 350, `答对 ${r.correctCount} / 20`, { ...font, fontSize: '40px' }).setOrigin(0.5);
    this.add.text(cx, 410, `总分 ${r.totalScore}`, { ...font, fontSize: '40px' }).setOrigin(0.5);
    this.add
      .text(cx, 530, '再玩一次', { ...font, fontSize: '44px', color: '#ffffff', backgroundColor: '#43a047', padding: { x: 28, y: 12 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Game', { levelId: r.levelId }));
  }

  debugState(): Partial<DebugState> {
    return { stars: this.result?.stars };
  }
}
