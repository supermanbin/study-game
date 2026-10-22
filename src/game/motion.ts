/** Motion detectors for resting, stuck and out-of-field balls. Pure TypeScript, no Phaser import. */

/** Speed (px per frame, engine units) below which a supported ball counts as resting. */
export const REST_SPEED = 0.8;
/** Continuous rest required before a correct ball counts as missed. */
export const REST_MISS_MS = 1500;
/** Slow-but-unsupported time before a ball is nudged. */
export const STUCK_NUDGE_MS = 1000;

const FIELD_MARGIN = 100;
const GROUND_MARGIN = 200;

/** A ball is resting when it is supported (ground or pile) and slower than REST_SPEED. */
export function isResting(speed: number, supported: boolean): boolean {
  return supported && speed < REST_SPEED;
}

/** Accumulates continuous resting time. Any non-resting frame resets it. */
export class RestTimer {
  private acc = 0;

  /** Advances by dtMs when resting, otherwise resets. Returns the accumulated time. */
  update(dtMs: number, resting: boolean): number {
    this.acc = resting ? this.acc + dtMs : 0;
    return this.acc;
  }

  get ms(): number {
    return this.acc;
  }

  reset(): void {
    this.acc = 0;
  }
}

/** Detects a ball that is slow but unsupported for STUCK_NUDGE_MS. Fires once, then resets. */
export class StuckTimer {
  private acc = 0;

  /** Returns true on the frame the nudge threshold is reached, and resets the accumulation. */
  update(dtMs: number, slow: boolean, supported: boolean): boolean {
    if (!(slow && !supported)) {
      this.acc = 0;
      return false;
    }
    this.acc += dtMs;
    if (this.acc >= STUCK_NUDGE_MS) {
      this.acc = 0;
      return true;
    }
    return false;
  }
}

/** True when a ball has left the playfield: past either side by 100 px or below the ground by 200 px. */
export function outOfField(x: number, y: number, width: number, groundY: number): boolean {
  return x < -FIELD_MARGIN || x > width + FIELD_MARGIN || y > groundY + GROUND_MARGIN;
}

/**
 * Supported balls for one frame: the grounded ones plus everything reachable from them through this
 * frame's ball-ball contacts. Support is never carried over from earlier frames, so balls that only touch
 * each other (e.g. a pair resting on pegs) are unsupported.
 */
export function groundedSet<T>(pairs: Iterable<readonly [T, T]>, grounded: Iterable<T>): Set<T> {
  const adj = new Map<T, T[]>();
  const link = (a: T, b: T) => {
    const l = adj.get(a);
    if (l) l.push(b);
    else adj.set(a, [b]);
  };
  for (const [a, b] of pairs) {
    link(a, b);
    link(b, a);
  }
  const out = new Set<T>(grounded);
  const queue = [...out];
  while (queue.length > 0) {
    for (const n of adj.get(queue.pop()!) ?? []) {
      if (!out.has(n)) {
        out.add(n);
        queue.push(n);
      }
    }
  }
  return out;
}
