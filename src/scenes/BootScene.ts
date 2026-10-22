import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config';
import { VOICE_LINES, voicePath } from '../audio/voiceLines';
import { AudioService } from '../audio/AudioService';
import { defaultProgress, type ProgressData } from '../core/progress';
import { mulberry32 } from '../core/rng';
import { LocalStorageProgressStore, safeLocalStorage } from '../core/store';
import { installDebug } from '../game/debug';

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
    const registry = this.game.registry;
    registry.set(
      'audio',
      new AudioService(
        this.sound,
        () => (registry.get('progress') as ProgressData | undefined)?.settings ?? defaultProgress(0).settings,
        mulberry32(Date.now()),
      ),
    );
    this.cameras.main.setBackgroundColor('#fdf6e3');
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '九九乘法闯关', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: '#333333',
      })
      .setOrigin(0.5);

    const store = new LocalStorageProgressStore(safeLocalStorage());
    registry.set('store', store);
    registry.set('progress', await store.load());
    installDebug(this.game);
    // Task 11 routes to the menu instead.
    this.scene.start('Game', { levelId: 1 });
  }
}
