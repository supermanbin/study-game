import type Phaser from 'phaser';
import { ALL_FACTS } from '../core/facts';
import { LEVELS } from '../core/levels';
import { bakeButton } from '../ui/Button';
import { bakePanel, bakeStars, bakeToggle } from '../ui/claywidgets';
import { CARDS_BACK, bakeCard } from './CardsScene';
import { LEVEL_SELECT_BACK, LEVEL_STAR_SIZE, levelTileOpts } from './LevelSelectScene';
import { MENU_BUTTONS } from './MenuScene';
import { RESULT_BUTTONS, RESULT_PANEL, RESULT_STAR_SIZE } from './ResultScene';
import { SETTINGS_BACK, SETTINGS_ROW_BUTTON } from './SettingsScene';

/**
 * Bakes every constant-size texture of the menu-side scenes and Result (call from Boot, next to bakeAll and
 * prebakeHud), so entering a scene only looks textures up. Sizes and colours come from the scenes' own exports.
 * The lock and the decorative menu balls are fixed shapes / balls baked by bakeAll.
 */
export function prebakeScenes(scene: Phaser.Scene): void {
  for (const opts of Object.values(MENU_BUTTONS)) bakeButton(scene, opts);
  LEVELS.forEach((lv, i) => {
    bakeButton(scene, levelTileOpts(lv, i, false));
    bakeButton(scene, levelTileOpts(lv, i, true));
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
