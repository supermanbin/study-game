import type Phaser from 'phaser';
import { ALL_FACTS } from '../core/facts';
import { LEVELS } from '../core/levels';
import { prebakeHud } from '../game/Hud';
import type { Layout } from '../layout/game';
import { bakeButton } from '../ui/Button';
import { bakeAll } from '../ui/clay';
import { bakePanel, bakeStars, bakeToggle } from '../ui/claywidgets';
import { CARDS_BACK, bakeCard } from './CardsScene';
import { LEVEL_SELECT_BACK, LEVEL_STAR_SIZE, levelTileOpts } from './LevelSelectScene';
import { MENU_BUTTONS } from './MenuScene';
import { RESULT_BUTTONS, RESULT_PANEL, RESULT_STAR_SIZE } from './ResultScene';
import { SETTINGS_BACK, SETTINGS_ROW_BUTTON } from './SettingsScene';

/**
 * Bakes every clay texture `layout` needs: the fixed textures and background (bakeAll), the HUD (prebakeHud) and
 * the scenes (prebakeScenes). Called from Boot, so entering a scene or playing only looks textures up.
 */
export function bakeLayout(scene: Phaser.Scene, layout: Layout): void {
  bakeAll(scene, layout);
  prebakeHud(scene, layout);
  prebakeScenes(scene, layout);
}

/**
 * Bakes every constant-size texture of the menu-side scenes and Result (via bakeLayout, next to bakeAll and
 * prebakeHud), so entering a scene only looks textures up. Sizes and colours come from the scenes' own exports
 * (level tiles per layout kind).
 * The lock and the decorative menu balls are fixed shapes / balls baked by bakeAll.
 */
export function prebakeScenes(scene: Phaser.Scene, layout: Layout): void {
  for (const opts of Object.values(MENU_BUTTONS)) bakeButton(scene, opts);
  LEVELS.forEach((lv, i) => {
    bakeButton(scene, levelTileOpts(lv, i, false, layout.kind));
    bakeButton(scene, levelTileOpts(lv, i, true, layout.kind));
  });
  bakeStars(scene, LEVEL_STAR_SIZE);
  for (const f of ALL_FACTS) {
    bakeCard(scene, f, true);
    bakeCard(scene, f, false);
  }
  bakeButton(scene, SETTINGS_ROW_BUTTON);
  bakeToggle(scene, true);
  bakeToggle(scene, false);
  for (const opts of [CARDS_BACK, LEVEL_SELECT_BACK, SETTINGS_BACK]) bakeButton(scene, opts);
  bakePanel(scene, RESULT_PANEL.w, RESULT_PANEL.h);
  bakeStars(scene, RESULT_STAR_SIZE);
  for (const opts of Object.values(RESULT_BUTTONS)) bakeButton(scene, opts);
}
