import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { ALL_FACTS, factKey, koujue } from '../core/facts';
import { isCardLit } from '../core/progress';
import { createButton, type ButtonOpts } from '../ui/Button';
import type { DebuggableScene, DebugState } from '../game/debug';
import type { Fact } from '../core/types';
import { clayBackground } from '../ui/claywidgets';
import { bakeRoundRect, clayImage, labelStyleFor, type ClayTex } from '../ui/clay';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { getProgress, title } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';

/** Card size (design px) and corner radius; cell width adds the gap. */
const CARD = { w: 112, h: 54, r: 16, cellW: 118 };
export const CARDS_BACK: ButtonOpts = { width: 200, color: BALL_COLORS[5] };

export const cardColor = (f: Fact): number => BALL_COLORS[(f.a + f.b) % BALL_COLORS.length];

/** A card's texture: raised in its colour when lit, inset faded clay when not (Boot pre-bakes both per fact). */
export const bakeCard = (scene: Phaser.Scene, f: Fact, lit: boolean): ClayTex =>
  lit ? bakeRoundRect(scene, CARD.w, CARD.h, CARD.r, cardColor(f)) : bakeRoundRect(scene, CARD.w, CARD.h, CARD.r, CLAY.faded, true);

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

    const cw = CARD.cellW;
    const ch = CARD.h;
    const x0 = 640 - (cw * 9) / 2 + cw / 2;
    const y0 = 105;
    for (const f of ALL_FACTS) {
      const lit = isCardLit(p, factKey(f.a, f.b));
      const x = x0 + (f.b - 1) * cw;
      const y = y0 + (f.a - 1) * (ch + 4);
      clayImage(this, x, y, bakeCard(this, f, lit));
      // Unlit: faded ink darkened to ≥ 3:1 on the faded card (labelStyleFor), as on grey balls.
      const style = lit ? { ...labelStyleFor(cardColor(f)), strokeThickness: 3 } : { color: labelStyleFor(CLAY.faded).color };
      this.add.text(x, y, koujue(f), { fontFamily: FONT_FAMILY, fontSize: '20px', fontStyle: 'bold', ...style }).setOrigin(0.5);
    }
    createButton(this, 1130, 665, '返回', () => this.scene.start('Menu'), CARDS_BACK);
  }

  debugState(): Partial<DebugState> {
    return { litCards: this.lit };
  }
}
