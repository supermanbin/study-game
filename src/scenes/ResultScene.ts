import Phaser from 'phaser';
import { FONT_FAMILY, RENDER_SCALE } from '../config';
import type { LevelResult } from '../core/session';
import type { LevelId } from '../core/types';
import { QUESTIONS_PER_LEVEL } from '../core/levels';
import { type CelebrationStep, type CountLine, celebrationDurationMs, celebrationSteps } from '../game/celebration';
import type { DebuggableScene, DebugState } from '../game/debug';
import { confettiBurst, shockwave } from '../game/effects';
import { createButton, type ButtonOpts } from '../ui/Button';
import { INK, getAudio, getLayout } from '../ui/theme';
import { bakeStars, clayBackground, clayPanel } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { clayImage, css, starSlots } from '../ui/clay';
import { applyHiDpi } from '../ui/hiDpi';
import { resultScreen, type ResultScreen } from '../layout/screens';
import { startScene } from '../layout/apply';

const REASONS = { time: '时间到啦', pile: '地面堆满啦', notEnough: '差一点点，加油' } as const;

/** Result layout (exported for the Boot pre-bake). */
export const RESULT_PANEL = { w: 780, h: 510 };
export const RESULT_PANEL_PORTRAIT = { w: 640, h: 620 };
export const RESULT_STAR_SIZE = 96;
/** Buttons: 再玩一次, 下一关, 选关. */
export const RESULT_BUTTONS = {
  retry: { width: 290, height: 84, fontSize: 40, color: CLAY.primary },
  next: { width: 290, height: 84, fontSize: 40, color: BALL_COLORS[3] },
  select: { width: 290, height: 84, fontSize: 40, color: BALL_COLORS[1] },
} as const satisfies Record<string, ButtonOpts>;

/** Lit stars start this far above their slot, 1.6× and transparent, then drop in. */
const STAR_DROP_PX = 140;
const STAR_DROP_SCALE = 1.6;
/** Buttons above the confetti (5) so falling clay never covers them. */
const BUTTON_DEPTH = 10;
const CONFETTI_DEPTH = 5;
/** Design-size scale of a clay texture (baked at RENDER_SCALE). */
const TEX = 1 / RENDER_SCALE;

export class ResultScene extends Phaser.Scene implements DebuggableScene {
  private result!: LevelResult;
  private title!: Phaser.GameObjects.Text;
  private reason?: Phaser.GameObjects.Text;
  /** Lit star images (one per earned star), waiting above their slot until their `star` step. */
  private lit: Phaser.GameObjects.Image[] = [];
  private slotY: number[] = [];
  private countText!: Record<CountLine, Phaser.GameObjects.Text>;
  private celebrating = false;
  private scr!: ResultScreen;

  constructor() {
    super('Result');
  }

  init(data: { result: LevelResult }): void {
    this.result = data.result;
    this.lit = [];
    this.slotY = [];
    this.reason = undefined;
    this.celebrating = false;
  }

  create(): void {
    applyHiDpi(this);
    const r = this.result;
    const L = getLayout(this);
    const cx = L.width / 2;
    const scr = (this.scr = resultScreen(L));
    const font = { fontFamily: FONT_FAMILY, color: INK };
    clayBackground(this);
    clayPanel(this, scr.panel.x, scr.panel.y, scr.panel.w, scr.panel.h);
    this.title = this.add
      .text(scr.title.x, scr.title.y, r.passed ? '过关啦！' : '再试一次吧！', { ...font, fontSize: `${scr.title.size}px`, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setScale(0.6);
    if (!r.passed) {
      this.reason = this.add
        .text(scr.reason.x, scr.reason.y, REASONS[r.failReason ?? 'notEnough'], { ...font, fontSize: `${scr.reason.size}px`, color: css(CLAY.ink2) })
        .setOrigin(0.5)
        .setAlpha(0);
    }
    this.buildStars(cx, scr.starsY, r.stars);
    // Lines the script counts up start at 0; the others (failed page: score, bonus) show their value at once.
    const steps = celebrationSteps(r);
    const counted = new Set(steps.flatMap(s => (s.kind === 'count' ? [s.line] : [])));
    const initial = (line: CountLine) => this.countLabel(line, counted.has(line) ? 0 : this.countTarget(line));
    this.countText = {
      correct: this.add.text(scr.counts.correct.x, scr.counts.correct.y, initial('correct'), { ...font, fontSize: `${scr.counts.correct.size}px` }).setOrigin(0.5),
      score: this.add.text(scr.counts.score.x, scr.counts.score.y, initial('score'), { ...font, fontSize: `${scr.counts.score.size}px` }).setOrigin(0.5),
      bonus: this.add.text(scr.counts.bonus.x, scr.counts.bonus.y, initial('bonus'), { ...font, fontSize: `${scr.counts.bonus.size}px` }).setOrigin(0.5),
    };

    const labels: { label: string; go: () => void; opts: ButtonOpts }[] = [
      { label: '再玩一次', go: () => startScene(this, 'Game', { levelId: r.levelId }), opts: RESULT_BUTTONS.retry },
    ];
    if (r.passed && r.levelId < 6) {
      labels.push({ label: '下一关', go: () => startScene(this, 'Game', { levelId: (r.levelId + 1) as LevelId }), opts: RESULT_BUTTONS.next });
    }
    labels.push({ label: '选关', go: () => startScene(this, 'LevelSelect'), opts: RESULT_BUTTONS.select });
    // Landscape: left to right in this order; portrait stacks top to bottom with 下一关 first.
    const ordered = L.kind === 'portrait' && labels.length === 3 ? [labels[1], labels[0], labels[2]] : labels;
    const spots = scr.buttonsAt(ordered.length as 2 | 3);
    ordered.forEach((b, i) => {
      createButton(this, spots[i].x, spots[i].y, b.label, b.go, b.opts).setDepth(BUTTON_DEPTH);
    });

    // No manual cleanup: a Timeline destroys itself on the scene's SHUTDOWN (destroying it twice throws).
    this.playCelebration(steps);
  }

  /** Three unlit stars in place; a lit star per earned star parked above its slot (pre-baked textures only). */
  private buildStars(cx: number, starsY: number, stars: 0 | 1 | 2 | 3): void {
    const tex = bakeStars(this, RESULT_STAR_SIZE);
    starSlots(RESULT_STAR_SIZE).forEach((p, i) => {
      const x = cx + p.x;
      const y = starsY + p.y;
      clayImage(this, x, y, tex.off);
      this.slotY[i] = y;
      if (i < stars) this.lit.push(clayImage(this, x, y - STAR_DROP_PX, tex.on).setAlpha(0).setScale(STAR_DROP_SCALE * TEX));
    });
  }

  private countLabel(line: CountLine, v: number): string {
    switch (line) {
      case 'correct':
        return `答对 ${v}/${QUESTIONS_PER_LEVEL}`;
      case 'score':
        return `得分 ${v}`;
      case 'bonus':
        return `时间奖励 +${v}`;
    }
  }

  private countTarget(line: CountLine): number {
    const r = this.result;
    return line === 'correct' ? r.correctCount : line === 'score' ? r.score : r.timeBonus;
  }

  private playCelebration(steps: CelebrationStep[]): void {
    this.celebrating = true;
    const events: Phaser.Types.Time.TimelineEventConfig[] = steps.map(s => ({ at: s.at, run: () => this.runStep(s) }));
    events.push({ at: celebrationDurationMs(steps), run: () => (this.celebrating = false) });
    this.add.timeline(events).play();
  }

  private runStep(s: CelebrationStep): void {
    const audio = getAudio(this);
    switch (s.kind) {
      case 'title':
        this.tweens.add({ targets: this.title, scale: 1, duration: 300, ease: 'Back.Out' });
        break;
      case 'reason':
        if (this.reason) this.tweens.add({ targets: this.reason, alpha: 1, duration: 300 });
        break;
      case 'star': {
        const star = this.lit[s.index];
        if (!star) break;
        this.tweens.add({
          targets: star,
          y: this.slotY[s.index],
          alpha: 1,
          scale: TEX,
          duration: 250,
          ease: 'Back.Out',
          onComplete: () => {
            shockwave(this, star.x, star.y);
            this.cameras.main.shake(80, 0.002);
          },
        });
        break;
      }
      case 'count': {
        const holder = { v: 0 };
        const text = this.countText[s.line];
        this.tweens.add({
          targets: holder,
          v: this.countTarget(s.line),
          duration: s.durationMs,
          ease: 'Cubic.Out',
          onUpdate: () => text.setText(this.countLabel(s.line, Math.round(holder.v))),
        });
        break;
      }
      case 'confetti': {
        const cx = getLayout(this).width / 2;
        const { y, dx } = this.scr.confetti;
        confettiBurst(this, cx - dx, y, CONFETTI_DEPTH);
        confettiBurst(this, cx + dx, y, CONFETTI_DEPTH);
        break;
      }
      case 'sfx':
        audio?.sfx(s.name);
        break;
      case 'voice':
        audio?.voice(s.category);
        break;
    }
  }

  debugState(): Partial<DebugState> {
    return { stars: this.result?.stars, celebrating: this.celebrating };
  }
}
