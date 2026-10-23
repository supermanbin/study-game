import Phaser from 'phaser';
import { LEVELS } from '../core/levels';
import { createButton } from '../ui/Button';
import { clayBackground, clayLock, clayStars } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { getProgress, title } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create(): void {
    applyHiDpi(this);
    clayBackground(this);
    const p = getProgress(this);
    title(this, '选择关卡', 60);
    LEVELS.forEach((lv, i) => {
      const x = 240 + (i % 3) * 400;
      const y = 200 + Math.floor(i / 3) * 190;
      const locked = lv.id > p.unlockedLevel;
      const stars = p.levels[lv.id]?.bestStars ?? 0;
      createButton(this, x, y, `第${lv.id}关`, () => this.scene.start('Game', { levelId: lv.id }), {
        width: 340,
        height: 150,
        fontSize: 40,
        disabled: locked,
        color: lv.boss ? BALL_COLORS[4] : i % 2 === 0 ? CLAY.primary : BALL_COLORS[1],
        subtitle: lv.name,
      });
      clayStars(this, x, y + 46, stars, 30);
      if (locked) clayLock(this, x + 130, y - 42, 38);
    });
    createButton(this, 640, 620, '返回', () => this.scene.start('Menu'), { width: 220, color: BALL_COLORS[5] });
  }
}
