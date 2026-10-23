export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const FONT_FAMILY = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

/**
 * Backing-store scale: the canvas is rendered at RENDER_SCALE × the 1280×720 design size and every scene's
 * camera zooms by the same factor (see applyHiDpi), so Retina / large screens get one canvas pixel per
 * physical pixel instead of an upscaled, blurry 1280×720 bitmap. Capped at 3 to bound fill cost.
 */
export const RENDER_SCALE =
  typeof window === 'undefined'
    ? 1
    : Math.min(
        3,
        Math.max(1, Math.ceil(window.devicePixelRatio * Math.max(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT) * 2) / 2),
      );
