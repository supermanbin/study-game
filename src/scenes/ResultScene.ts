import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH } from '../config';
import type { LevelResult } from '../core/session';
import type { LevelId } from '../core/types';
import { QUESTIONS_PER_LEVEL } from '../core/levels';
import type { DebuggableScene, DebugState } from '../game/debug';
import { createButton } from '../ui/Button';
import { BG, INK } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';

const REASONS = { time: '时间到啦', pile: '地面堆满啦', notEnough: '差一点点，加油' } as const;

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
    this.cameras.main.setBackgroundColor(BG);
    this.add.text(cx, 90, r.passed ? '过关啦！' : '再试一次吧！', { ...font, fontSize: '72px', fontStyle: 'bold' }).setOrigin(0.5);
    if (!r.passed) {
      this.add.text(cx, 160, REASONS[r.failReason ?? 'notEnough'], { ...font, fontSize: '32px', color: '#8d6e63' }).setOrigin(0.5);
    }
    this.add
      .text(cx, 255, '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), { ...font, fontSize: '96px', color: '#f9a825' })
      .setOrigin(0.5);
    this.add.text(cx, 350, `答对 ${r.correctCount}/${QUESTIONS_PER_LEVEL}`, { ...font, fontSize: '40px' }).setOrigin(0.5);
    this.add.text(cx, 405, `得分 ${r.score}`, { ...font, fontSize: '36px' }).setOrigin(0.5);
    this.add.text(cx, 455, `时间奖励 +${r.timeBonus}`, { ...font, fontSize: '36px' }).setOrigin(0.5);

    const labels: { label: string; go: () => void; color: number }[] = [
      { label: '再玩一次', go: () => this.scene.start('Game', { levelId: r.levelId }), color: 0x43a047 },
    ];
    if (r.passed && r.levelId < 6) {
      labels.push({ label: '下一关', go: () => this.scene.start('Game', { levelId: (r.levelId + 1) as LevelId }), color: 0xfb8c00 });
    }
    labels.push({ label: '选关', go: () => this.scene.start('LevelSelect'), color: 0x1e88e5 });
    const gap = 330;
    labels.forEach((b, i) => {
      createButton(this, cx + (i - (labels.length - 1) / 2) * gap, 600, b.label, b.go, { width: 290, height: 84, fontSize: 40, color: b.color });
    });
  }

  debugState(): Partial<DebugState> {
    return { stars: this.result?.stars };
  }
}
