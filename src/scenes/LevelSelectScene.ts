import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { LEVELS } from '../core/levels';
import { createButton } from '../ui/Button';
import { BG, getProgress, title } from '../ui/theme';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG);
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
        color: lv.boss ? 0xe53935 : 0x43a047,
        subtitle: lv.name,
      });
      this.add
        .text(x, y + 48, '★'.repeat(stars) + '☆'.repeat(3 - stars), {
          fontFamily: FONT_FAMILY,
          fontSize: '30px',
          color: locked ? '#9e9e9e' : '#ffeb3b',
        })
        .setOrigin(0.5);
      if (locked) this.add.text(x + 130, y - 55, '🔒', { fontFamily: FONT_FAMILY, fontSize: '40px' }).setOrigin(0.5);
    });
    createButton(this, 640, 620, '返回', () => this.scene.start('Menu'), { width: 220, color: 0x757575 });
  }
}
