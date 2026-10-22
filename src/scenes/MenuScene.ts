import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH } from '../config';
import { installDebug } from '../game/debug';
import { createButton } from '../ui/Button';
import { BG, getAudio, getProgress, title } from '../ui/theme';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG);
    getAudio(this).setMusic(getProgress(this).settings.music);
    const cx = GAME_WIDTH / 2;
    title(this, '九九乘法闯关', 170, 96);
    this.add
      .text(cx, 255, '× 接住答案，点亮口诀卡 ×', { fontFamily: FONT_FAMILY, fontSize: '30px', color: '#8d6e63' })
      .setOrigin(0.5);
    createButton(this, cx, 380, '开始游戏', () => this.scene.start('LevelSelect'), { width: 360, height: 88, fontSize: 44, color: 0xfb8c00 });
    createButton(this, cx, 495, '口诀卡册', () => this.scene.start('Cards'), { width: 360, color: 0x1e88e5 });
    createButton(this, cx, 595, '设置', () => this.scene.start('Settings'), { width: 360, color: 0x8e24aa });
    // Installed here (idempotent), not in Boot: `__funyDebug` existing implies Boot has finished.
    installDebug(this.game);
  }
}
