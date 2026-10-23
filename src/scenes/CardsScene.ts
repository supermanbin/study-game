import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { ALL_FACTS, factKey, koujue } from '../core/facts';
import { isCardLit } from '../core/progress';
import { createButton } from '../ui/Button';
import type { DebuggableScene, DebugState } from '../game/debug';
import { clayBackground } from '../ui/claywidgets';
import { bakeRoundRect, clayImage, css, labelStyleFor } from '../ui/clay';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { getProgress, title } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';

export class CardsScene extends Phaser.Scene implements DebuggableScene {
  private lit = 0;

  constructor() {
    super('Cards');
  }

  create(): void {
    applyHiDpi(this);
    clayBackground(this);
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
      const color = BALL_COLORS[(f.a + f.b) % BALL_COLORS.length];
      clayImage(this, x, y, lit ? bakeRoundRect(this, 112, ch, 16, color) : bakeRoundRect(this, 112, ch, 16, CLAY.faded, true));
      const style = lit ? { ...labelStyleFor(color), strokeThickness: 3 } : { color: css(CLAY.fadedText) };
      this.add.text(x, y, koujue(f), { fontFamily: FONT_FAMILY, fontSize: '20px', fontStyle: 'bold', ...style }).setOrigin(0.5);
    }
    createButton(this, 1130, 665, '返回', () => this.scene.start('Menu'), { width: 200, color: BALL_COLORS[5] });
  }

  debugState(): Partial<DebugState> {
    return { litCards: this.lit };
  }
}
