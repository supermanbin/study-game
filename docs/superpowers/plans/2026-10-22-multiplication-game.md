# 九九乘法闯关小游戏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A desktop-browser game where 2nd-graders click the correct falling answer (Matter.js physics) across 6 sequential levels covering 表内乘法、反向、乘加乘减、表内除法, with AI voice feedback and progress saved locally.

**Architecture:** All game rules live in framework-free TypeScript under `src/core/` (question generation, level session state machine, scoring, stats, progress data) and are unit-tested with Vitest. Phaser 3 scenes under `src/scenes/` and helpers under `src/game/` are thin: they render, run physics, and forward clicks/landings to a `LevelSession`. Persistence goes through an async `ProgressStore` interface so a server-backed store can replace `LocalStorageProgressStore` later.

**Tech Stack:** TypeScript, Vite, Phaser 3 (Matter.js physics), Vitest, Playwright, edge-tts (Python CLI, build-time voice generation only).

**Spec:** `docs/superpowers/specs/2026-10-22-multiplication-game-design.md`

## Global Constraints

- Desktop Chrome/Edge latest; mouse + keyboard only; no touch work.
- All UI text and voice lines in Chinese (简体).
- Fully offline after first load: no runtime network requests, no CDN fonts/assets; voice is pre-generated mp3 in `public/audio/voice/`.
- Design resolution 1280×720, `Phaser.Scale.FIT` + `CENTER_BOTH`.
- 20 questions per level; pass = ≥16 first-try correct within the time limit; 2★ ≥18; 3★ = 20.
- Time limit: levels 1–2 = 150 s, levels 3–6 = 120 s. Time running out = fail, even with ≥16 correct so far.
- Correct (first try) = +10 × combo multiplier (combo ≥3 ×1.5, ≥5 ×2, ≥10 ×3, rounded). Wrong = −5, score never below 0. Late correct (after a wrong click) = 0 points and counts as 答错.
- Wrong click → 500 ms click lockout.
- Time bonus on pass: +1 per whole remaining second.
- Boss levels 3 and 6; boss HP 16; level continues to question 20 after defeat.
- 乘加乘减: `a×b±c`, a,b ∈ 1..9, c ∈ 1..20, result ∈ 0..100. 除法: divisor and quotient ∈ 1..9, no remainder. Reverse mode (玩法 B) is multiplication only, and **every** option whose product equals the target is correct.
- Cards: 45 口诀 (a ≤ b); a card lights at 3 first-try-correct answers on that fact, across all question kinds.
- Items: freeze (5 s, time scale 0.5 for fall and countdown), magnifier (removes one wrong option). Awarded at combo 5 (freeze) and combo 10 (magnifier). Keys `1`/`2`. Items reset each level.
- Pile overflow: pile above warning line continuously for 2000 ms = fail.
- Keyboard: Space pause/resume, Esc back to level select, 1/2 items.
- Wrong/fail feedback must be gentle: no negative score, no scolding words.
- Effects must not cover the question text or HUD, and each lasts ≤ 800 ms.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Reverse-mode targets with several factorizations (e.g. 12, 24, 36):** every option whose product equals the target must be marked correct; a child clicking `3 × 4` for 12 must never be told it's wrong. → property test in Task 4.
2. **Corrupt, old-version, or unavailable localStorage** (bad JSON, private mode throwing on access, quota errors on save): the game starts with default progress and keeps running. → tests in Task 6.
3. **Rapid or double clicks:** double-clicking the correct option, clicking a greyed option, clicking during lockout, or clicking after the question/level ended must never score twice or advance two questions. → tests in Task 5.
4. **Window blur or tab hidden mid-level:** the countdown and physics pause and resume on return; the child doesn't lose time while away. → test in Task 5 (pause semantics) + e2e in Task 9.
5. **Distractors that equal the answer, duplicate, or go negative** (small answers like 1×1, 2×1, `a×b−c` = 0, division answers near 1): options must stay unique, non-negative, and only the real answer correct. → property test in Task 4.

---

## File Structure

```
index.html
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, .gitignore
CLAUDE.md, README.md
content/voice-lines.json          # voice script, single source for TTS + runtime
scripts/tts/generate.mjs          # batch TTS driver (provider-agnostic)
scripts/tts/providers/edge.mjs    # edge-tts provider
public/audio/voice/*.mp3          # generated, committed
src/main.ts                       # Phaser.Game config, scene list
src/config.ts                     # GAME_WIDTH/HEIGHT, palette, font stack
src/core/                         # pure logic, no Phaser imports
  rng.ts  types.ts  facts.ts  levels.ts  stats.ts  questions.ts  session.ts  progress.ts  store.ts
src/audio/
  voiceLines.ts  pickLine.ts  synth.ts  AudioService.ts
src/game/                         # Phaser helpers for GameScene
  tuning.ts  OptionBody.ts  pile.ts  Hud.ts  effects.ts  Boss.ts  debug.ts
src/ui/Button.ts
src/scenes/
  BootScene.ts  MenuScene.ts  LevelSelectScene.ts  GameScene.ts  ResultScene.ts  CardsScene.ts  SettingsScene.ts
e2e/*.spec.ts
```

Unit tests are colocated: `src/core/foo.ts` → `src/core/foo.test.ts`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.gitignore`, `index.html`, `src/main.ts`, `src/config.ts`, `src/scenes/BootScene.ts`, `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `GAME_WIDTH = 1280`, `GAME_HEIGHT = 720`, `FONT_FAMILY = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif'` from `src/config.ts`. npm scripts `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`).

- [ ] **Step 1:** `git init` in `/Users/db/Documents/code/funy-app`. `.gitignore`: `node_modules/`, `dist/`, `.superpowers/`, `test-results/`, `playwright-report/`.
- [ ] **Step 2:** `npm init -y`; install `phaser@^3` (runtime) and `typescript vite vitest @playwright/test` (dev); `npx playwright install chromium`. `"type": "module"`. Vitest config in `vite.config.ts` (`test.include: ['src/**/*.test.ts']`, environment `node`). Playwright `webServer` runs `npm run dev -- --port 5199` and uses `baseURL http://localhost:5199`.
- [ ] **Step 3: Write the failing e2e smoke test** `e2e/smoke.spec.ts`:

```ts
test('boots to a canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 4:** Run `npm run test:e2e`. Expected: FAIL (no canvas).
- [ ] **Step 5:** Implement `src/main.ts` (Phaser.AUTO, 1280×720, `Scale.FIT`, `CENTER_BOTH`, `physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 } } }`, scenes `[BootScene]`) and `BootScene` showing the title text 「九九乘法闯关」 centered on a light background.
- [ ] **Step 6:** Run `npm run test:e2e && npm run typecheck && npm run build`. Expected: all pass.
- [ ] **Step 7:** Commit (include the existing `docs/` folder): `git add -A && git commit -m "chore: scaffold Vite + Phaser + Vitest + Playwright"`.

---

### Task 2: Facts, RNG, and level definitions

**Files:**
- Create: `src/core/rng.ts`, `src/core/types.ts`, `src/core/facts.ts`, `src/core/levels.ts`
- Test: `src/core/facts.test.ts`, `src/core/levels.test.ts`, `src/core/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number` (in `[0,1)`); `mulberry32(seed: number): Rng`; `randInt(rng, min, max): number` (inclusive); `shuffle<T>(rng, arr: readonly T[]): T[]` (returns a new array).
  - `types.ts`: `interface Fact { a: number; b: number }` (1 ≤ a ≤ b ≤ 9); `type FactKey = \`${number}x${number}\``; `type QuestionKind = 'mul' | 'reverse' | 'div' | 'mulAddSub'`; `type StatKey = \`${FactKey}:${QuestionKind}\``; `type LevelId = 1|2|3|4|5|6`.
  - `facts.ts`: `ALL_FACTS: readonly Fact[]` (45, a ≤ b); `factKey(x: number, y: number): FactKey` (order-normalized, `factKey(4,3) === '3x4'`); `parseFactKey(k: FactKey): Fact`; `koujue(f: Fact): string`.
  - `levels.ts`: constants `QUESTIONS_PER_LEVEL = 20`, `PASS_CORRECT = 16`, `TWO_STAR_CORRECT = 18`, `THREE_STAR_CORRECT = 20`, `BOSS_HP = 16`; `interface LevelSpec { id: LevelId; name: string; kinds: QuestionKind[]; facts: Fact[]; timeLimitSec: number; boss: boolean }`; `LEVELS: readonly LevelSpec[]`; `getLevel(id: LevelId): LevelSpec`.

- [ ] **Step 1: Write failing tests.**

```ts
// facts.test.ts
expect(ALL_FACTS).toHaveLength(45);
expect(factKey(4, 3)).toBe('3x4');
expect(parseFactKey('3x4')).toEqual({ a: 3, b: 4 });
it.each([
  [1,1,'一一得一'], [3,3,'三三得九'], [2,5,'二五一十'], [3,4,'三四十二'],
  [4,5,'四五二十'], [5,5,'五五二十五'], [6,9,'六九五十四'], [9,9,'九九八十一'],
])('koujue %i×%i', (a, b, s) => expect(koujue({ a, b })).toBe(s));

// levels.test.ts
expect(LEVELS.map(l => l.id)).toEqual([1,2,3,4,5,6]);
expect(getLevel(1).facts).toHaveLength(15);            // b ≤ 5
expect(getLevel(1).facts.every(f => f.b <= 5)).toBe(true);
expect(getLevel(2).facts).toHaveLength(30);            // b ≥ 6
expect(getLevel(2).facts.every(f => f.b >= 6)).toBe(true);
expect(LEVELS.map(l => l.timeLimitSec)).toEqual([150,150,120,120,120,120]);
expect(LEVELS.filter(l => l.boss).map(l => l.id)).toEqual([3,6]);
expect(LEVELS.map(l => l.kinds)).toEqual([
  ['mul'], ['mul'], ['mul','reverse'], ['mulAddSub'], ['div'], ['mul','reverse','mulAddSub','div'],
]);

// rng.test.ts
const a = mulberry32(42), b = mulberry32(42);
expect([a(), a(), a()]).toEqual([b(), b(), b()]);
// randInt stays in [min,max] over 1000 draws and hits both ends
```

- [ ] **Step 2:** `npx vitest run src/core` → FAIL (modules missing).
- [ ] **Step 3: Implement.** Levels 3–6 use all 45 facts. Level names: 「1～5 的乘法」「6～9 的乘法」「乘法大挑战」「乘加乘减」「表内除法」「终极大混战」. `koujue` rule (product p): p < 10 → `得`+digit; p = 10 → `一十`; 11–19 → `十`+ones; multiple of 10 → tens+`十`; otherwise tens+`十`+ones. Prefix is the two Chinese digits of a, b.
- [ ] **Step 4:** `npx vitest run src/core` → PASS.
- [ ] **Step 5:** Commit `feat(core): facts, rng, level definitions`.

---

### Task 3: Answer stats and weighted picking (错题回流)

**Files:**
- Create: `src/core/stats.ts`
- Test: `src/core/stats.test.ts`

**Interfaces:**
- Consumes: `Fact`, `QuestionKind`, `StatKey`, `Rng`, `factKey` (Task 2).
- Produces:
  - `type QuestionResult = 'correct' | 'wrong' | 'missed'`
  - `interface StatRecord { correct: number; wrong: number; missed: number; streak: number }`
  - `type StatsMap = Partial<Record<StatKey, StatRecord>>`
  - `statKey(f: Fact, kind: QuestionKind): StatKey`
  - `recordResult(stats: StatsMap, key: StatKey, r: QuestionResult): StatsMap` (returns new map; correct → `correct++`, `streak++`; wrong/missed → count++, `streak = 0`)
  - `weightOf(rec: StatRecord | undefined): number` = `1 + min(rec.wrong + rec.missed, 4) * 0.5 ** rec.streak`; undefined → 1
  - `pickWeighted<T>(items: readonly T[], weight: (t: T) => number, rng: Rng): T`

- [ ] **Step 1: Write failing tests.**

```ts
expect(statKey({ a: 3, b: 4 }, 'div')).toBe('3x4:div');
expect(weightOf(undefined)).toBe(1);
expect(weightOf({ correct: 0, wrong: 2, missed: 0, streak: 0 })).toBe(3);
expect(weightOf({ correct: 1, wrong: 2, missed: 0, streak: 1 })).toBe(2);
expect(weightOf({ correct: 0, wrong: 9, missed: 3, streak: 0 })).toBe(5);   // capped
let s = recordResult({}, '3x4:mul', 'wrong');
s = recordResult(s, '3x4:mul', 'correct');
expect(s['3x4:mul']).toEqual({ correct: 1, wrong: 1, missed: 0, streak: 1 });
s = recordResult(s, '3x4:mul', 'missed');
expect(s['3x4:mul']!.streak).toBe(0);
// pickWeighted: items ['a','b'], weights 1 and 3
expect(pickWeighted(['a','b'], x => x === 'a' ? 1 : 3, () => 0.2)).toBe('a');
expect(pickWeighted(['a','b'], x => x === 'a' ? 1 : 3, () => 0.5)).toBe('b');
// recordResult does not mutate its input
```

- [ ] **Step 2:** `npx vitest run src/core/stats.test.ts` → FAIL.
- [ ] **Step 3:** Implement in `src/core/stats.ts`.
- [ ] **Step 4:** Run again → PASS.
- [ ] **Step 5:** Commit `feat(core): per-fact answer stats and weighted picking`.

---

### Task 4: Question generation

**Files:**
- Create: `src/core/questions.ts`
- Test: `src/core/questions.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `interface QuestionOption { id: number; label: string; correct: boolean }`
  - `interface Question { kind: QuestionKind; fact: Fact; statKey: StatKey; prompt: string; answer: number; answerText: string; options: QuestionOption[] }`. `answer` is the numeric answer for mul/div/mulAddSub and the target product for reverse. `answerText` is the full solved line shown on a miss, e.g. `3 × 9 = 27`, `12 = 3 × 4`.
  - `interface Difficulty { optionCount: 4 | 5 | 6; closeRatio: number; fallSpeed: number }`
  - `difficultyAt(index: number): Difficulty`: optionCount 4 for index 0–6, 5 for 7–13, 6 for 14–19; `closeRatio = index / 19`; `fallSpeed = 1 + 0.6 * index / 19`.
  - `generateQuestion(level: LevelSpec, index: number, stats: StatsMap, rng: Rng, avoid?: StatKey): Question`
  - `evalLabel(label: string): number` (parses `27` or `3 × 4`; used by tests and debug hook)

Prompt and label formats (use `×` U+00D7, `÷` U+00F7, `−` U+2212, spaces around operators):
- mul: `3 × 9 = ?` (factor order random); labels are numbers.
- reverse: `12 = ? × ?`; labels `3 × 4`.
- div: `36 ÷ 4 = ?` (divisor randomly a or b).
- mulAddSub: `3 × 4 + 2 = ?` / `5 × 6 − 3 = ?`.

Algorithm (the tests don't pin this down):
1. Candidates = `level.facts × level.kinds` as StatKeys, excluding `avoid` when more than one candidate remains. Pick with `pickWeighted(..., k => weightOf(stats[k]), rng)`.
2. Numeric distractors: for each slot, with probability `closeRatio`, draw from the *close pool* (answer ±1, ±2, ±a, ±b, digit-swap if two digits). Otherwise draw from the *far pool* (random ints in `[0, max(answer + 30, 20)]` at distance ≥ 5 from the answer). Always non-negative, unique, and ≠ answer.
3. Reverse: correct labels are 1–2 distinct factorizations `x × y` (x, y ∈ 1..9, x·y = target, both orders count as distinct labels). Distractors are `x × y` with product ≠ target; close = product within ±6 or sharing a factor. **`correct` is set by `evalLabel(label) === target`, never by construction order.**
4. Shuffle options; ids `0..n-1` after shuffling.

- [ ] **Step 1: Write failing tests**, including the Review Focus 1 and 5 property test:

```ts
test.each(LEVELS.map(l => [l.id, l]))('level %i invariants', (_, level) => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = mulberry32(seed);
    for (let i = 0; i < 20; i++) {
      const q = generateQuestion(level, i, {}, rng);
      expect(level.kinds).toContain(q.kind);
      expect(level.facts).toContainEqual(q.fact);
      expect(q.options).toHaveLength(difficultyAt(i).optionCount);
      expect(new Set(q.options.map(o => o.label)).size).toBe(q.options.length);
      for (const o of q.options) {
        expect(o.correct).toBe(evalLabel(o.label) === q.answer);  // truth, not construction
        expect(evalLabel(o.label)).toBeGreaterThanOrEqual(0);
      }
      const nCorrect = q.options.filter(o => o.correct).length;
      if (q.kind === 'reverse') expect(nCorrect).toBeGreaterThanOrEqual(1);
      else expect(nCorrect).toBe(1);
    }
  }
});
```

Also:
- mulAddSub: parse the prompt; `c ∈ 1..20`, answer `∈ 0..100`.
- div: divisor and quotient `∈ 1..9`, dividend = divisor × quotient.
- Prompt regexes per kind: `/^\d × \d = \?$/`, `/^\d+ = \? × \?$/`, `/^\d+ ÷ \d = \?$/`, `/^\d × \d [+−] \d+ = \?$/`.
- `generateQuestion(getLevel(1), 0, {}, rng, '2x3:mul')` never returns statKey `'2x3:mul'` across 200 seeds.
- Weighting: on level 1 with `stats = { '2x3:mul': { correct:0, wrong:8, missed:0, streak:0 } }`, `'2x3:mul'` frequency over 3000 draws is > 0.15 (baseline 1/15).
- `difficultyAt(0)` → `{ optionCount: 4, closeRatio: 0, fallSpeed: 1 }`; `difficultyAt(19).optionCount === 6`.
- `evalLabel('3 × 4') === 12`, `evalLabel('27') === 27`.
- `answerText`: for mul `3 × 9 = ?` it is `3 × 9 = 27`.

- [ ] **Step 2:** `npx vitest run src/core/questions.test.ts` → FAIL.
- [ ] **Step 3:** Implement `src/core/questions.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): question generation for all four kinds`.

---

### Task 5: Level session state machine

**Files:**
- Create: `src/core/session.ts`
- Test: `src/core/session.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:

```ts
type ItemKind = 'freeze' | 'magnifier';
type SessionStatus = 'playing' | 'paused' | 'won' | 'lost';
type FailReason = 'time' | 'pile' | 'notEnough';
interface QuestionOutcome { statKey: StatKey; factKey: FactKey; result: QuestionResult }
interface ClickResult {
  kind: 'correct' | 'lateCorrect' | 'wrong' | 'ignored';
  scoreDelta: number; combo: number; awardedItem?: ItemKind; questionEnded: boolean;
}
interface LevelResult {
  levelId: LevelId; passed: boolean; failReason?: FailReason;
  correctCount: number; score: number; timeBonus: number; totalScore: number; stars: 0|1|2|3;
}
class LevelSession {
  constructor(level: LevelSpec, opts: { rng: Rng; stats: () => StatsMap; onOutcome?: (o: QuestionOutcome) => void });
  readonly level: LevelSpec;
  question: Question; questionIndex: number; score: number; combo: number; correctCount: number;
  timeLeftMs: number; status: SessionStatus; failReason?: FailReason;
  items: Record<ItemKind, number>; freezeLeftMs: number;
  click(optionId: number, nowMs: number): ClickResult;
  miss(): void;                      // scene: all correct options of current question landed
  tick(dtMs: number): void;          // countdown (scaled), freeze timer (unscaled)
  timeScale(): number;               // 0.5 while freeze active, else 1
  useFreeze(): boolean;
  useMagnifier(activeOptionIds: number[]): number | null;
  failByPile(): void;
  pause(): void; resume(): void;
  bossHp(): number;                  // max(0, BOSS_HP - correctCount)
  result(): LevelResult;             // throws unless status is won/lost
}
```

Rules:
- A question ends on a correct or late-correct click, or on `miss()`. Then call `onOutcome` once with `correct` (first-try correct), `wrong` (any wrong click happened, even if later answered or missed), or `missed`. Then `questionIndex++`. At 20: `won` if `correctCount >= 16`, else `lost/notEnough`. Otherwise generate the next question with `avoid` = previous statKey.
- `click` returns `ignored` when: status ≠ playing; `nowMs < lockUntil`; option id is unknown, already clicked wrong, or removed by magnifier.
- `result()`: `timeBonus = passed ? floor(timeLeftMs/1000) : 0`. Stars only if passed: ≥20 → 3, ≥18 → 2, else 1.

- [ ] **Step 1: Write failing tests.** Use helpers `correctId(s)` / `wrongId(s)` that read `s.question.options`.
  - First correct → `{ kind:'correct', scoreDelta:10, combo:1, questionEnded:true }`, `questionIndex === 1`.
  - Ten correct in a row: deltas `[10,10,15,15,20,20,20,20,20,30]`, score 180. `awardedItem: 'freeze'` on the 5th, `'magnifier'` on the 10th; `items` = `{freeze:1, magnifier:1}`.
  - First click wrong at t=0 → `scoreDelta 0`, score stays 0, combo 0. Click at t=499 → `ignored`. A correct click at t=500 → `lateCorrect`, delta 0, `correctCount` unchanged, outcome `wrong`.
  - Wrong after score 10 → delta −5, score 5.
  - **Review Focus 3:** clicking the same correct id twice in one ms → second is `ignored`, and `questionIndex` advanced only once. Clicking an already-wrong id again (after lockout) → `ignored`. Clicking an old question's option id is a known gap: ids restart at 0 each question. The scene must not forward clicks from options of resolved questions (Task 9 handles this). Note that in a comment in the test.
  - `miss()` → combo 0, outcome `missed`, next question.
  - Play to 20 with exactly 16 / 18 / 20 first-try correct (rest via `miss()`) → `won` with stars 1 / 2 / 3. With 15 → `lost`, `failReason 'notEnough'`, stars 0.
  - `tick(150_000)` on level 1 → `lost`, `'time'`. Later clicks are `ignored`.
  - **Review Focus 4:** `pause()` then `tick(10_000)` → `timeLeftMs` unchanged; after `resume()`, `tick(1000)` reduces it by 1000.
  - `useFreeze()` with 0 items → false. With 1 item: `timeScale() === 0.5`, `tick(1000)` reduces time by 500. After a total of 5000 ms of ticks, `timeScale() === 1`.
  - `useMagnifier(allIds)` returns a non-correct id and decrements the item. Clicking that id afterwards → `ignored`. `useMagnifier([correctId])` → `null` and the item is not consumed.
  - Win with `timeLeftMs = 30_400` → `timeBonus 30`, `totalScore = score + 30`.
  - `failByPile()` → `lost/'pile'`.
  - `bossHp()` → 16 at start, 0 after ≥16 correct.
- [ ] **Step 2:** `npx vitest run src/core/session.test.ts` → FAIL.
- [ ] **Step 3:** Implement `src/core/session.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): level session with scoring, combo, items, timer`.

---

### Task 6: Progress data and storage

**Files:**
- Create: `src/core/progress.ts`, `src/core/store.ts`
- Test: `src/core/progress.test.ts`, `src/core/store.test.ts`

**Interfaces:**
- Consumes: `StatsMap`, `recordResult`, `QuestionOutcome`, `LevelResult`, `FactKey`, `LevelId`.
- Produces:

```ts
// progress.ts
const PROGRESS_VERSION = 1; const CARD_LIT_THRESHOLD = 3;
interface Settings { music: boolean; voice: boolean; sfx: boolean }
interface LevelRecord { bestStars: 0|1|2|3; bestScore: number }
interface ProgressData {
  version: 1; profileId: string; updatedAt: number; unlockedLevel: LevelId;
  levels: Partial<Record<LevelId, LevelRecord>>; stats: StatsMap;
  cards: Partial<Record<FactKey, number>>; settings: Settings;
}
defaultProgress(now: number, profileId?: string): ProgressData; // unlockedLevel 1, all settings true, profileId 'default'
recordOutcome(d: ProgressData, o: QuestionOutcome, now: number): ProgressData;  // stats + cards (correct only)
applyLevelResult(d: ProgressData, r: LevelResult, now: number): ProgressData;
isCardLit(d: ProgressData, k: FactKey): boolean;
parseProgress(raw: unknown, now: number): ProgressData;  // invalid/wrong version → defaultProgress
// store.ts
interface ProgressStore { load(): Promise<ProgressData>; save(d: ProgressData): Promise<void> }
class LocalStorageProgressStore implements ProgressStore {
  constructor(storage: Storage | null, profileId?: string); // key `funy-app:progress:${profileId}`
}
safeLocalStorage(): Storage | null;   // returns null if accessing window.localStorage throws
```

- [ ] **Step 1: Write failing tests.**
  - `defaultProgress(1)`: `unlockedLevel 1`, `profileId 'default'`, `version 1`, settings all true.
  - Three `correct` outcomes on fact `3x4` (one `mul`, one `div`, one `mulAddSub`) → `isCardLit(d,'3x4')` true. Two → false. `wrong`/`missed` outcomes don't add to cards.
  - `applyLevelResult` with level 1 passed, 2★ → `unlockedLevel 2`, `levels[1] = {bestStars:2, bestScore:totalScore}`. Replaying with 1★ and a lower score keeps 2★ and the higher score. A failed result never lowers `unlockedLevel`. Passing level 6 keeps `unlockedLevel` at 6. `updatedAt` = now.
  - Inputs are not mutated.
  - Store round-trip with an in-memory `Storage` fake (Map-backed).
  - **Review Focus 2:**
    - stored value `'{not json'` → `load()` resolves to default.
    - `{version: 99, ...}` → default.
    - `storage = null` → `load()` default and `save()` resolves.
    - `setItem` throwing `QuotaExceededError` → `save()` resolves without throwing.
    - `safeLocalStorage()` with a `window` whose `localStorage` getter throws → `null`. Stub it via `vi.stubGlobal`.
- [ ] **Step 2:** `npx vitest run src/core/progress.test.ts src/core/store.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `parseProgress` checks `version === 1` and the field types of `unlockedLevel`, `levels`, `stats`, `cards`, `settings`. Anything else → default.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): progress data and swappable progress store`.

---

### Task 7: Voice script and TTS generation

**Files:**
- Create: `content/voice-lines.json`, `scripts/tts/generate.mjs`, `scripts/tts/providers/edge.mjs`, `public/audio/voice/*.mp3`, `src/audio/voiceLines.ts`
- Test: `src/audio/voiceLines.test.ts`

**Interfaces:**
- Produces:
  - `content/voice-lines.json` shape: `{ "voice": "zh-CN-XiaoyiNeural", "lines": { "<category>": [{ "id": "correct-1", "text": "哇！你真是乘法小天才！" }] } }`.
  - `voiceLines.ts`: `type VoiceCategory = 'correct'|'combo3'|'combo5'|'combo10'|'wrong'|'missed'|'levelPass'|'levelFail'|'threeStars'|'bossAppear'|'bossDefeated'|'itemGet'`; `VOICE_CATEGORIES: VoiceCategory[]`; `VOICE_LINES: Record<VoiceCategory, {id: string; text: string}[]>` (imported from the JSON); `voicePath(id: string): string` → `audio/voice/${id}.mp3`.
  - CLI: `node scripts/tts/generate.mjs [--provider edge] [--force]`. Writes `public/audio/voice/<id>.mp3` and skips existing files unless `--force`. A provider module exports `synthesize(text: string, outPath: string, opts: { voice: string }): Promise<void>`.

- [ ] **Step 1: Write failing tests** `src/audio/voiceLines.test.ts`:
  - Categories are exactly the 12 above.
  - `correct` and `wrong` have ≥ 4 lines; every other category has ≥ 2. Total is 30–50.
  - ids are unique and match `/^[a-z0-9-]+$/`.
  - No line in `wrong`, `missed`, or `levelFail` contains any of `笨`, `错了`, `不行`, `差劲`, `失败`.
  - Every id has a non-empty file at `public/audio/voice/<id>.mp3` (use `fs.statSync`).
- [ ] **Step 2:** `npx vitest run src/audio/voiceLines.test.ts` → FAIL.
- [ ] **Step 3:** Write `content/voice-lines.json`. Tone: lively, cute, positive. Wrong/fail lines are gentle and encouraging (e.g. 「再想想哦～」「没关系，下次一定行！」). Combo lines escalate (「三连击！」→「五连击！太厉害啦！」→「十连击！你是乘法大王！」). Boss lines are playful, not scary.
- [ ] **Step 4:** Implement the provider and driver. The edge provider spawns `edge-tts --voice <voice> --rate=+5% --text <text> --write-media <out>`; a non-zero exit throws with stderr. Prerequisite: `pipx install edge-tts`. If installing or running edge-tts fails (no network, blocked), stop and report back. Do not substitute silent files.
- [ ] **Step 5:** Run `node scripts/tts/generate.mjs`. Expected: one mp3 per id. Listen to 2–3 files with `afplay public/audio/voice/correct-1.mp3`.
- [ ] **Step 6:** `npx vitest run src/audio/voiceLines.test.ts` → PASS.
- [ ] **Step 7:** Commit `feat(audio): voice script and edge-tts generation`.

---

### Task 8: Audio runtime (voice, SFX, BGM)

**Files:**
- Create: `src/audio/pickLine.ts`, `src/audio/synth.ts`, `src/audio/AudioService.ts`
- Modify: `src/scenes/BootScene.ts` (preload all voice files)
- Test: `src/audio/pickLine.test.ts`

**Interfaces:**
- Consumes: `VOICE_LINES`, `voicePath`, `Settings`, `Rng`.
- Produces:
  - `pickLine<T extends {id: string}>(lines: T[], lastId: string | undefined, rng: Rng): T`: never returns `lastId` when `lines.length > 1`.
  - `class Throttle { constructor(intervalMs: number); allow(nowMs: number): boolean }`
  - `type SfxName = 'correct'|'wrong'|'bump'|'explode'|'tick'|'bossHit'|'item'`
  - `synth.ts`: `playSfx(ctx: AudioContext, name: SfxName, volume: number): void` (short oscillator/noise envelopes, ≤ 400 ms) and `startBgm(ctx: AudioContext): { stop(): void }` (a gentle looping pentatonic melody at gain 0.12).
  - `class AudioService { constructor(sound: Phaser.Sound.BaseSoundManager, settings: () => Settings, rng: Rng); voice(cat: VoiceCategory): void; sfx(name: SfxName): void; setMusic(on: boolean): void }`. Stored in `game.registry` under `'audio'`.
  - `voice()` stops any voice still playing before starting a new one. It plays nothing when `settings().voice` is false.
  - `sfx('bump')` goes through `Throttle(80)`.
  - Get the AudioContext from `(sound as Phaser.Sound.WebAudioSoundManager).context`. If that's unavailable, or the context is suspended before the first user gesture, calls are silent no-ops and must not throw.

- [ ] **Step 1: Write failing tests:**
  - `pickLine` over 500 draws with a seeded rng never repeats `lastId`.
  - A single-line list returns that line.
  - `Throttle(80)`: `allow(0)` true, `allow(50)` false, `allow(80)` true.
- [ ] **Step 2:** `npx vitest run src/audio/pickLine.test.ts` → FAIL.
- [ ] **Step 3:** Implement the three files. Make `BootScene` load every voice id with `this.load.audio(id, voicePath(id))`, create the `AudioService`, and register it.
- [ ] **Step 4:** Run the unit test → PASS. Run `npm run test:e2e` → still PASS (no console errors from audio loading).
- [ ] **Step 5:** Commit `feat(audio): voice player, synthesized sfx and bgm`.

---

### Task 9: Game scene — physics, clicks, pile, HUD, pause

**Files:**
- Create: `src/game/tuning.ts`, `src/game/OptionBody.ts`, `src/game/pile.ts`, `src/game/Hud.ts`, `src/game/debug.ts`, `src/scenes/GameScene.ts`
- Modify: `src/main.ts` (register scene), `src/scenes/BootScene.ts` (load progress via `LocalStorageProgressStore(safeLocalStorage())`, put `ProgressData` in `registry` key `'progress'` and the store under `'store'`)
- Test: `src/game/pile.test.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `LevelSession`, `generateQuestion` types, `recordOutcome`, `applyLevelResult`, `ProgressStore`, `AudioService`.
- Produces:
  - `tuning.ts` constants (starting values, tune by playtest):
    - `GROUND_Y = 700`, `WARNING_LINE_Y = 320`, `QUESTION_AREA_BOTTOM = 140`, `PILE_OVERFLOW_MS = 2000`
    - `SPAWN_Y = -60`, `SPAWN_STAGGER_MS = 250`, `SPAWN_X_MIN = 120`, `SPAWN_X_MAX = 1160`
    - `NUMBER_RADIUS = 42`, `PILL_W = 140`, `PILL_H = 56`
    - `BASE_GRAVITY_Y = 0.25`, `FRICTION_AIR = 0.035`, `RESTITUTION = 0.5`, `MISS_REVEAL_MS = 1200`
    - Gravity = `BASE_GRAVITY_Y * difficultyAt(i).fallSpeed * session.timeScale()`. Tune so an option takes ~4.5 s to fall at index 0.
  - `class PileOverflowTracker { constructor(lineY: number, holdMs: number); update(dtMs: number, highestTopY: number | null): boolean }`. Returns true once the pile top has stayed above `lineY` (top < lineY) continuously for `holdMs`. `null` (no pile) resets it.
  - `OptionBody`: wraps a Matter body plus a container (circle or pill, label text). It has `questionSerial`, `optionId`, and `state: 'falling' | 'landed' | 'grey' | 'removed'`, plus methods `setGrey()`, `vanish()` (fade out 300 ms then destroy), and `topY()`.
  - `GameScene` (`key 'Game'`, init data `{ levelId: LevelId }`). Emits `'session-event'` on `this.events` with `{ type: 'correct'|'lateCorrect'|'wrong'|'miss'|'item'|'questionStart'|'end', ... }`. Task 10 subscribes for effects, boss, and voice.
  - `debug.ts`: when `import.meta.env.DEV` or `location.search` contains `debug`, sets `window.__funyDebug = { answerCorrect(): void; answerWrong(): void; missCurrent(): void; startLevel(id: LevelId): void; unlockAll(): void; press(label: string): void; state(): DebugState }` where `DebugState = { scene: string; questionIndex?: number; score?: number; status?: string; timeLeftMs?: number; bossHp?: number; stars?: number; litCards?: number; settings?: Settings }` (fields present when the active scene has them; Tasks 10–11 fill `bossHp`, `stars`, `litCards`, `settings`). `answerCorrect` clicks the first clickable correct option of the current question through the same path as a pointer click. `press` is filled in by Task 11's `Button` registry.

Scene behavior:
- One `LevelSession` per run. `stats` is read from the registry progress. `onOutcome` → `recordOutcome` updates registry progress (save at level end or Esc).
- Each question increments `questionSerial` and spawns its options staggered at random x. **Pointer clicks are forwarded to `session.click` only when `option.questionSerial === currentSerial` and `state === 'falling' | 'landed'`** (Review Focus 3).
- Correct / late correct: every option of that question `vanish()`es, then the next question spawns.
- Wrong: `setGrey()` plus shake. The option keeps falling and is no longer clickable.
- Landing: on `collisionstart` with the ground or any pile body, set `state = 'landed'`. When every correct option of the current question has landed, call `session.miss()`, show `question.answerText` for `MISS_REVEAL_MS` under the prompt, and grey all of that question's options (they become pile).
- Each frame: `session.tick(delta)`. Set `matter.world.engine.timing.timeScale = session.timeScale()`. Feed `PileOverflowTracker` with the min `topY()` of pile bodies; on true, call `session.failByPile()`.
- HUD (`Hud.ts`): prompt (64 px, top center, inside `QUESTION_AREA_BOTTOM`); score and combo top-left; countdown top-right (turns red at < 10 s, `sfx('tick')` each whole second below 10 s); item buttons bottom-left showing counts and keys 「1 冰冻」「2 放大镜」; dashed red warning line.
- Space toggles `session.pause()/resume()` together with `matter.world.pause()/resume()` and a 「暂停中 · 按空格继续」 overlay. **`this.game.events.on('blur'|'hidden')` → auto-pause** (Review Focus 4).
- Esc: save progress, then `scene.start('LevelSelect')`.
- Keys `1`/`2` and item button clicks → `useFreeze()` / `useMagnifier(activeIds)`. The magnifier `vanish()`es the returned option.
- On `won`/`lost`: `progress = applyLevelResult(...)`, `await store.save(progress)`, then `scene.start('Result', { result })`.
- Until Task 11 exists, `main.ts` starts `Game` with level 1 directly from `BootScene`.

- [ ] **Step 1: Write failing unit tests** `src/game/pile.test.ts`:
  - `update(1000, 300)` false, `update(999, 300)` false, `update(1, 300)` true (line 320, hold 2000).
  - A frame with `400` (below the line) or `null` in between resets the hold.
- [ ] **Step 2: Write the failing e2e test** `e2e/game.spec.ts` (`/?debug`, fresh storage):
  - Three `answerCorrect()` → `state().score === 35` (10+10+15), `questionIndex === 3`.
  - `answerWrong()` → score 30.
  - Dispatch `window.dispatchEvent(new Event('blur'))` → status `paused`. Record `timeLeftMs`, wait 1500 ms, and it is unchanged. Then press Space → `playing`.
- [ ] **Step 3:** `npx vitest run src/game && npm run test:e2e` → FAIL.
- [ ] **Step 4:** Implement the files above.
- [ ] **Step 5:** `npx vitest run && npm run test:e2e && npm run typecheck` → PASS.
- [ ] **Step 6: Manual check** (`npm run dev`, open level 1):
  - Numbers fall, collide, bounce, and pile.
  - A correct click clears the question.
  - A wrong click greys the option and blocks clicks for 0.5 s.
  - Letting all answers land shows the answer and adds to the pile.
  - Freeze slows everything.
  - Report anything that feels off for a 7-year-old (fall speed, sizes).
- [ ] **Step 7:** Commit `feat(game): physics game scene with session wiring`.

---

### Task 10: Effects, combo feedback, voice hookup, boss

**Files:**
- Create: `src/game/effects.ts`, `src/game/Boss.ts`
- Modify: `src/scenes/GameScene.ts` (subscribe to `'session-event'`)
- Test: `e2e/boss.spec.ts`

**Interfaces:**
- Consumes: `GameScene` `'session-event'`, `AudioService`, `LevelSession.bossHp()`, `BOSS_HP`.
- Produces:
  - `effects.ts`: `explode(scene, x, y)` (star and confetti particles, ≤ 600 ms); `greyShake(scene, target)`; `screenShake(scene)`; `flashWhite(scene, target)`; `spark(scene, x, y)` (collision, throttled with `Throttle(80)`); `comboPopup(scene, combo)` (「3 连击！×1.5」 near the score, ≤ 800 ms).
  - `class Boss { constructor(scene, x, y); setHp(hp: number): void; hit(): void; defeat(): void; chestMode(): void }`. Draw it with `Graphics`/shapes (cute monster, no external art). The HP bar has 16 segments. It lives in the top-right area and doesn't overlap the prompt.
- Every effect has a depth below the HUD/prompt, and its particles stay below `QUESTION_AREA_BOTTOM`.

Event → feedback mapping:

| Event | Effect | Sound | Voice |
|---|---|---|---|
| correct | `explode` | `sfx('explode')` | `combo10` / `combo5` / `combo3` when combo equals exactly 10 / 5 / 3, else `correct` |
| lateCorrect | small `explode` | — | `correct` |
| wrong | `greyShake` | `sfx('wrong')` | `wrong` |
| miss | — | — | `missed` |
| item awarded | — | `sfx('item')` | `itemGet` |
| collision | `spark` | `sfx('bump')` | — |
| boss level start | — | — | `bossAppear` |
| boss hit (correct) | `boss.hit()`, `flashWhite`, `screenShake` | `sfx('bossHit')` | — |
| hp reaches 0 | `boss.defeat()`, then `chestMode()` | — | `bossDefeated` |
| level end | — | — | `threeStars` if 3★, else `levelPass` / `levelFail` |

- [ ] **Step 1: Write the failing e2e test** `e2e/boss.spec.ts` (`/?debug`):
  - `unlockAll()`, then `startLevel(3)` → `state().scene === 'Game'`, `state().bossHp === 16`.
  - 16 × `answerCorrect()` → `state()` has `bossHp: 0` and `status: 'playing'`.
  - 4 more → scene becomes `Result`.
- [ ] **Step 2:** `npm run test:e2e` → FAIL.
- [ ] **Step 3:** Implement `effects.ts`, `Boss.ts`, and the subscriptions.
- [ ] **Step 4:** `npm run test:e2e` → PASS.
- [ ] **Step 5: Manual check:**
  - Effects never hide the prompt.
  - Voice lines don't overlap.
  - Boss hit and defeat feel satisfying.
  - Combo popups are readable.
- [ ] **Step 6:** Commit `feat(game): effects, voice feedback, boss levels`.

---

### Task 11: Menus, level select, result, card album, settings

**Files:**
- Create: `src/ui/Button.ts`, `src/scenes/MenuScene.ts`, `src/scenes/LevelSelectScene.ts`, `src/scenes/ResultScene.ts`, `src/scenes/CardsScene.ts`, `src/scenes/SettingsScene.ts`
- Modify: `src/main.ts`, `src/scenes/BootScene.ts` (go to `Menu`), `src/game/debug.ts` (`press`)
- Test: `e2e/flow.spec.ts`

**Interfaces:**
- Consumes: registry `'progress'`, `'store'`, `'audio'`; `LEVELS`, `ALL_FACTS`, `koujue`, `isCardLit`, `LevelResult`.
- Produces:
  - `createButton(scene, x, y, label: string, onClick: () => void, opts?: { disabled?: boolean }): Phaser.GameObjects.Container`. It registers `label → onClick` in a per-scene map that `__funyDebug.press(label)` uses (active scene only). Pressing a disabled button is a no-op, both by mouse and through `press`.
  - Scene keys: `Menu`, `LevelSelect`, `Result` (init `{ result: LevelResult }`), `Cards`, `Settings`.

Screens (labels are exact, since tests press them):
- **Menu:** title 「九九乘法闯关」. Buttons 「开始游戏」→LevelSelect, 「口诀卡册」→Cards, 「设置」→Settings. Starts BGM if `settings.music`.
- **LevelSelect:** 6 tiles labelled 「第1关」…「第6关」 with level name, best stars (★☆☆), and a lock icon if `id > unlockedLevel` (disabled). 「返回」→Menu.
- **Result:** 「过关啦！」 or 「再试一次吧！」 (fail reason shown gently: 「时间到啦」「地面堆满啦」「差一点点，加油」). Shows 答对 n/20, 得分, 时间奖励, stars. Buttons 「再玩一次」, 「下一关」 (only if passed and level < 6), 「选关」.
- **Cards:** 9×9 grid. Cell (row a, col b) for a ≤ b shows `koujue`, lit (bright) or unlit (grey). Cells below the diagonal are empty. Header 「已点亮 n / 45」. 「返回」.
- **Settings:** toggles 「音乐」「语音」「音效」 showing 开/关. Changes save immediately via the store and apply to `AudioService`. 「返回」.

- [ ] **Step 1: Write the failing e2e test** `e2e/flow.spec.ts` (`/?debug`, `localStorage.clear()` first):
  1. `press('开始游戏')`. Level 1 is enabled and level 2 is locked (`press('第2关')` leaves the scene on `LevelSelect`).
  2. `press('第1关')`, then 20 × `answerCorrect()` → scene `Result`. `state().stars === 3`.
  3. `press('选关')`, then `press('第2关')` → scene `Game`.
  4. Reload `/?debug`, `press('开始游戏')`, `press('第2关')` → `Game` (unlock persisted).
  5. Card album: write a progress object with `cards: { '3x4': 3, '5x6': 2 }` into `localStorage['funy-app:progress:default']`, reload, `press('口诀卡册')` → `state().litCards === 1`. (Card accrual itself is unit-tested in Task 6; a random level run isn't guaranteed to hit any fact 3 times.)
  6. Settings: `press('语音')` → reload → the voice setting is still off (read via `state().settings`).
- [ ] **Step 2:** `npm run test:e2e` → FAIL.
- [ ] **Step 3:** Implement the scenes and `Button`. Wire Result's buttons and GameScene's Esc to the real scenes.
- [ ] **Step 4:** `npx vitest run && npm run test:e2e && npm run typecheck && npm run build` → PASS.
- [ ] **Step 5: Manual check:** play levels 1→2 for real with the mouse; check the stars display and the card album. Confirm with DevTools Network that `npm run preview` makes no runtime requests to external hosts.
- [ ] **Step 6:** Commit `feat(ui): menus, level select, results, card album, settings`.

---

### Task 12: CLAUDE.md and README

**Files:**
- Create: `CLAUDE.md`, `README.md`

- [ ] **Step 1:** Write `README.md` (Chinese): what the game is; `npm install`, `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`; how to regenerate voices (`pipx install edge-tts`, edit `content/voice-lines.json`, `node scripts/tts/generate.mjs [--force]`); `?debug` hook.
- [ ] **Step 2:** Write `CLAUDE.md`. It starts with the required header:
  > # CLAUDE.md
  > This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

  Contents:
  - commands, including a single-test run: `npx vitest run src/core/session.test.ts -t "combo"` and `npx playwright test e2e/flow.spec.ts`
  - architecture: pure `src/core` vs thin Phaser scenes; `LevelSession` as the single source of game rules; the `'session-event'` bus; the registry keys `progress`/`store`/`audio`; the `ProgressStore` swap point; the voice pipeline from JSON to mp3
  - the anti-goals that constrain changes: no negative score, gentle wording, reverse-mode correctness by evaluation
  - a pointer to the spec
- [ ] **Step 3:** Run `npx vitest run && npm run test:e2e && npm run build` one last time → PASS.
- [ ] **Step 4:** Commit `docs: add CLAUDE.md and README`.
