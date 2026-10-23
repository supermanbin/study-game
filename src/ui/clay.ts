import type Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { BALL_COLORS, CLAY } from './palette';

// Soft-clay painter (spec docs/superpowers/specs/2026-10-23-clay-visual-design.md §4). The pure helpers at the top
// have no DOM access and are unit-tested; the painters below draw on a Canvas 2D at RENDER_SCALE once (Boot
// pre-bakes every fixed texture), register it as a Phaser texture and are displayed at 1/RENDER_SCALE.

// ---------------------------------------------------------------- pure helpers

const channels = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
const pack = (r: number, g: number, b: number): number => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

/** Moves every channel toward black (amount < 0) or white (amount > 0); -1 / 1 reach black / white. */
export function shade(color: number, amount: number): number {
  const a = Math.max(-1, Math.min(1, amount));
  return pack(...(channels(color).map(v => (a < 0 ? v * (1 + a) : v + (255 - v) * a)) as [number, number, number]));
}

/** '#rrggbb', or 'rgba(r,g,b,a)' when `alpha` is given. */
export function css(color: number, alpha?: number): string {
  if (alpha === undefined) return `#${color.toString(16).padStart(6, '0')}`;
  const [r, g, b] = channels(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Material metrics for an element of `size` (its smaller dimension, design px): drop-shadow offset and blur
 * (CSS-style blur length, i.e. ≈ 2σ), inner dark (lower right) and inner light (upper left) depths.
 */
export function clayParams(size: number): { dropX: number; dropY: number; dropBlur: number; dark: number; light: number } {
  return { dropX: 0.1 * size, dropY: 0.1 * size, dropBlur: 0.18 * size, dark: 0.11 * size, light: 0.09 * size };
}

const WARM_SHADOW = 0x96785a;
const WARM_DARK = 0xa08264;

/**
 * Shadow colours and alphas for a base colour. Saturated colours darken / lighten themselves (mockup: coral gets a
 * coral-brown shadow and a peachy-white light); near-neutral ones (panels, faded clay) take the mockup's warm
 * brown, because a darkened cream turns cool grey on the cream page.
 */
export function clayTones(color: number): {
  drop: number; dropAlpha: number; dark: number; darkAlpha: number; light: number; lightAlpha: number;
} {
  const [r, g, b] = channels(color);
  if (Math.max(r, g, b) - Math.min(r, g, b) < 0x30) {
    return { drop: WARM_SHADOW, dropAlpha: 0.3, dark: WARM_DARK, darkAlpha: 0.28, light: 0xffffff, lightAlpha: 0.85 };
  }
  return { drop: shade(color, -0.35), dropAlpha: 0.35, dark: shade(color, -0.5), darkAlpha: 0.35, light: shade(color, 0.65), lightAlpha: 0.7 };
}

const luminance = (c: number): number => {
  const [r, g, b] = channels(c).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio (1..21). */
export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Target with a little headroom over the 3:1 large-text minimum (anti-aliasing eats some contrast). */
const LABEL_CONTRAST = 3.2;
const LABEL_STROKE = 4;

/**
 * Ball label style (Review Focus 1). Coloured balls keep white numbers: white on these pastels alone is ~2:1, so
 * the glyphs get a thick outline in the ball colour darkened just enough for ≥ 3:1 against white. Near-neutral
 * balls (faded clay) use dark text instead: the faded text colour, darkened until it reaches 3:1 on the ball,
 * so grey balls still read as faded but their numbers stay legible.
 */
export function labelStyleFor(ball: number): { color: string; stroke: string; strokeThickness: number } {
  const [r, g, b] = channels(ball);
  if (Math.max(r, g, b) - Math.min(r, g, b) < 0x30) {
    let ink = CLAY.fadedText as number;
    for (let k = 0.05; contrastRatio(ink, ball) < LABEL_CONTRAST && k <= 1; k += 0.05) ink = shade(CLAY.fadedText, -k);
    return { color: css(ink), stroke: css(ball), strokeThickness: 0 };
  }
  let stroke = shade(ball, -0.3);
  for (let k = 0.35; contrastRatio(0xffffff, stroke) < LABEL_CONTRAST && k <= 1; k += 0.05) stroke = shade(ball, -k);
  return { color: '#ffffff', stroke: css(stroke), strokeThickness: LABEL_STROKE };
}

/**
 * Texture cache key: 'clay:kind:part:...'. Integer parts ≥ 0x10000 are written as 6-digit hex (colours), the rest
 * as given (sizes, scale).
 */
export function clayKey(kind: string, ...parts: (string | number)[]): string {
  const fmt = (p: string | number) =>
    typeof p === 'number' && Number.isInteger(p) && p >= 0x10000 ? p.toString(16).padStart(6, '0') : String(p);
  return ['clay', kind, ...parts.map(fmt)].join(':');
}

// ---------------------------------------------------------------- painters (DOM canvas)

export interface ClayTex {
  key: string;
  originX: number;
  originY: number;
}

const S = RENDER_SCALE;
/** Large panels would get huge, smeared shadows at 10% of their size; the mockup band (86 px) is the cap. */
const MAX_MATERIAL_SIZE = 100;

type Draw = (ctx: CanvasRenderingContext2D) => void;

function newCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('clay: no 2d context');
  return { canvas, ctx };
}

let filterOk: boolean | undefined;
/** `ctx.filter` blur is the fast, exact path; Safari < 18 lacks it, so fall back to an offscreen shadow. */
function filterSupported(): boolean {
  if (filterOk === undefined) {
    const { ctx } = newCanvas(1, 1);
    filterOk = typeof ctx.filter === 'string';
    if (filterOk) {
      ctx.filter = 'blur(2px)';
      filterOk = ctx.filter === 'blur(2px)';
    }
  }
  return filterOk;
}

/**
 * Draws `img` (device px) at device (x, y) blurred by σ device px, in `color` (img is a single-colour layer),
 * at `alpha`, with the context's current composite operation.
 */
function drawBlurred(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, sigma: number, color: number, alpha: number): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  if (sigma <= 0.01) {
    ctx.drawImage(img, x, y);
  } else if (filterSupported()) {
    ctx.filter = `blur(${sigma}px)`;
    ctx.drawImage(img, x, y);
  } else {
    // The shadow of an image drawn far off-canvas lands at (x, y): shadow offsets ignore the transform.
    const off = img.width + ctx.canvas.width + 100;
    ctx.shadowColor = css(color);
    ctx.shadowBlur = sigma * 2;
    ctx.shadowOffsetX = off;
    ctx.drawImage(img, x - off, y);
  }
  ctx.restore();
}

/** A layer of `color`: the silhouette (inverted = everything but the silhouette, `margin` px larger on each side). */
function tint(sil: HTMLCanvasElement, color: number, inverted: boolean, margin = 0): HTMLCanvasElement {
  const { canvas, ctx } = newCanvas(sil.width + 2 * margin, sil.height + 2 * margin);
  ctx.fillStyle = css(color);
  if (inverted) {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(sil, margin, margin);
  } else {
    ctx.drawImage(sil, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

interface PaintOpts {
  /** Inset: dark upper-left, light lower-right, no drop shadow (plus a faint white lip below). */
  inset?: boolean;
  /** Faded clay: softer drop shadow. */
  faded?: boolean;
  /** Scales the drop shadow (offset and blur); 0 = none. */
  drop?: number;
}

/**
 * Paints clay material for the silhouette drawn by `shape` (design coordinates, any fills or strokes in any
 * colour; only coverage counts) onto `target`, which is `w`×`h` design px at RENDER_SCALE. `size` drives the
 * material metrics (clayParams).
 */
function paintClay(target: CanvasRenderingContext2D, shape: Draw, color: number, size: number, opts: PaintOpts = {}): void {
  const W = target.canvas.width;
  const H = target.canvas.height;
  const p = clayParams(Math.min(size, MAX_MATERIAL_SIZE));
  const t = clayTones(color);

  const sil = newCanvas(W, H);
  sil.ctx.scale(S, S);
  sil.ctx.fillStyle = '#000';
  sil.ctx.strokeStyle = '#000';
  shape(sil.ctx);

  if (!opts.inset) {
    const k = (opts.drop ?? 1) * (opts.faded ? 0.8 : 1);
    if (k > 0) {
      drawBlurred(target, tint(sil.canvas, t.drop, false), p.dropX * k * S, p.dropY * k * S, (p.dropBlur / 2) * k * S, t.drop, opts.faded ? 0.25 : t.dropAlpha);
    }
  } else {
    // Mockup warning dot: `0 1px 0 #fff` — a pressed-in hole catches light on its lower lip.
    drawBlurred(target, tint(sil.canvas, 0xffffff, false), 0, Math.max(1, 0.08 * size) * S, 0.5 * S, 0xffffff, 0.8);
  }

  const body = newCanvas(W, H);
  body.ctx.drawImage(tint(sil.canvas, color, false), 0, 0);
  body.ctx.globalCompositeOperation = 'source-atop';
  const margin = Math.ceil((p.dark + p.dropBlur) * 2 * S) + 4;
  const layer = (c: number, alpha: number, depth: number, dir: 1 | -1) => {
    // The inverted silhouette shifted by `dir·depth` leaves a crescent of colour inside the opposite edge.
    const d = dir * depth * S;
    drawBlurred(body.ctx, tint(sil.canvas, c, true, margin), d - margin, d - margin, depth * 0.8 * S, c, alpha);
  };
  if (opts.inset) {
    layer(t.dark, Math.min(0.6, t.darkAlpha + 0.12), p.dark, 1);
    layer(t.light, t.lightAlpha * 0.8, p.light, -1);
  } else {
    layer(t.dark, t.darkAlpha, p.dark, -1);
    layer(t.light, t.lightAlpha, p.light, 1);
  }
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(body.canvas, 0, 0);
  target.restore();
}

/** Padding (design px) around a raised shape of `size` for its drop shadow: [low (top/left), high (bottom/right)]. */
function pads(size: number, inset = false): [number, number] {
  if (inset) return [2, Math.ceil(Math.max(1, 0.08 * size)) + 3];
  const p = clayParams(Math.min(size, MAX_MATERIAL_SIZE));
  const reach = 1.5 * p.dropBlur; // 3σ
  return [Math.ceil(Math.max(2, reach - p.dropX)) + 1, Math.ceil(p.dropX + reach) + 2];
}

/** Bakes `draw` on a (w + pads)×(h + pads) canvas, with the content box's (cx, cy) as the origin. */
function bake(scene: Phaser.Scene, key: string, w: number, h: number, size: number, inset: boolean, draw: (ctx: CanvasRenderingContext2D, ox: number, oy: number) => void, anchor = { x: w / 2, y: h / 2 }): ClayTex {
  const [lo, hi] = pads(size, inset);
  const tw = w + lo + hi;
  const th = h + lo + hi;
  const tex: ClayTex = { key, originX: (lo + anchor.x) / tw, originY: (lo + anchor.y) / th };
  if (scene.textures.exists(key)) return tex;
  const { canvas, ctx } = newCanvas(tw * S, th * S);
  ctx.scale(S, S);
  draw(ctx, lo, lo);
  scene.textures.addCanvas(key, canvas);
  return tex;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Rounded star: the polygon plus a round-joined outline, so the tips are soft like pressed clay. */
function roundStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const round = size * 0.14;
  starPath(ctx, cx, cy, size / 2 - round / 2, (size / 2 - round / 2) * 0.48);
  ctx.lineJoin = 'round';
  ctx.lineWidth = round;
  ctx.fill();
  ctx.stroke();
}

/**
 * Clay ball body (non-rotating shell): drop shadow outside `radius`, base, inner light upper-left and dark
 * lower-right. The origin is the ball centre, so it sits on the physics centre; the body edge is the collision
 * circle. `faded` = faded clay (grey pile balls), whatever `color` is.
 */
export function bakeBall(scene: Phaser.Scene, color: number, radius: number, faded = false): ClayTex {
  const base = faded ? CLAY.faded : color;
  const d = radius * 2;
  return bake(scene, clayKey(faded ? 'ballFaded' : 'ball', base, radius, S), d, d, d, false, (ctx, ox, oy) => {
    paintClay(ctx, c => circle(c, ox + radius, oy + radius, radius), base, d, { faded });
  });
}

/** Rotating overlay for a ball of `radius`: one short white matte bar near the top edge. Origin = ball centre. */
export function bakeStripe(scene: Phaser.Scene, radius: number): ClayTex {
  const key = clayKey('stripe', radius, S);
  const tex: ClayTex = { key, originX: 0.5, originY: 0.5 };
  if (scene.textures.exists(key)) return tex;
  const d = radius * 2;
  const { canvas, ctx } = newCanvas(d * S, d * S);
  ctx.scale(S, S);
  const w = Math.max(6, radius * 0.2);
  const h = radius * 0.36;
  ctx.fillStyle = css(0xffffff, 0.85);
  roundRectPath(ctx, radius - w / 2, radius * 0.12, w, h, w / 2);
  ctx.fill();
  scene.textures.addCanvas(key, canvas);
  return tex;
}

/** Raised (or `inset`) clay rounded rectangle, w×h design px, corner radius r. Origin = rect centre. */
export function bakeRoundRect(scene: Phaser.Scene, w: number, h: number, r: number, color: number, inset = false): ClayTex {
  const size = Math.min(w, h);
  return bake(scene, clayKey(inset ? 'rrInset' : 'rr', color, w, h, r, S), w, h, size, inset, (ctx, ox, oy) => {
    paintClay(ctx, c => { roundRectPath(c, ox, oy, w, h, r); c.fill(); }, color, size, { inset, faded: color === CLAY.faded });
  });
}

export type ClayShape =
  | 'star' | 'starOff' | 'lock' | 'monster' | 'monsterHurt' | 'chest' | 'peg' | 'dot' | 'hpOn' | 'hpOff'
  | 'particleBall' | 'particleStar';

/** Design sizes of the fixed shapes (the box the shape fills; shadows are padding outside it). */
export const SHAPE_SIZE: Record<ClayShape, { w: number; h: number }> = {
  star: { w: 44, h: 44 },
  starOff: { w: 44, h: 44 },
  lock: { w: 30, h: 36 },
  monster: { w: 62, h: 56 },
  monsterHurt: { w: 62, h: 56 },
  chest: { w: 60, h: 50 },
  peg: { w: 18, h: 18 },
  dot: { w: 10, h: 10 },
  hpOn: { w: 12, h: 16 },
  hpOff: { w: 12, h: 16 },
  particleBall: { w: 14, h: 14 },
  particleStar: { w: 20, h: 20 },
};

const DEFAULT_SHAPE_COLOR: Record<ClayShape, number> = {
  star: BALL_COLORS[3],
  starOff: CLAY.faded,
  lock: CLAY.peg,
  monster: CLAY.boss,
  monsterHurt: CLAY.boss,
  chest: CLAY.floor,
  peg: CLAY.peg,
  dot: CLAY.warnDot,
  hpOn: CLAY.hpOn,
  hpOff: CLAY.hpOff,
  particleBall: BALL_COLORS[0],
  particleStar: BALL_COLORS[3],
};

const EYE_INK = 0x4a3a6a;

function monsterFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, hurt: boolean): void {
  const ink = css(EYE_INK);
  const eyeY = cy - 3;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * 11;
    if (hurt) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 4, eyeY - 4);
      ctx.lineTo(ex + 4, eyeY + 4);
      ctx.moveTo(ex + 4, eyeY - 4);
      ctx.lineTo(ex - 4, eyeY + 4);
      ctx.stroke();
    } else {
      paintClay(ctx, c => circle(c, ex, eyeY, 7.5), 0xffffff, 15, { drop: 0.4 });
      ctx.fillStyle = ink;
      circle(ctx, ex + sx * -1.2, eyeY + 1, 3.6);
      ctx.fillStyle = '#ffffff';
      circle(ctx, ex + sx * -1.2 - 1.2, eyeY - 0.4, 1.2);
    }
  }
  // Rosy cheeks.
  ctx.fillStyle = css(0xf79ab0, 0.55);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * 19, cy + 7, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = ink;
  if (hurt) {
    // Small "o" of surprise.
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 4, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Cheeky lopsided grin with one tooth.
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 19, cx + 9, cy + 7);
    ctx.quadraticCurveTo(cx + 1, cy + 12, cx - 8, cy + 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy + 10.5);
    ctx.lineTo(cx + 5.5, cy + 9.3);
    ctx.lineTo(cx + 3.5, cy + 13);
    ctx.closePath();
    ctx.fill();
  }
}

/** Fixed clay shapes (stars, lock, boss, chest, pegs, warning dots, HP segments, particles). Origin = box centre. */
export function bakeShape(scene: Phaser.Scene, kind: ClayShape, color?: number): ClayTex {
  const col = color ?? DEFAULT_SHAPE_COLOR[kind];
  const { w, h } = SHAPE_SIZE[kind];
  const size = Math.min(w, h);
  const inset = kind === 'starOff' || kind === 'dot' || kind === 'hpOff';
  return bake(scene, clayKey(kind, col, S), w, h, size, inset, (ctx, ox, oy) => {
    const cx = ox + w / 2;
    const cy = oy + h / 2;
    switch (kind) {
      case 'star':
      case 'starOff':
      case 'particleStar':
        paintClay(ctx, c => roundStar(c, cx, cy + size * 0.03, size), col, size, { inset });
        break;
      case 'peg':
      case 'dot':
      case 'particleBall':
        paintClay(ctx, c => circle(c, cx, cy, size / 2), col, size, { inset });
        break;
      case 'hpOn':
      case 'hpOff':
        paintClay(ctx, c => { roundRectPath(c, ox, oy, w, h, 4); c.fill(); }, col, size, { inset });
        break;
      case 'lock': {
        const bodyY = oy + h * 0.42;
        paintClay(ctx, c => {
          // Shackle: a thick rounded arch, its feet hidden in the body.
          c.lineWidth = w * 0.2;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(cx - w * 0.27, bodyY + 2);
          c.lineTo(cx - w * 0.27, oy + h * 0.28);
          c.arc(cx, oy + h * 0.28, w * 0.27, Math.PI, 0);
          c.lineTo(cx + w * 0.27, bodyY + 2);
          c.stroke();
          roundRectPath(c, ox, bodyY, w, h - (bodyY - oy), 7);
          c.fill();
        }, col, size);
        // Keyhole.
        ctx.fillStyle = css(shade(col, -0.55), 0.8);
        const ky = bodyY + (h - (bodyY - oy)) * 0.42;
        circle(ctx, cx, ky, 3.2);
        roundRectPath(ctx, cx - 1.6, ky, 3.2, 7, 1.6);
        ctx.fill();
        break;
      }
      case 'monster':
      case 'monsterHurt':
        paintClay(ctx, c => {
          // Two small round ears behind a soft gumdrop body.
          circle(c, cx - 19, oy + 11, 8);
          circle(c, cx + 19, oy + 11, 8);
          c.beginPath();
          c.ellipse(cx, cy + 4, w / 2 - 1, h / 2 - 5, 0, 0, Math.PI * 2);
          c.fill();
        }, col, size);
        // Inner ears.
        ctx.fillStyle = css(shade(col, 0.45), 0.9);
        circle(ctx, cx - 19, oy + 11, 3.6);
        circle(ctx, cx + 19, oy + 11, 3.6);
        monsterFace(ctx, cx, cy + 2, kind === 'monsterHurt');
        break;
      case 'chest': {
        const lidH = h * 0.42;
        const wood = col;
        const gold = BALL_COLORS[3];
        paintClay(ctx, c => { roundRectPath(c, ox, oy + lidH - 2, w, h - lidH + 2, 8); c.fill(); }, wood, size);
        paintClay(ctx, c => {
          c.beginPath();
          c.moveTo(ox, oy + lidH);
          c.lineTo(ox, oy + lidH * 0.55);
          c.quadraticCurveTo(ox, oy, cx, oy);
          c.quadraticCurveTo(ox + w, oy, ox + w, oy + lidH * 0.55);
          c.lineTo(ox + w, oy + lidH);
          c.closePath();
          c.fill();
        }, shade(wood, 0.15), size, { drop: 0.35 });
        // Gold band along the lid seam and a clasp.
        paintClay(ctx, c => { roundRectPath(c, ox + 1, oy + lidH - 3, w - 2, 6, 3); c.fill(); }, gold, 12, { drop: 0.3 });
        paintClay(ctx, c => { roundRectPath(c, cx - 6, oy + lidH - 6, 12, 14, 4); c.fill(); }, gold, 12, { drop: 0.5 });
        ctx.fillStyle = css(shade(gold, -0.55), 0.75);
        circle(ctx, cx, oy + lidH + 1, 1.8);
        break;
      }
    }
  });
}

/** Image of a baked clay texture at (x, y), displayed at design size. */
export function clayImage(scene: Phaser.Scene, x: number, y: number, tex: ClayTex): Phaser.GameObjects.Image {
  return scene.add.image(x, y, tex.key).setOrigin(tex.originX, tex.originY).setScale(1 / S);
}

/** Ball radii in use: number balls and expression balls (= collision radii). */
const BALL_RADII = [42, 52];

/** Pre-bakes every fixed-size clay texture (call from Boot). Returns the elapsed ms. */
export function bakeAll(scene: Phaser.Scene): number {
  const t0 = performance.now();
  for (const r of BALL_RADII) {
    for (const c of BALL_COLORS) bakeBall(scene, c, r);
    bakeBall(scene, CLAY.faded, r, true);
    bakeStripe(scene, r);
  }
  for (const kind of Object.keys(SHAPE_SIZE) as ClayShape[]) {
    if (kind === 'particleBall' || kind === 'particleStar') {
      for (const c of BALL_COLORS) bakeShape(scene, kind, c);
    } else {
      bakeShape(scene, kind);
    }
  }
  return performance.now() - t0;
}
