import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config';
import { Throttle } from '../audio/pickLine';
import { bakeShape, type ClayTex } from '../ui/clay';
import { CLAY_TEXT } from '../ui/claywidgets';
import { BALL_COLORS } from '../ui/palette';
import type { OptionBody } from './OptionBody';
import { QUESTION_AREA_BOTTOM } from './tuning';

/**
 * Effects draw over the balls (options 10, labels 11; spec section 7 allows this for juice) but stay under
 * the question band (50), HUD (100) and pause overlay (110), so they never cover the prompt or the HUD.
 */
export const FX_DEPTH = 20;
const RING_DEPTH = 20;
const FLOAT_DEPTH = 25;
/** Centre combo popup: topmost effect, still under the question band (50). */
const COMBO_DEPTH = 40;
const SPARK_COLOR = BALL_COLORS[3];
/** Colours per burst (one emitter per colour and particle kind). */
const BURST_COLORS = 3;
/** Clay textures are baked at RENDER_SCALE; this shows them at design size. */
const TEX = 1 / RENDER_SCALE;

const sparkThrottle = new Throttle(80);

/** One short particle burst from a pre-baked clay texture (bakeAll in Boot), so nothing is generated during play. */
function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tex: ClayTex,
  count: number,
  lifespan: number,
  cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): void {
  const em = scene.add.particles(Math.max(0, x), Math.max(QUESTION_AREA_BOTTOM, y), tex.key, {
    lifespan,
    angle: { min: 0, max: 360 },
    scale: { start: TEX, end: 0 },
    emitting: false,
    ...cfg,
  });
  em.setDepth(FX_DEPTH);
  em.explode(count);
  scene.time.delayedCall(lifespan + 60, () => em.destroy());
}

/** Clay stars + clay dots in 3 random ball colours, ~900 ms, 36 particles (half when `small`). */
export function explode(scene: Phaser.Scene, x: number, y: number, small = false): void {
  const colors = Phaser.Utils.Array.Shuffle([...BALL_COLORS]).slice(0, BURST_COLORS);
  const per = Math.round((18 * (small ? 0.5 : 1)) / BURST_COLORS);
  const fly = { speed: { min: 250, max: 650 }, gravityY: 600 };
  for (const c of colors) {
    burst(scene, x, y, bakeShape(scene, 'particleStar', c), per, 900, { ...fly, scale: { start: 1.6 * TEX, end: 0 }, rotate: { start: 0, end: 360 } });
    burst(scene, x, y, bakeShape(scene, 'particleBall', c), per, 900, { ...fly, scale: { start: TEX, end: 0 } });
  }
}

/** White ring scaling 1 -> 4 while fading, 450 ms. */
export function shockwave(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add
    .circle(x, Math.max(QUESTION_AREA_BOTTOM, y), 42, 0xffffff, 0)
    .setStrokeStyle(8, 0xffffff)
    .setDepth(RING_DEPTH);
  scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
}

/** `+N` rising 120 px and fading, 900 ms. Nothing when delta <= 0. */
export function floatScore(scene: Phaser.Scene, x: number, y: number, delta: number): void {
  if (delta <= 0) return;
  const y0 = Math.max(QUESTION_AREA_BOTTOM + 130, y - 20);
  const t = scene.add
    .text(Phaser.Math.Clamp(x, 60, GAME_WIDTH - 60), y0, `+${delta}`, {
      ...CLAY_TEXT,
      fontSize: '44px',
    })
    .setOrigin(0.5)
    .setDepth(FLOAT_DEPTH);
  scene.tweens.add({ targets: t, y: y0 - 120, alpha: 0, scale: 1.4, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
}

/** 「N 连击！」 96 px at the field centre, ~850 ms. */
export function centerCombo(scene: Phaser.Scene, combo: number): void {
  const t = scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${combo} 连击！`, {
      ...CLAY_TEXT,
      fontSize: '96px',
    })
    .setOrigin(0.5)
    .setDepth(COMBO_DEPTH)
    .setScale(0.3);
  scene.tweens.add({ targets: t, scale: 1.1, duration: 250, ease: 'Back.Out', yoyo: true, hold: 300, onComplete: () => t.destroy() });
}

const SHOVE_RADIUS = 320;
const SHOVE_STRENGTH = 16;
const SHOVE_LIFT = 4;

/** Pushes balls within 320 px away from (x, y), plus a small upward kick. Skips the origin, removed and body-less balls. */
export function shove(scene: Phaser.Scene, x: number, y: number, balls: OptionBody[]): void {
  for (const o of balls) {
    if (o.state === 'removed' || !o.body) continue;
    const dx = o.x - x;
    const dy = o.y - y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.5 || d >= SHOVE_RADIUS) continue; // d ~ 0: the origin ball itself
    const f = (1 - d / SHOVE_RADIUS) * SHOVE_STRENGTH;
    const v = o.body.velocity;
    scene.matter.body.setVelocity(o.body, { x: v.x + (dx / d) * f, y: v.y + (dy / d) * f - SHOVE_LIFT });
  }
}

/** Anything with a scale: a game object, or OptionBody's visual scale (shell, stripe and label together). */
export interface Squashable {
  scaleX: number;
  scaleY: number;
  setScale(x: number, y?: number): unknown;
}

/** Quick squash on `target` (scaleY 0.78 / scaleX 1.15), 60 ms yoyo. */
export function squash(scene: Phaser.Scene, target: Squashable): void {
  scene.tweens.killTweensOf(target);
  target.setScale(1);
  scene.tweens.add({ targets: target, scaleX: 1.15, scaleY: 0.78, duration: 60, yoyo: true });
}

export interface Shakeable {
  setGrey(): void;
  shake(): void;
}

/** Wrong answer: the option turns grey and wiggles (~300 ms). */
export function greyShake(_scene: Phaser.Scene, target: Shakeable): void {
  target.setGrey();
  target.shake();
}

export function screenShake(scene: Phaser.Scene): void {
  scene.cameras.main.shake(250, 0.006);
}

/** Tiny collision spark (small lemon clay dots), throttled to one per 80 ms. */
export function spark(scene: Phaser.Scene, x: number, y: number): void {
  if (!sparkThrottle.allow(scene.time.now)) return;
  burst(scene, x, y, bakeShape(scene, 'particleBall', SPARK_COLOR), 5, 250, {
    speed: { min: 40, max: 120 },
    scale: { start: 0.6 * TEX, end: 0 },
  });
}
