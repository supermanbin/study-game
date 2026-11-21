import Phaser from 'phaser';
import { FONT_FAMILY, RENDER_SCALE } from '../config';
import { installDebug } from '../game/debug';
import { createButton, type ButtonOpts } from '../ui/Button';
import { getAudio, getLayout, getProgress, title } from '../ui/theme';
import { bakeBall, clayImage, css } from '../ui/clay';
import { clayBackground } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { NUMBER_RADIUS } from '../game/tuning';
import { applyHiDpi } from '../ui/hiDpi';
import { menuScreen } from '../layout/screens';

/** Menu buttons (exported for the Boot pre-bake). */
export const MENU_BUTTONS = {
  start: { width: 360, height: 88, fontSize: 44, color: CLAY.primary },
  cards: { width: 360, color: BALL_COLORS[1] },
  settings: { width: 360, color: BALL_COLORS[4] },
} as const satisfies Record<string, ButtonOpts>;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    applyHiDpi(this);
    clayBackground(this);
    getAudio(this).setMusic(getProgress(this).settings.music);
    const layout = getLayout(this);
    const cx = layout.width / 2;
    const m = menuScreen(layout);
    title(this, '九九乘法闯关', m.title.y, m.title.size);
    // Five decorative clay balls above the title, bobbing gently out of phase.
    BALL_COLORS.slice(0, 5).forEach((color, i) => {
      const tex = bakeBall(this, color, NUMBER_RADIUS);
      const ball = clayImage(this, cx + (i - 2) * m.balls.step, m.balls.y, tex).setScale(0.72 / RENDER_SCALE);
      this.tweens.add({ targets: ball, y: ball.y + 8, duration: 1300, delay: i * 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.add
      .text(cx, m.subtitle.y, '× 接住答案，点亮口诀卡 ×', { fontFamily: FONT_FAMILY, fontSize: `${m.subtitle.size}px`, color: css(CLAY.ink2) })
      .setOrigin(0.5);
    createButton(this, m.start.x, m.start.y, '开始游戏', () => this.scene.start('LevelSelect'), MENU_BUTTONS.start);
    createButton(this, m.cards.x, m.cards.y, '口诀卡册', () => this.scene.start('Cards'), MENU_BUTTONS.cards);
    createButton(this, m.settings.x, m.settings.y, '设置', () => this.scene.start('Settings'), MENU_BUTTONS.settings);
    // Installed here (idempotent), not in Boot: `__funyDebug` existing implies Boot has finished.
    installDebug(this.game);
  }
}
