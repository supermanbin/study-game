import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { ALL_FACTS, factKey, koujue } from '../core/facts';
import { isCardLit } from '../core/progress';
import { createButton } from '../ui/Button';
import type { DebuggableScene, DebugState } from '../game/debug';
import { BG, getProgress, title } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';

export class CardsScene extends Phaser.Scene implements DebuggableScene {
  private lit = 0;

  constructor() {
    super('Cards');
  }

  create(): void {
    applyHiDpi(this);
    this.cameras.main.setBackgroundColor(BG);
    const p = getProgress(this);
    this.lit = ALL_FACTS.filter(f => isCardLit(p, factKey(f.a, f.b))).length;
    title(this, `口诀卡册    已点亮 ${this.lit} / 45`, 40, 40);

    const cw = 118;
    const ch = 54;
    const x0 = 640 - (cw * 9) / 2 + cw / 2;
    const y0 = 105;
    for (const f of ALL_FACTS) {
      const lit = isCardLit(p, factKey(f.a, f.b));
      const x = x0 + (f.b - 1) * cw;
      const y = y0 + (f.a - 1) * (ch + 4);
      const g = this.add.graphics();
      g.fillStyle(lit ? 0xffc107 : 0xe0e0e0, 1).fillRoundedRect(x - cw / 2 + 3, y - ch / 2, cw - 6, ch, 10);
      if (lit) g.lineStyle(3, 0xff8f00, 1).strokeRoundedRect(x - cw / 2 + 3, y - ch / 2, cw - 6, ch, 10);
      this.add
        .text(x, y, koujue(f), { fontFamily: FONT_FAMILY, fontSize: '20px', color: lit ? '#3e2723' : '#9e9e9e', fontStyle: lit ? 'bold' : 'normal' })
        .setOrigin(0.5);
    }
    createButton(this, 1130, 665, '返回', () => this.scene.start('Menu'), { width: 200, color: 0x757575 });
  }

  debugState(): Partial<DebugState> {
    return { litCards: this.lit };
  }
}
