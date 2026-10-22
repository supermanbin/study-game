import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { VOICE_CATEGORIES, VOICE_LINES, voicePath } from './voiceLines';

const EXPECTED = ['correct', 'combo3', 'combo5', 'combo10', 'wrong', 'missed', 'levelPass', 'levelFail', 'threeStars', 'bossAppear', 'bossDefeated', 'itemGet'];
const all = VOICE_CATEGORIES.flatMap((c) => VOICE_LINES[c]);

describe('voice lines', () => {
  it('has exactly the 12 categories', () => {
    expect([...VOICE_CATEGORIES].sort()).toEqual([...EXPECTED].sort());
    expect(Object.keys(VOICE_LINES).sort()).toEqual([...EXPECTED].sort());
  });
  it('has enough lines per category and a sane total', () => {
    for (const c of VOICE_CATEGORIES) {
      const min = c === 'correct' || c === 'wrong' ? 4 : 2;
      expect(VOICE_LINES[c].length, c).toBeGreaterThanOrEqual(min);
    }
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(all.length).toBeLessThanOrEqual(50);
  });
  it('ids are unique and well-formed', () => {
    const ids = all.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it('gentle categories avoid forbidden words', () => {
    for (const c of ['wrong', 'missed', 'levelFail'] as const)
      for (const l of VOICE_LINES[c])
        for (const w of ['笨', '错了', '不行', '差劲', '失败']) expect(l.text).not.toContain(w);
  });
  it('every id has a non-empty mp3', () => {
    for (const l of all) {
      const p = resolve(process.cwd(), 'public', voicePath(l.id));
      expect(statSync(p).size, l.id).toBeGreaterThan(0);
    }
  });
});
