import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config';
import { VOICE_LINES, voicePath } from '../audio/voiceLines';
import { AudioService } from '../audio/AudioService';
import { defaultProgress, type ProgressData } from '../core/progress';
import { mulberry32 } from '../core/rng';
import { LocalStorageProgressStore, safeLocalStorage } from '../core/store';
import { bakeAll } from '../ui/clay';
import { applyHiDpi } from '../ui/hiDpi';
import { BG, INK } from '../ui/theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const lines of Object.values(VOICE_LINES)) {
      for (const l of lines) this.load.audio(l.id, voicePath(l.id));
    }
  }

  async create(): Promise<void> {
    applyHiDpi(this);
    const bakeMs = bakeAll(this);
    if (import.meta.env.DEV) console.info(`clay bake: ${bakeMs.toFixed(0)} ms`);
    const registry = this.game.registry;
    registry.set(
      'audio',
      new AudioService(
        this.sound,
        () => (registry.get('progress') as ProgressData | undefined)?.settings ?? defaultProgress(0).settings,
        mulberry32(Date.now()),
      ),
    );
    this.cameras.main.setBackgroundColor(BG);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '九九乘法闯关', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: INK,
      })
      .setOrigin(0.5);

    const store = new LocalStorageProgressStore(safeLocalStorage());
    registry.set('store', store);
    registry.set('progress', await store.load());
    this.scene.start('Menu');
  }
}
