import type { LevelId } from '../core/types';

/** Gameplay layout and physics constants (design resolution 1280×720). Tune by playtest. */
export const GROUND_Y = 700;
export const WARNING_LINE_Y = 440;
export const QUESTION_AREA_BOTTOM = 140;
export const PILE_OVERFLOW_MS = 2000;

export const SPAWN_STAGGER_MS = 220;
/** Drop launch: random x in this range, just below the question band. */
export const SPAWN_X_MIN = 120;
export const SPAWN_X_MAX = 1160;
/** Toss launch: balls are thrown in just below the question band. */
export const TOSS_Y = QUESTION_AREA_BOTTOM + 50;

/** Number balls. */
export const NUMBER_RADIUS = 42;
/** Reverse-mode `a × b` balls (smaller font inside). */
export const EXPR_RADIUS = 52;
export const BALL_FRICTION = 0.05;
export const BALL_DENSITY = 0.002;
/** Greyed (wrong) balls get heavier and sink. */
export const HEAVY_DENSITY = 0.006;

/**
 * Peg rows (staggered 6/5 per row, PEG_SPACING apart). The diagonal gap between neighbouring rows' pegs
 * (hypot(PEG_SPACING / 2, 80) ≈ 126) must exceed 2 × (EXPR_RADIUS + PEG_RADIUS) = 122 so every ball passes.
 */
export const PEG_ROWS_Y = [240, 320, 400];
export const PEG_RADIUS = 9;
export const PEG_SPACING = 195;

/**
 * Per-level gravity factor. Effective gravity = tuning.gravity × LEVEL_GRAVITY_FACTOR[level] ×
 * difficultyAt(i).fallSpeed. Freeze is applied via the Matter engine timeScale only.
 */
export const LEVEL_GRAVITY_FACTOR: Record<LevelId, number> = { 1: 0.8, 2: 0.8, 3: 1, 4: 1, 5: 1, 6: 1 };
export const MISS_REVEAL_MS = 1200;

/** Upper bound for the per-frame delta fed to the session clock (tab hidden → huge delta on resume). */
export const MAX_FRAME_DELTA_MS = 100;
