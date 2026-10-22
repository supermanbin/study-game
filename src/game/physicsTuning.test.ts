import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  TUNING_STORAGE_KEY,
  loadTuning,
  parseTuning,
  saveTuning,
} from './physicsTuning';

function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  };
}

describe('physics tuning constants', () => {
  it('defaults match the plan', () => {
    expect(DEFAULT_TUNING).toEqual({ gravity: 1, bounce: 0.75, air: 0.004, pegs: true, launch: 'toss' });
    expect(TUNING_STORAGE_KEY).toBe('funy-app:physics-tuning');
  });
});

describe('parseTuning', () => {
  it('undefined yields defaults', () => {
    expect(parseTuning(undefined)).toEqual(DEFAULT_TUNING);
  });

  it('clamps out-of-range values and replaces invalid ones per field', () => {
    expect(parseTuning({ gravity: 99, bounce: 0.1, air: -1, pegs: 'x', launch: 'fly' })).toEqual({
      gravity: 2,
      bounce: 0.2,
      air: 0,
      pegs: true,
      launch: 'toss',
    });
  });

  it('missing fields fall back to defaults', () => {
    expect(parseTuning({ gravity: 0.5 })).toEqual({ ...DEFAULT_TUNING, gravity: 0.5 });
  });

  it('accepts a valid drop launch and pegs false', () => {
    expect(parseTuning({ launch: 'drop', pegs: false })).toEqual({ ...DEFAULT_TUNING, launch: 'drop', pegs: false });
  });
});

describe('loadTuning / saveTuning', () => {
  it('round-trips through storage', () => {
    const s = fakeStorage();
    const t = { gravity: 1.5, bounce: 0.9, air: 0.02, pegs: false, launch: 'drop' as const };
    saveTuning(s, t);
    expect(loadTuning(s)).toEqual(t);
  });

  it('bad JSON yields defaults', () => {
    const s = fakeStorage();
    s.setItem(TUNING_STORAGE_KEY, '{bad');
    expect(loadTuning(s)).toEqual(DEFAULT_TUNING);
  });

  it('null storage yields defaults', () => {
    expect(loadTuning(null)).toEqual(DEFAULT_TUNING);
  });

  it('saveTuning swallows setItem errors', () => {
    const s = fakeStorage();
    s.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => saveTuning(s, DEFAULT_TUNING)).not.toThrow();
    expect(() => saveTuning(null, DEFAULT_TUNING)).not.toThrow();
  });
});
