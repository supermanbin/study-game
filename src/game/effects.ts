import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { Throttle } from '../audio/pickLine';
import { QUESTION_AREA_BOTTOM } from './tuning';

/** Effects sit above options (depth 10) but under the question band (50) and HUD (100). */
export const FX_DEPTH = 30;
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

/** Stars + confetti, lifespan 550 ms. */
export function explode(scene: Phaser.Scene, x: number, y: number, small = false): void {
  const n = small ? 0.5 : 1;
  burst(scene, x, y, STAR_KEY, Math.round(14 * n), 550, {
    speed: { min: 140, max: 380 },
    gravityY: 300,
    rotate: { start: 0, end: 360 },
    tint: COLORS,
  });
  burst(scene, x, y, CONFETTI_KEY, Math.round(18 * n), 550, {
    speed: { min: 100, max: 320 },
    gravityY: 500,
    rotate: { start: 0, end: 720 },
    tint: COLORS,
  });
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

/** 「N 连击！×m」 just under the score area, 700 ms. */
export function comboPopup(scene: Phaser.Scene, combo: number): void {
  const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
  const t = scene.add
    .text(24, QUESTION_AREA_BOTTOM + 12, `${combo} 连击！×${mult}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ff6f00',
      stroke: '#ffffff',
      strokeThickness: 8,
    })
    .setDepth(FX_DEPTH + 5)
    .setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.Out' });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    y: t.y + 18,
    delay: 450,
    duration: 250,
    onComplete: () => t.destroy(),
  });
}
