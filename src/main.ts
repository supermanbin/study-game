import Phaser from 'phaser';
import { RENDER_SCALE } from './config';
import { debugEnabled } from './game/debug';
import { installLayoutWatcher } from './layout/apply';
import { layoutFor } from './layout/game';
import { designSize } from './layout/select';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { CardsScene } from './scenes/CardsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { bakeLayout } from './scenes/prebake';
import { mountTuningPanel } from './game/TuningPanel';
import { MAX_FRAME_DELTA_MS } from './game/tuning';
import { BG } from './ui/theme';

mountTuningPanel();

/** The layout applied for this page load (registry key `layout`, read through getLayout). */
const initial = layoutFor(designSize(innerWidth, innerHeight));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  // Rendered at RENDER_SCALE × the design size; each scene's camera zooms back (src/ui/hiDpi.ts).
  width: initial.width * RENDER_SCALE,
  height: initial.height * RENDER_SCALE,
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
  callbacks: {
    // Before any scene exists, so every scene (Boot included) reads it with getLayout.
    preBoot: g => {
      g.registry.set('layout', initial);
    },
  },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, ResultScene, CardsScene, SettingsScene],
});

// Rotating the phone (or reshaping the window) switches the layout between scenes.
installLayoutWatcher(game, bakeLayout);

if (debugEnabled()) (window as unknown as { __funyGame?: Phaser.Game }).__funyGame = game;
