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
import { MAX_FRAME_DELTA_MS } from './game/tuning';

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
    matter: {
      gravity: { x: 0, y: 1 },
      // Same cap as the session/game clock (MAX_FRAME_DELTA_MS in GameScene.update), so physics and the
      // countdown slow down together on slow frames.
      runner: { maxFrameTime: MAX_FRAME_DELTA_MS },
    },
  },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, ResultScene, CardsScene, SettingsScene],
});
