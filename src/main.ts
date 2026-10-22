import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { CardsScene } from './scenes/CardsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { mountTuningPanel } from './game/TuningPanel';

mountTuningPanel();

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#fdf6e3',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: { gravity: { x: 0, y: 1 } },
  },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, ResultScene, CardsScene, SettingsScene],
});
