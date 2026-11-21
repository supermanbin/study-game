import { PEG_RADIUS } from '../game/tuning';
import type { FieldLayout } from './game';

/** Peg centres: staggered rows (counts from `field.pegCounts`), `pegSpacing` apart, centred across the width. */
export function pegPositions(field: FieldLayout): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  field.pegRowsY.forEach((y, r) => {
    const n = field.pegCounts[r % 2];
    const x0 = (field.width - (n - 1) * field.pegSpacing) / 2;
    for (let i = 0; i < n; i++) out.push({ x: x0 + i * field.pegSpacing, y });
  });
  return out;
}

/**
 * Returns an x near `x` where a ball of radius `r` centred at height `y` does not overlap any row-0 peg,
 * staying inside [min, max]. Shifts away from the offending peg, or the other way when that leaves the range.
 */
export function clearOfPegsX(x: number, y: number, r: number, min: number, max: number, field: FieldLayout): number {
  const row0Y = field.pegRowsY[0];
  const minD = r + PEG_RADIUS + 2;
  const dy = Math.abs(row0Y - y);
  let out = Math.min(max, Math.max(min, x));
  if (dy >= minD) return out;
  const needDx = Math.sqrt(minD * minD - dy * dy) + 1;
  for (const p of pegPositions(field)) {
    if (p.y !== row0Y || Math.abs(out - p.x) >= needDx) continue;
    const away = out >= p.x ? p.x + needDx : p.x - needDx;
    const other = out >= p.x ? p.x - needDx : p.x + needDx;
    out = away >= min && away <= max ? away : other;
  }
  return out;
}
