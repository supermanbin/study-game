import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH, RENDER_SCALE } from '../config';
import { installDebug } from '../game/debug';
import { createButton } from '../ui/Button';
import { getAudio, getProgress, title } from '../ui/theme';
import { bakeBall, clayImage, css } from '../ui/clay';
import { clayBackground } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { NUMBER_RADIUS } from '../game/tuning';
import { applyHiDpi } from '../ui/hiDpi';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    applyHiDpi(this);
    clayBackground(this);
    getAudio(this).setMusic(getProgress(this).settings.music);
    const cx = GAME_WIDTH / 2;
    title(this, '九九乘法闯关', 170, 96);
    // Five decorative clay balls above the title, bobbing gently out of phase.
    BALL_COLORS.slice(0, 5).forEach((color, i) => {
      const tex = bakeBall(this, color, NUMBER_RADIUS);
      const ball = clayImage(this, cx + (i - 2) * 130, 62, tex).setScale(0.72 / RENDER_SCALE);
      this.tweens.add({ targets: ball, y: ball.y + 8, duration: 1300, delay: i * 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.add
      .text(cx, 255, '× 接住答案，点亮口诀卡 ×', { fontFamily: FONT_FAMILY, fontSize: '30px', color: css(CLAY.ink2) })
      .setOrigin(0.5);
    createButton(this, cx, 380, '开始游戏', () => this.scene.start('LevelSelect'), { width: 360, height: 88, fontSize: 44, color: CLAY.primary });
    createButton(this, cx, 495, '口诀卡册', () => this.scene.start('Cards'), { width: 360, color: BALL_COLORS[1] });
    createButton(this, cx, 595, '设置', () => this.scene.start('Settings'), { width: 360, color: BALL_COLORS[4] });
    // Installed here (idempotent), not in Boot: `__funyDebug` existing implies Boot has finished.
    installDebug(this.game);
  }
}
