import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH } from '../config';
import type { ProgressData } from '../core/progress';
import type { ProgressStore } from '../core/store';
import { css } from './clay';
import { CLAY } from './palette';
import type { AudioService } from '../audio/AudioService';

export const BG = css(CLAY.bgOuter);
export const INK = css(CLAY.ink);

export function title(scene: Phaser.Scene, text: string, y = 70, size = 56): Phaser.GameObjects.Text {
  return scene.add
    .text(GAME_WIDTH / 2, y, text, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color: INK, fontStyle: 'bold' })
    .setOrigin(0.5);
}

export const getProgress = (s: Phaser.Scene): ProgressData => s.registry.get('progress') as ProgressData;
export const getAudio = (s: Phaser.Scene): AudioService => s.registry.get('audio') as AudioService;
export const getStore = (s: Phaser.Scene): ProgressStore => s.registry.get('store') as ProgressStore;
