import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#fdf6e3');
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '九九乘法闯关', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: '#333333',
      })
      .setOrigin(0.5);
  }
}
