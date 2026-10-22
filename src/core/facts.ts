import type { Fact, FactKey } from './types';

export const ALL_FACTS: readonly Fact[] = (() => {
  const out: Fact[] = [];
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) out.push({ a, b });
  return out;
})();

export function factKey(x: number, y: number): FactKey {
  return `${Math.min(x, y)}x${Math.max(x, y)}`;
}

export function parseFactKey(k: FactKey): Fact {
  const [a, b] = k.split('x').map(Number);
  return { a, b };
}

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function koujue(f: Fact): string {
  const p = f.a * f.b;
  const prefix = DIGITS[f.a] + DIGITS[f.b];
  const tens = Math.floor(p / 10);
  const ones = p % 10;
  if (p < 10) return `${prefix}得${DIGITS[p]}`;
  if (p === 10) return `${prefix}一十`;
  if (p < 20) return `${prefix}十${DIGITS[ones]}`;
  if (ones === 0) return `${prefix}${DIGITS[tens]}十`;
  return `${prefix}${DIGITS[tens]}十${DIGITS[ones]}`;
}
