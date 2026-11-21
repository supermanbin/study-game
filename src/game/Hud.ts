import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import type { ItemKind } from '../core/session';
import type { Layout } from '../layout/game';
import { bakeRoundRect, bakeShape, clayImage, css } from '../ui/clay';
import { clayPanel, clayPlaque, panelRadius, plaqueRadius } from '../ui/claywidgets';
import { CLAY } from '../ui/palette';

const HUD_DEPTH = 100;
const BAND_DEPTH = 50;
/** Floor and warning dots sit under the pegs (9) and balls (10+). */
const GROUND_DEPTH = 1;

/** HUD geometry (design px) comes from `layout.hud`; each size is baked once (Boot pre-bakes them via `prebakeHud`). */
const ITEM_COLOR = 0xe6f1fb;
const ITEM_INK = '#3c6a92';
const PAUSE = { w: 760, h: 160 };
const DOT_STEP = 36;

/** Floor texture (layout width × field.floorH): one key for both the pre-bake and the HUD. */
const bakeFloor = (scene: Phaser.Scene, layout: Layout) => bakeRoundRect(scene, layout.width, layout.field.floorH, 20, CLAY.floor);

/** Bakes every HUD texture of `layout` (call from Boot, so entering the game scene bakes nothing). */
export function prebakeHud(scene: Phaser.Scene, layout: Layout): void {
  const { band, score, combo, time, reveal, items } = layout.hud;
  for (const b of [band, PAUSE]) bakeRoundRect(scene, b.w, b.h, panelRadius(b.h), CLAY.panel);
  for (const b of [score, combo, time, reveal]) bakeRoundRect(scene, b.w, b.h, plaqueRadius(b.h), CLAY.plaque);
  bakeRoundRect(scene, items.w, items.h, plaqueRadius(items.h), ITEM_COLOR);
  bakeFloor(scene, layout);
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
  private readonly timePrefix: string;
  /** Keyboard hint before each item label ('1 ' / '2 ', or nothing when the layout has no key hints). */
  private readonly itemHint: Record<ItemKind, string>;

  constructor(
    private readonly scene: Phaser.Scene,
    layout: Layout,
    { onItem, onResume }: { onItem: (kind: ItemKind) => void; onResume: () => void },
  ) {
    const font = { fontFamily: FONT_FAMILY };
    const { width, height, field } = layout;
    const { band, prompt, score, combo, time, items, reveal } = layout.hud;
    this.timePrefix = time.prefix;
    this.itemHint = items.keyHints ? { freeze: '1 ', magnifier: '2 ' } : { freeze: '', magnifier: '' };
    // The question band sits above the options so newly spawned ones emerge from under it.
    clayPanel(scene, band.x, band.y, band.w, band.h).setDepth(BAND_DEPTH);
    // Floor: top edge at groundY (the rounded bottom corners are off-screen).
    clayImage(scene, width / 2, field.groundY + field.floorH / 2, bakeFloor(scene, layout)).setDepth(GROUND_DEPTH);
    // Warning line: a row of inset clay dots.
    const dot = bakeShape(scene, 'dot');
    for (let x = DOT_STEP / 2; x < width; x += DOT_STEP) clayImage(scene, x, field.warningY, dot).setDepth(GROUND_DEPTH);

    this.prompt = scene.add
      .text(prompt.x, prompt.y, '', { ...font, fontSize: `${prompt.fontSize}px`, fontStyle: 'bold', color: css(CLAY.ink) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    // Plaques are baked once at a fixed size; only the texts on them change.
    this.revealPlaque = clayPlaque(scene, reveal.x, reveal.y, reveal.w, reveal.h).setDepth(HUD_DEPTH).setVisible(false);
    this.reveal = scene.add
      .text(reveal.x, reveal.y, '', { ...font, fontSize: `${reveal.fontSize}px`, fontStyle: 'bold', color: '#3f8a5a' })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    clayPlaque(scene, score.x, score.y, score.w, score.h).setDepth(HUD_DEPTH);
    this.score = scene.add
      .text(score.x, score.y, '', { ...font, fontSize: `${score.fontSize}px`, fontStyle: 'bold', color: css(CLAY.ink2) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.comboPlaque = clayPlaque(scene, combo.x, combo.y, combo.w, combo.h).setDepth(HUD_DEPTH).setVisible(false);
    this.combo = scene.add
      .text(combo.x, combo.y, '', { ...font, fontSize: `${combo.fontSize}px`, fontStyle: 'bold', color: css(CLAY.accent) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    clayPlaque(scene, time.x, time.y, time.w, time.h).setDepth(HUD_DEPTH);
    this.timer = scene.add
      .text(time.x, time.y, '', { ...font, fontSize: `${time.fontSize}px`, fontStyle: 'bold', color: css(CLAY.ink2) })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    const mkButton = (kind: ItemKind) => {
      const label = scene.add.text(0, 0, '', { ...font, fontSize: `${items.fontSize}px`, fontStyle: 'bold', color: ITEM_INK }).setOrigin(0.5);
      const plaque = clayPlaque(scene, 0, 0, items.w, items.h, ITEM_COLOR);
      const c = scene.add.container(items.x[kind], items.y, [plaque, label]).setSize(items.w, items.h).setDepth(HUD_DEPTH);
      // Hit area = the plaque rect (the texture also carries shadow padding).
      c.setInteractive(new Phaser.Geom.Rectangle(0, 0, items.w, items.h), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => onItem(kind));
      c.input!.cursor = 'pointer';
      return { c, label };
    };
    const freeze = mkButton('freeze');
    const magnifier = mkButton('magnifier');
    this.itemButtons = { freeze: freeze.c, magnifier: magnifier.c };
    this.itemLabels = { freeze: freeze.label, magnifier: magnifier.label };

    // A click anywhere on the overlay resumes too (after a blur auto-pause the child just clicks back in).
    this.shade = scene.add
      .rectangle(width / 2, height / 2, width, height, CLAY.bgInner, 0.75)
      .setInteractive()
      .on('pointerdown', onResume);
    const panel = clayPanel(scene, width / 2, height / 2, PAUSE.w, PAUSE.h);
    const label = scene.add
      .text(width / 2, height / 2, '暂停中 · 点一下或按空格继续', { ...font, fontSize: '46px', fontStyle: 'bold', color: css(CLAY.ink) })
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
    this.timer.setText(`${this.timePrefix}${m}:${String(s).padStart(2, '0')}`);
    this.timer.setColor(sec < 10 ? '#e04a3a' : css(CLAY.ink2));
    return !first && sec < 10;
  }

  setItems(items: Record<ItemKind, number>): void {
    this.itemLabels.freeze.setText(`${this.itemHint.freeze}冰冻 ×${items.freeze}`);
    this.itemButtons.freeze.setAlpha(items.freeze > 0 ? 1 : 0.5);
    this.itemLabels.magnifier.setText(`${this.itemHint.magnifier}放大镜 ×${items.magnifier}`);
    this.itemButtons.magnifier.setAlpha(items.magnifier > 0 ? 1 : 0.5);
  }

  setPaused(paused: boolean): void {
    this.overlay.setVisible(paused);
  }
}
