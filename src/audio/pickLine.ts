import type { Rng } from '../core/rng';

/** Pick a random line, never the one with `lastId` when more than one is available. */
export function pickLine<T extends { id: string }>(lines: T[], lastId: string | undefined, rng: Rng): T {
  if (lines.length === 1) return lines[0];
  const pool = lines.filter((l) => l.id !== lastId);
  const src = pool.length > 0 ? pool : lines;
  return src[Math.min(src.length - 1, Math.floor(rng() * src.length))];
}

export class Throttle {
  private last = -Infinity;
  constructor(private readonly intervalMs: number) {}

  allow(nowMs: number): boolean {
    if (nowMs - this.last < this.intervalMs) return false;
    this.last = nowMs;
    return true;
  }
}
