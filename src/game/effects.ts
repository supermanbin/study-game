import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Throttle } from '../audio/pickLine';
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
const STAR_KEY = 'fx-star';
const CONFETTI_KEY = 'fx-confetti';
const PUFF_KEY = 'fx-puff';
const COLORS = [0xff8a65, 0x4fc3f7, 0x81c784, 0xffd54f, 0xba68c8, 0xf06292];

const sparkThrottle = new Throttle(80);

function ensureTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(STAR_KEY)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 10 : 4.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(10 + Math.cos(a) * r, 10 + Math.sin(a) * r));
  }
  g.fillPoints(pts, true);
  g.generateTexture(STAR_KEY, 20, 20);
  g.clear().fillStyle(0xffffff, 1).fillRect(0, 0, 10, 6);
  g.generateTexture(CONFETTI_KEY, 10, 6);
  g.clear().fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  g.generateTexture(PUFF_KEY, 8, 8);
  g.destroy();
}

function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  count: number,
  lifespan: number,
  cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): void {
  ensureTextures(scene);
  const em = scene.add.particles(Math.max(0, x), Math.max(QUESTION_AREA_BOTTOM, y), key, {
    lifespan,
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    emitting: false,
    ...cfg,
  });
  em.setDepth(FX_DEPTH);
  em.explode(count);
  scene.time.delayedCall(lifespan + 60, () => em.destroy());
}

/** Stars + confetti burst, ~900 ms, 36 particles (half when `small`). */
export function explode(scene: Phaser.Scene, x: number, y: number, small = false): void {
  const n = small ? 0.5 : 1;
  burst(scene, x, y, STAR_KEY, Math.round(18 * n), 900, {
    speed: { min: 250, max: 650 },
    gravityY: 600,
    scale: { start: 1.6, end: 0 },
    rotate: { start: 0, end: 360 },
    tint: COLORS,
  });
  burst(scene, x, y, CONFETTI_KEY, Math.round(18 * n), 900, {
    speed: { min: 250, max: 650 },
    gravityY: 600,
    scale: { start: 1.4, end: 0 },
    rotate: { start: 0, end: 720 },
    tint: COLORS,
  });
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
      fontFamily: FONT_FAMILY,
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffd43b',
      stroke: '#7a4b00',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(FLOAT_DEPTH);
  scene.tweens.add({ targets: t, y: y0 - 120, alpha: 0, scale: 1.4, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
}

/** 「N 连击！」 96 px at the field centre, ~850 ms. */
export function centerCombo(scene: Phaser.Scene, combo: number): void {
  const t = scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${combo} 连击！`, {
      fontFamily: FONT_FAMILY,
      fontSize: '96px',
      fontStyle: 'bold',
      color: '#ff6b6b',
      stroke: '#ffffff',
      strokeThickness: 10,
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

/** Quick squash on `target` (scaleY 0.78 / scaleX 1.15), 60 ms yoyo. */
export function squash(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform): void {
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

/** Brief white flash over the target's bounds (150 ms). */
export function flashWhite(scene: Phaser.Scene, target: { getBounds(): Phaser.Geom.Rectangle }, depth = 110): void {
  const b = target.getBounds();
  const r = scene.add.rectangle(b.centerX, b.centerY, b.width, b.height, 0xffffff, 0.85).setDepth(depth);
  scene.tweens.add({ targets: r, alpha: 0, duration: 150, onComplete: () => r.destroy() });
}

/** Tiny collision spark, throttled to one per 80 ms. */
export function spark(scene: Phaser.Scene, x: number, y: number): void {
  if (!sparkThrottle.allow(scene.time.now)) return;
  burst(scene, x, y, PUFF_KEY, 5, 250, {
    speed: { min: 40, max: 120 },
    tint: 0xfff59d,
  });
}
