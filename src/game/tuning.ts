import type { LevelId } from '../core/types';

/** Gameplay layout and physics constants (design resolution 1280×720). Tune by playtest. */
export const GROUND_Y = 700;
export const WARNING_LINE_Y = 320;
export const QUESTION_AREA_BOTTOM = 140;
export const PILE_OVERFLOW_MS = 2000;

export const SPAWN_Y = -60;
export const SPAWN_STAGGER_MS = 250;
export const SPAWN_X_MIN = 120;
export const SPAWN_X_MAX = 1160;

export const NUMBER_RADIUS = 42;
export const PILL_W = 140;
export const PILL_H = 56;

/**
 * Gravity = BASE_GRAVITY_Y * LEVEL_FALL_FACTOR[level] * difficultyAt(i).fallSpeed. Freeze is applied via the
 * Matter engine timeScale (= session.timeScale()), which alone halves fall speed; also scaling gravity would
 * make it ~0.25x. With FRICTION_AIR the options fall at terminal speed, so fall time is ~1 / gravity.
 */
export const BASE_GRAVITY_Y = 0.36;
/**
 * Per-level fall-speed factor (anti-goal: early levels must not be time-pressured). Measured visible fall
 * (emerging below the question band -> touching the ground, empty field): levels 1-2 about 7.3 s at question 1
 * and 4.6 s at question 20; levels 3-6 about 5.85 s and 3.7 s. A single factor keeps the difficultyAt ramp
 * (1.6x), so it is a compromise between the early and late targets (7/5 s and 5.5/4 s).
 */
export const LEVEL_FALL_FACTOR: Record<LevelId, number> = { 1: 0.45, 2: 0.45, 3: 0.56, 4: 0.56, 5: 0.56, 6: 0.56 };
export const FRICTION_AIR = 0.035;
export const RESTITUTION = 0.5;
/** Low surface friction so upright (non-spinning) circles slide off each other instead of stacking in towers. */
export const FRICTION = 0.02;
export const MISS_REVEAL_MS = 1200;

/** Upper bound for the per-frame delta fed to the session clock (tab hidden → huge delta on resume). */
export const MAX_FRAME_DELTA_MS = 100;
