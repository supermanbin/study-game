import { designSize, renderScaleFor } from './layout/select';

export const FONT_FAMILY = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

/**
 * Backing-store scale: the canvas is rendered at RENDER_SCALE × the design size and every scene's camera zooms
 * by the same factor (see applyHiDpi), so Retina / large screens get one canvas pixel per physical pixel instead
 * of an upscaled, blurry design-size bitmap. Fixed for the page load; capped at 3 to bound fill cost.
 */
export const RENDER_SCALE =
  typeof window === 'undefined'
    ? 1
    : renderScaleFor(
        designSize(window.innerWidth, window.innerHeight),
        window.devicePixelRatio,
        window.innerWidth,
        window.innerHeight,
      );
