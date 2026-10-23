import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH } from '../config';
import type { LevelResult } from '../core/session';
import type { LevelId } from '../core/types';
import { QUESTIONS_PER_LEVEL } from '../core/levels';
import type { DebuggableScene, DebugState } from '../game/debug';
import { createButton, type ButtonOpts } from '../ui/Button';
import { INK } from '../ui/theme';
import { clayBackground, clayPanel, clayStars } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { css } from '../ui/clay';
import { applyHiDpi } from '../ui/hiDpi';

const REASONS = { time: '时间到啦', pile: '地面堆满啦', notEnough: '差一点点，加油' } as const;

/** Result layout (exported for the Boot pre-bake). */
export const RESULT_PANEL = { w: 780, h: 510 };
export const RESULT_STAR_SIZE = 96;
/** Buttons: 再玩一次, 下一关, 选关. */
export const RESULT_BUTTONS = {
  retry: { width: 290, height: 84, fontSize: 40, color: CLAY.primary },
  next: { width: 290, height: 84, fontSize: 40, color: BALL_COLORS[3] },
  select: { width: 290, height: 84, fontSize: 40, color: BALL_COLORS[1] },
} as const satisfies Record<string, ButtonOpts>;

export class ResultScene extends Phaser.Scene implements DebuggableScene {
  private result!: LevelResult;

  constructor() {
    super('Result');
  }

  init(data: { result: LevelResult }): void {
    this.result = data.result;
  }

  create(): void {
    applyHiDpi(this);
    const r = this.result;
    const cx = GAME_WIDTH / 2;
    const font = { fontFamily: FONT_FAMILY, color: INK };
    clayBackground(this);
    clayPanel(this, cx, 282, RESULT_PANEL.w, RESULT_PANEL.h);
    this.add.text(cx, 90, r.passed ? '过关啦！' : '再试一次吧！', { ...font, fontSize: '72px', fontStyle: 'bold' }).setOrigin(0.5);
    if (!r.passed) {
      this.add.text(cx, 160, REASONS[r.failReason ?? 'notEnough'], { ...font, fontSize: '32px', color: css(CLAY.ink2) }).setOrigin(0.5);
    }
    clayStars(this, cx, 255, r.stars, RESULT_STAR_SIZE);
    this.add.text(cx, 350, `答对 ${r.correctCount}/${QUESTIONS_PER_LEVEL}`, { ...font, fontSize: '40px' }).setOrigin(0.5);
    this.add.text(cx, 405, `得分 ${r.score}`, { ...font, fontSize: '36px' }).setOrigin(0.5);
    this.add.text(cx, 455, `时间奖励 +${r.timeBonus}`, { ...font, fontSize: '36px' }).setOrigin(0.5);

    const labels: { label: string; go: () => void; opts: ButtonOpts }[] = [
      { label: '再玩一次', go: () => this.scene.start('Game', { levelId: r.levelId }), opts: RESULT_BUTTONS.retry },
    ];
    if (r.passed && r.levelId < 6) {
      labels.push({ label: '下一关', go: () => this.scene.start('Game', { levelId: (r.levelId + 1) as LevelId }), opts: RESULT_BUTTONS.next });
    }
    labels.push({ label: '选关', go: () => this.scene.start('LevelSelect'), opts: RESULT_BUTTONS.select });
    const gap = 330;
    labels.forEach((b, i) => {
      createButton(this, cx + (i - (labels.length - 1) / 2) * gap, 600, b.label, b.go, b.opts);
    });
  }

  debugState(): Partial<DebugState> {
    return { stars: this.result?.stars };
  }
}
