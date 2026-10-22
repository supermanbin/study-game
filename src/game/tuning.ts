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
 * Gravity = BASE_GRAVITY_Y * difficultyAt(i).fallSpeed. Freeze is applied via the Matter engine timeScale
 * (= session.timeScale()), which alone halves fall speed; also scaling gravity would make it ~0.25x.
 * Playtest: 0.25 gave ~6 s per fall at index 0; 0.36 gives ~4.5 s from spawn to ground.
 */
export const BASE_GRAVITY_Y = 0.36;
export const FRICTION_AIR = 0.035;
export const RESTITUTION = 0.5;
/** Low surface friction so upright (non-spinning) circles slide off each other instead of stacking in towers. */
export const FRICTION = 0.02;
export const MISS_REVEAL_MS = 1200;

/** Upper bound for the per-frame delta fed to the session clock (tab hidden → huge delta on resume). */
export const MAX_FRAME_DELTA_MS = 100;
