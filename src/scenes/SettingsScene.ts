import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import type { Settings } from '../core/progress';
import { createButton } from '../ui/Button';
import { BG, getAudio, getProgress, getStore, title } from '../ui/theme';

const ROWS: { key: keyof Settings; label: string }[] = [
  { key: 'music', label: '音乐' },
  { key: 'voice', label: '语音' },
  { key: 'sfx', label: '音效' },
];

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG);
    title(this, '设置', 90, 64);
    ROWS.forEach((row, i) => {
      const y = 230 + i * 120;
      const on = getProgress(this).settings[row.key];
      createButton(this, 640, y, row.label, () => this.toggle(row.key), { width: 300, color: 0x1e88e5 });
      this.add
        .text(850, y, on ? '开' : '关', { fontFamily: FONT_FAMILY, fontSize: '56px', color: on ? '#2e7d32' : '#c62828', fontStyle: 'bold' })
        .setOrigin(0.5);
    });
    createButton(this, 640, 620, '返回', () => this.scene.start('Menu'), { width: 220, color: 0x757575 });
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
