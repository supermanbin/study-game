import type { LevelId } from '../core/types';

/**
 * Gameplay physics and timing constants (design px). Field and HUD geometry live in the layout
 * (`src/layout/game.ts`). Tune by playtest.
 */
export const PILE_OVERFLOW_MS = 2000;

export const SPAWN_STAGGER_MS = 220;

/** Number balls. */
export const NUMBER_RADIUS = 42;
/** Reverse-mode `a × b` balls (smaller font inside). */
export const EXPR_RADIUS = 52;
export const BALL_FRICTION = 0.05;
export const BALL_DENSITY = 0.002;
/** Greyed (wrong) balls get heavier and sink. */
export const HEAVY_DENSITY = 0.006;

/**
 * Peg radius. Peg positions come from the layout (`pegPositions`); the distance between any two pegs must
 * exceed 2 × (EXPR_RADIUS + PEG_RADIUS) so every ball passes (pinned in src/layout/pegs.test.ts).
 */
export const PEG_RADIUS = 9;

/**
 * Per-level gravity factor. Effective gravity = tuning.gravity × LEVEL_GRAVITY_FACTOR[level] ×
 * difficultyAt(i).fallSpeed. Freeze is applied via the Matter engine timeScale only.
 */
export const LEVEL_GRAVITY_FACTOR: Record<LevelId, number> = { 1: 0.8, 2: 0.8, 3: 1, 4: 1, 5: 1, 6: 1 };
export const MISS_REVEAL_MS = 1200;
/** After the last question ends, the scene keeps running this long so the final effects and voice finish. */
export const LEVEL_END_HOLD_MS = 1300;
/** Longer hold when the final answer defeats the boss (defeat animation + chest switch at 700 ms). */
export const BOSS_DEFEAT_HOLD_MS = 2000;

/**
 * Upper bound for the per-frame delta fed to the session clock (tab hidden → huge delta on resume).
 * Must equal the Matter runner's `maxFrameTime` (set from this constant in `src/main.ts`): the runner
 * simulates at most this much per frame, so below 30 fps the physics slows down and the countdown,
 * rest and stuck timers must slow down with it, or a waiting child loses time to a slow device.
 */
export const MAX_FRAME_DELTA_MS = 1000 / 30;
