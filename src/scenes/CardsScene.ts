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
import { getLayout, getProgress, title } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';
import { cardGrid, cardsScreen } from '../layout/screens';
import { startScene } from '../layout/apply';

/** Card corner radius (the size comes from cardGrid). */
const CARD_R = 16;
export const CARDS_BACK: ButtonOpts = { width: 200, color: BALL_COLORS[5] };
/** Portrait page tabs (1～5, 6～9). */
export const CARD_TAB_ACTIVE: ButtonOpts = { width: 180, height: 64, fontSize: 32, color: CLAY.primary };
export const CARD_TAB_IDLE: ButtonOpts = { ...CARD_TAB_ACTIVE, color: BALL_COLORS[5] };
const TAB_LABELS = ['1～5', '6～9'] as const;

export const cardColor = (f: Fact): number => BALL_COLORS[(f.a + f.b) % BALL_COLORS.length];

/** A card's texture: raised in its colour when lit, inset faded clay when not (Boot pre-bakes both per fact). */
export const bakeCard = (scene: Phaser.Scene, f: Fact, lit: boolean, w: number, h: number): ClayTex =>
  lit ? bakeRoundRect(scene, w, h, CARD_R, cardColor(f)) : bakeRoundRect(scene, w, h, CARD_R, CLAY.faded, true);

export class CardsScene extends Phaser.Scene implements DebuggableScene {
  private lit = 0;
  private page: 0 | 1 = 0;
  private shown = 0;

  constructor() {
    super('Cards');
  }

  init(data: { page?: 0 | 1 }): void {
    this.page = data?.page === 1 ? 1 : 0;
  }

  create(): void {
    applyHiDpi(this);
    const L = getLayout(this);
    const scr = cardsScreen(L);
    const grid = cardGrid(L, this.page);
    clayBackground(this);
    const p = getProgress(this);
    this.lit = ALL_FACTS.filter(f => isCardLit(p, factKey(f.a, f.b))).length;
    title(this, `口诀卡册    已点亮 ${this.lit} / 45`, scr.title.y, scr.title.size);
    scr.tabs.forEach((t, i) => {
      createButton(this, t.x, t.y, TAB_LABELS[i], () => this.scene.restart({ page: i as 0 | 1 }), i === this.page ? CARD_TAB_ACTIVE : CARD_TAB_IDLE);
    });

    for (const { fact: f, x, y, w, h } of grid.cards) {
      const lit = isCardLit(p, factKey(f.a, f.b));
      clayImage(this, x, y, bakeCard(this, f, lit, w, h));
      // Unlit: faded ink darkened to ≥ 3:1 on the faded card (labelStyleFor), as on grey balls.
      const style = lit ? { ...labelStyleFor(cardColor(f)), strokeThickness: 3 } : { color: labelStyleFor(CLAY.faded).color };
      this.add.text(x, y, koujue(f), { fontFamily: FONT_FAMILY, fontSize: `${grid.fontSize}px`, fontStyle: 'bold', ...style }).setOrigin(0.5);
    }
    this.shown = grid.cards.length;
    createButton(this, scr.back.x, scr.back.y, '返回', () => startScene(this, 'Menu'), CARDS_BACK);
  }

  debugState(): Partial<DebugState> {
    return { litCards: this.lit, cardsShown: this.shown, ...(getLayout(this).kind === 'portrait' ? { cardsPage: this.page } : {}) };
  }
}
