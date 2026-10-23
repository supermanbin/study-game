import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ItemKind } from '../core/session';
import { bakeRoundRect, bakeShape, clayImage, css } from '../ui/clay';
import { clayPanel, clayPlaque, panelRadius, plaqueRadius } from '../ui/claywidgets';
import { CLAY } from '../ui/palette';
import { GROUND_Y, WARNING_LINE_Y } from './tuning';

const HUD_DEPTH = 100;
const BAND_DEPTH = 50;
/** Floor and warning dots sit under the pegs (9) and balls (10+). */
const GROUND_DEPTH = 1;

/** Fixed HUD geometry (design px). Each size is baked once (Boot pre-bakes them via `prebakeHud`). */
const BAND = { x: GAME_WIDTH / 2, y: 70, w: GAME_WIDTH - 28, h: 120 };
const SCORE = { x: 24 + 95, y: 38, w: 190, h: 44 };
const COMBO = { x: 24 + 190 + 12 + 75, y: 38, w: 150, h: 36 };
const TIME = { x: GAME_WIDTH - 24 - 85, y: 42, w: 170, h: 52 };
const ITEM = { y: 106, w: 150, h: 38, color: 0xe6f1fb, ink: '#3c6a92' };
const ITEM_X: Record<ItemKind, number> = { freeze: 24 + 75, magnifier: 24 + 150 + 12 + 75 };
const REVEAL = { x: GAME_WIDTH / 2, y: 110, w: 280, h: 44 };
const PAUSE = { w: 760, h: 160 };
const FLOOR_H = GAME_HEIGHT - GROUND_Y + 20;
const DOT_STEP = 36;

/** Floor texture: one key for both the pre-bake and the HUD. */
const bakeFloor = (scene: Phaser.Scene) => bakeRoundRect(scene, GAME_WIDTH, FLOOR_H, 20, CLAY.floor);

/** Bakes every HUD texture (call from Boot, so entering the game scene bakes nothing). */
export function prebakeHud(scene: Phaser.Scene): void {
  for (const b of [BAND, PAUSE]) bakeRoundRect(scene, b.w, b.h, panelRadius(b.h), CLAY.panel);
  for (const b of [SCORE, COMBO, TIME, REVEAL]) bakeRoundRect(scene, b.w, b.h, plaqueRadius(b.h), CLAY.plaque);
  bakeRoundRect(scene, ITEM.w, ITEM.h, plaqueRadius(ITEM.h), ITEM.color);
  bakeFloor(scene);
}

/** Prompt, score/combo, countdown, item buttons, warning line, floor, pause overlay, miss reveal. */
export class Hud {
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly reveal: Phaser.GameObjects.Text;
  private readonly revealPlaque: Phaser.GameObjects.Image;
  private readonly score: Phaser.GameObjects.Text;
  private readonly combo: Phaser.GameObjects.Text;
  private readonly comboPlaque: Phaser.GameObjects.Image;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly itemButtons: Record<ItemKind, Phaser.GameObjects.Container>;
  private readonly itemLabels: Record<ItemKind, Phaser.GameObjects.Text>;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private revealTimer?: Phaser.Time.TimerEvent;
  private lastSecond = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    onItem: (kind: ItemKind) => void,
    onResume: () => void,
  ) {
    const font = { fontFamily: FONT_FAMILY };
    // The question band sits above the options so newly spawned ones emerge from under it.
    clayPanel(scene, BAND.x, BAND.y, BAND.w, BAND.h).setDepth(BAND_DEPTH);
    // Floor: top edge at GROUND_Y (the rounded bottom corners are off-screen).
    clayImage(scene, GAME_WIDTH / 2, GROUND_Y + FLOOR_H / 2, bakeFloor(scene)).setDepth(GROUND_DEPTH);
    // Warning line: a row of inset clay dots.
    const dot = bakeShape(scene, 'dot');
    for (let x = DOT_STEP / 2; x < GAME_WIDTH; x += DOT_STEP) clayImage(scene, x, WARNING_LINE_Y, dot).setDepth(GROUND_DEPTH);

    this.prompt = scene.add
      .text(GAME_WIDTH / 2, 50, '', { ...font, fontSize: '64px', fontStyle: 'bold', color: css(CLAY.ink) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    // Plaques are baked once at a fixed size; only the texts on them change.
    this.revealPlaque = clayPlaque(scene, REVEAL.x, REVEAL.y, REVEAL.w, REVEAL.h).setDepth(HUD_DEPTH).setVisible(false);
    this.reveal = scene.add
      .text(REVEAL.x, REVEAL.y, '', { ...font, fontSize: '30px', fontStyle: 'bold', color: '#3f8a5a' })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    clayPlaque(scene, SCORE.x, SCORE.y, SCORE.w, SCORE.h).setDepth(HUD_DEPTH);
    this.score = scene.add
      .text(SCORE.x, SCORE.y, '', { ...font, fontSize: '28px', fontStyle: 'bold', color: css(CLAY.ink2) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.comboPlaque = clayPlaque(scene, COMBO.x, COMBO.y, COMBO.w, COMBO.h).setDepth(HUD_DEPTH).setVisible(false);
    this.combo = scene.add
      .text(COMBO.x, COMBO.y, '', { ...font, fontSize: '24px', fontStyle: 'bold', color: css(CLAY.accent) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    clayPlaque(scene, TIME.x, TIME.y, TIME.w, TIME.h).setDepth(HUD_DEPTH);
    this.timer = scene.add
      .text(TIME.x, TIME.y, '', { ...font, fontSize: '34px', fontStyle: 'bold', color: css(CLAY.ink2) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    const mkButton = (kind: ItemKind) => {
      const label = scene.add.text(0, 0, '', { ...font, fontSize: '21px', fontStyle: 'bold', color: ITEM.ink }).setOrigin(0.5);
      const plaque = clayPlaque(scene, 0, 0, ITEM.w, ITEM.h, ITEM.color);
      const c = scene.add.container(ITEM_X[kind], ITEM.y, [plaque, label]).setSize(ITEM.w, ITEM.h).setDepth(HUD_DEPTH);
      // Hit area = the plaque rect (the texture also carries shadow padding).
      c.setInteractive(new Phaser.Geom.Rectangle(0, 0, ITEM.w, ITEM.h), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => onItem(kind));
      c.input!.cursor = 'pointer';
      return { c, label };
    };
    const freeze = mkButton('freeze');
    const magnifier = mkButton('magnifier');
    this.itemButtons = { freeze: freeze.c, magnifier: magnifier.c };
    this.itemLabels = { freeze: freeze.label, magnifier: magnifier.label };

    // A click anywhere on the overlay resumes too (after a blur auto-pause the child just clicks back in).
    this.shade = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, CLAY.bgInner, 0.75)
      .setInteractive()
      .on('pointerdown', onResume);
    const panel = clayPanel(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, PAUSE.w, PAUSE.h);
    const label = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '暂停中 · 点一下或按空格继续', { ...font, fontSize: '46px', fontStyle: 'bold', color: css(CLAY.ink) })
      .setOrigin(0.5);
    this.overlay = scene.add.container(0, 0, [this.shade, panel, label]).setDepth(HUD_DEPTH + 10).setVisible(false);
  }

  /** HUD objects that swallow a click (item buttons, pause overlay): it must not also hit an option. */
  swallowsClick(obj: Phaser.GameObjects.GameObject): boolean {
    return this.isItemButton(obj) || obj === this.shade;
  }

  isItemButton(obj: Phaser.GameObjects.GameObject): boolean {
    return obj === this.itemButtons.freeze || obj === this.itemButtons.magnifier;
  }

  setPrompt(text: string): void {
    this.prompt.setText(text);
  }

  showAnswer(text: string, ms: number): void {
    this.revealTimer?.remove();
    this.reveal.setText(text);
    this.revealPlaque.setVisible(true);
    this.revealTimer = this.scene.time.delayedCall(ms, () => {
      this.reveal.setText('');
      this.revealPlaque.setVisible(false);
    });
  }

  setScore(score: number, combo: number): void {
    this.score.setText(`得分 ${score}`);
    this.combo.setText(combo >= 2 ? `连对 ×${combo}` : '');
    this.comboPlaque.setVisible(combo >= 2);
  }

  /** Updates the countdown; returns true when a new whole second below 10 s was entered (tick sound). */
  setTime(ms: number): boolean {
    const sec = Math.ceil(ms / 1000);
    if (sec === this.lastSecond) return false;
    const first = this.lastSecond === -1;
    this.lastSecond = sec;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    this.timer.setText(`时间 ${m}:${String(s).padStart(2, '0')}`);
    this.timer.setColor(sec < 10 ? '#e04a3a' : css(CLAY.ink2));
    return !first && sec < 10;
  }

  setItems(items: Record<ItemKind, number>): void {
    this.itemLabels.freeze.setText(`1 冰冻 ×${items.freeze}`);
    this.itemButtons.freeze.setAlpha(items.freeze > 0 ? 1 : 0.5);
    this.itemLabels.magnifier.setText(`2 放大镜 ×${items.magnifier}`);
    this.itemButtons.magnifier.setAlpha(items.magnifier > 0 ? 1 : 0.5);
  }

  setPaused(paused: boolean): void {
    this.overlay.setVisible(paused);
  }
}
