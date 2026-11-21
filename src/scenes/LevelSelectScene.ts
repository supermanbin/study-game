import Phaser from 'phaser';
import { LEVELS, type LevelSpec } from '../core/levels';
import { createButton, type ButtonOpts } from '../ui/Button';
import { clayBackground, clayLock, clayStars } from '../ui/claywidgets';
import { BALL_COLORS, CLAY } from '../ui/palette';
import { getLayout, getProgress, title } from '../ui/theme';
import type { LayoutKind } from '../core/types';
import { levelSelectScreen } from '../layout/screens';
import { applyHiDpi } from '../ui/hiDpi';
import { startScene } from '../layout/apply';

/** Star box size under each tile. */
export const LEVEL_STAR_SIZE = 30;
export const LEVEL_SELECT_BACK: ButtonOpts = { width: 220, color: BALL_COLORS[5] };

/** Button options of level tile `i` (exported for the Boot pre-bake, which bakes it locked and unlocked). */
export const levelTileOpts = (lv: LevelSpec, i: number, locked: boolean, kind: LayoutKind): ButtonOpts => {
  // Only the tile size is read, and it does not depend on the screen size.
  const { tile } = levelSelectScreen({ kind, width: kind === 'portrait' ? 720 : 1280, height: kind === 'portrait' ? 1558 : 720 });
  return {
    width: tile.w,
    height: tile.h,
    fontSize: tile.fontSize,
    subtitleSize: tile.subtitleSize,
    disabled: locked,
    color: lv.boss ? BALL_COLORS[4] : i % 2 === 0 ? CLAY.primary : BALL_COLORS[1],
    subtitle: lv.name,
  };
};

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create(): void {
    applyHiDpi(this);
    clayBackground(this);
    const p = getProgress(this);
    const layout = getLayout(this);
    const s = levelSelectScreen(layout);
    title(this, '选择关卡', s.title.y, s.title.size);
    LEVELS.forEach((lv, i) => {
      const { x, y } = s.tiles[i];
      const locked = lv.id > p.unlockedLevel;
      const stars = p.levels[lv.id]?.bestStars ?? 0;
      createButton(this, x, y, `第${lv.id}关`, () => startScene(this, 'Game', { levelId: lv.id }), levelTileOpts(lv, i, locked, layout.kind));
      clayStars(this, x, y + s.starsDy, stars, LEVEL_STAR_SIZE);
      if (locked) clayLock(this, x + s.lock.dx, y + s.lock.dy, 38);
    });
    createButton(this, s.back.x, s.back.y, '返回', () => startScene(this, 'Menu'), LEVEL_SELECT_BACK);
  }
}
