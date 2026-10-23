import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import type { Settings } from '../core/progress';
import { createButton, type ButtonOpts } from '../ui/Button';
import { clayBackground, clayToggle } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { css } from '../ui/clay';
import { getAudio, getProgress, getStore, title } from '../ui/theme';
import { applyHiDpi } from '../ui/hiDpi';

const ROWS: { key: keyof Settings; label: string }[] = [
  { key: 'music', label: '音乐' },
  { key: 'voice', label: '语音' },
  { key: 'sfx', label: '音效' },
];

export const SETTINGS_ROW_BUTTON: ButtonOpts = { width: 300, color: BALL_COLORS[1] };
export const SETTINGS_BACK: ButtonOpts = { width: 220, color: BALL_COLORS[5] };

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    applyHiDpi(this);
    clayBackground(this);
    title(this, '设置', 90, 64);
    ROWS.forEach((row, i) => {
      const y = 230 + i * 120;
      const on = getProgress(this).settings[row.key];
      const toggle = () => this.toggle(row.key);
      createButton(this, 640, y, row.label, toggle, SETTINGS_ROW_BUTTON);
      clayToggle(this, 850, y - 8, on, toggle);
      this.add
        .text(850, y + 34, on ? '开' : '关', { fontFamily: FONT_FAMILY, fontSize: '22px', color: css(CLAY.ink2), fontStyle: 'bold' })
        .setOrigin(0.5);
    });
    createButton(this, 640, 620, '返回', () => this.scene.start('Menu'), SETTINGS_BACK);
  }

  private toggle(key: keyof Settings): void {
    const p = getProgress(this);
    const next = { ...p, settings: { ...p.settings, [key]: !p.settings[key] }, updatedAt: Date.now() };
    this.registry.set('progress', next);
    void getStore(this).save(next);
    if (key === 'music') getAudio(this).setMusic(next.settings.music);
    this.scene.restart();
  }
}
