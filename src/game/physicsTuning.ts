/** Physics tuning model for the marble-style physics upgrade. Pure TypeScript, no Phaser import. */

export type LaunchMode = 'toss' | 'drop';

export interface PhysicsTuning {
  gravity: number;
  bounce: number;
  air: number;
  pegs: boolean;
  launch: LaunchMode;
}

export const DEFAULT_TUNING: PhysicsTuning = {
  gravity: 1,
  bounce: 0.75,
  air: 0.004,
  pegs: true,
  launch: 'toss',
};

export const TUNING_RANGES = {
  gravity: [0.3, 2] as [number, number],
  bounce: [0.2, 0.95] as [number, number],
  air: [0, 0.04] as [number, number],
};

export const TUNING_STORAGE_KEY = 'funy-app:physics-tuning';

function clampNumber(raw: unknown, [min, max]: [number, number], fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/** Per-field parse: valid values are clamped to range, invalid or missing fields take the default. */
export function parseTuning(raw: unknown): PhysicsTuning {
  const src: Partial<Record<keyof PhysicsTuning, unknown>> =
    raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    gravity: clampNumber(src.gravity, TUNING_RANGES.gravity, DEFAULT_TUNING.gravity),
    bounce: clampNumber(src.bounce, TUNING_RANGES.bounce, DEFAULT_TUNING.bounce),
    air: clampNumber(src.air, TUNING_RANGES.air, DEFAULT_TUNING.air),
    pegs: typeof src.pegs === 'boolean' ? src.pegs : DEFAULT_TUNING.pegs,
    launch: src.launch === 'toss' || src.launch === 'drop' ? src.launch : DEFAULT_TUNING.launch,
  };
}

/** Reads tuning from storage. Missing storage, missing key, bad JSON, or any throw yields defaults. */
export function loadTuning(storage: Storage | null): PhysicsTuning {
  if (!storage) return { ...DEFAULT_TUNING };
  try {
    const text = storage.getItem(TUNING_STORAGE_KEY);
    if (text === null) return { ...DEFAULT_TUNING };
    return parseTuning(JSON.parse(text));
  } catch {
    return { ...DEFAULT_TUNING };
  }
}

/** Persists tuning to storage. Errors (quota, security, null storage) are swallowed. */
export function saveTuning(storage: Storage | null, t: PhysicsTuning): void {
  if (!storage) return;
  try {
    storage.setItem(TUNING_STORAGE_KEY, JSON.stringify(t));
  } catch {
    // Persisting tuning is best-effort.
  }
}
