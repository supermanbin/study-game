import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from './config';
import { debugEnabled } from './game/debug';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { CardsScene } from './scenes/CardsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { mountTuningPanel } from './game/TuningPanel';
import { MAX_FRAME_DELTA_MS } from './game/tuning';
import { BG } from './ui/theme';

mountTuningPanel();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  // Rendered at RENDER_SCALE × the design size; each scene's camera zooms back (src/ui/hiDpi.ts).
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  // Palette page colour, so screen shake never shows a strip of another colour.
  backgroundColor: BG,
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

if (debugEnabled()) (window as unknown as { __funyGame?: Phaser.Game }).__funyGame = game;
