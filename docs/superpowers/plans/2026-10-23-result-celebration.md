# Level-end hold and Result celebration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the last question's effects finish before the Result scene, then play a ≤ 2.5 s entrance celebration on the Result scene driven by a pure, unit-tested step list.

**Architecture:** `GameScene.checkEnd` starts a hold timer instead of switching scenes at once. A new pure module `src/game/celebration.ts` turns a `LevelResult` into timed `CelebrationStep`s; `ResultScene` maps each step kind to a tween, particle burst, sfx or voice and plays them through a Phaser Timeline. No new textures: confetti reuses the pre-baked particle clay, stars reuse the pre-baked lit/unlit star textures.

**Tech Stack:** Phaser 3.90 (Timeline, tweens, particles), TypeScript, Vitest, Playwright e2e via `window.__funyDebug`.

**Spec:** `docs/superpowers/specs/2026-10-23-result-celebration-design.md`

## Global Constraints

- Pure core, thin scenes: timing rules live in `src/game/celebration.ts` with tests; `ResultScene` only renders.
- No texture baked after Boot: `e2e/clay.spec.ts` asserts no new `clay:` key on Result. Only `bakeShape('particleStar'|'particleBall', <BALL_COLORS>)` and `bakeStars(RESULT_STAR_SIZE)` may be looked up.
- Buttons on Result are created in `create()` as today and stay pressable from the first frame (`e2e/flow.spec.ts` presses `再玩一次` right after `scene === 'Result'`).
- Total celebration ≤ `CELEBRATION_MAX_MS = 2500`; the failed page has no star drop, confetti, screen shake or `pass` sfx.
- Gentle wording: no new UI text. Voice categories used: `threeStars`, `levelPass`, `levelFail` (existing).
- Hold constants: `LEVEL_END_HOLD_MS = 1300`, `BOSS_DEFEAT_HOLD_MS = 2000` in `src/game/tuning.ts`.
- Commit messages follow `type(scope): summary`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Esc during the hold: `exitToLevelSelect` must still leave immediately and the hold callback must not later start Result on top of LevelSelect (guard with `leaving`). Covered by the `leaving` check in Task 1 step 3; verified manually.
2. Pause (Space) during the hold must do nothing (session is not `playing`); the hold uses the scene clock so an auto-pause on tab blur cannot leave the game stuck — `setPaused` ignores non-playing sessions, so `time.paused` is never set during the hold. Manual check in Task 1.
3. Pressing `再玩一次` or `下一关` mid-celebration restarts/starts Game: the Timeline and any particle emitters belong to the Result scene and must be destroyed on SHUTDOWN so no callback runs against a dead scene (Task 4 step 3, e2e in Task 4 step 5).
4. Failed result with `stars = 0` must produce no `star` step (Task 2 test `failed page has no star, confetti or pass steps`).
5. A debug-driven level end (`answerCorrect` × 20 in e2e) must not wait 1.3 s per test: `debugAnswer`/`debugMiss` flush the hold (Task 1 step 4, e2e `flow.spec.ts` unchanged timing).

---

### Task 1: Level-end hold in GameScene

**Files:**
- Modify: `src/game/tuning.ts` (add constants after `MISS_REVEAL_MS`)
- Modify: `src/scenes/GameScene.ts:520-534` (`checkEnd`, `endLevel`), `:486-488` (`end` case), `:559-581` (debug actions), `debugState`
- Modify: `src/game/debug.ts` (`DebugState`)

**Interfaces:**
- Produces: `LEVEL_END_HOLD_MS`, `BOSS_DEFEAT_HOLD_MS` (tuning.ts); `DebugState.levelEnding?: boolean`.
- GameScene no longer plays a voice on the `end` event (Task 4 plays it on Result).

- [ ] **Step 1: Add constants to `src/game/tuning.ts`**

```ts
/** After the last question ends, the scene keeps running this long so the final effects and voice finish. */
export const LEVEL_END_HOLD_MS = 1300;
/** Longer hold when the final answer defeats the boss (defeat animation + chest switch at 700 ms). */
export const BOSS_DEFEAT_HOLD_MS = 2000;
```

- [ ] **Step 2: Add `levelEnding?: boolean` to `DebugState` in `src/game/debug.ts`** with doc comment "True during the level-end hold (final effects playing, Result not started yet)."

- [ ] **Step 3: Rewrite `checkEnd` / `endLevel` in `GameScene`**

Add field `private endHold?: Phaser.Time.TimerEvent;` reset to `undefined` in `init`.

```ts
private checkEnd(): void {
  const st = this.session.status;
  if (this.leaving || this.endHold || (st !== 'won' && st !== 'lost')) return;
  const bossJustDefeated = !!this.boss && this.boss.mode === 'defeated';
  this.endHold = this.time.delayedCall(bossJustDefeated ? BOSS_DEFEAT_HOLD_MS : LEVEL_END_HOLD_MS, () => this.leaveToResult());
}

private leaveToResult(): void {
  if (this.leaving) return;
  this.leaving = true;
  void this.endLevel();
}
```

`endLevel` keeps its body (pause Matter, `result()`, emit `end`, apply + save progress, `scene.start('Result')`). Remove the `case 'end'` voice call in `onSessionEvent` (keep the case with a comment: the Result celebration plays the pass/fail line). `update()` keeps its `if (this.leaving) return;` so balls keep syncing visuals during the hold; `s.tick`, `checkMiss`, `useItem`, `setPaused` and `onOptionPointer` are already status/clickable guarded, so no new input gating is needed.

- [ ] **Step 4: Flush the hold in debug actions**

Add `private flushEndHold(): void { if (this.endHold && !this.leaving) { this.endHold.remove(); this.leaveToResult(); } }` and call it at the end of `debugAnswer`, `debugDoubleClickCorrect` and `debugMiss`. Add `levelEnding: !!this.endHold && !this.leaving` to `debugState()`.

- [ ] **Step 5: Typecheck and run the existing suites**

Run: `npm run typecheck && npx vitest run && npx playwright test e2e/flow.spec.ts e2e/boss.spec.ts`
Expected: all pass (e2e timing unchanged because debug actions flush the hold).

- [ ] **Step 6: Manual check** (`npm run dev`, `?debug`): finish level 1 by real clicks; the last explosion, float score and the answered voice complete before Result appears. On level 3, make the 16th correct answer the last one if possible, or at least confirm Esc during the hold returns to LevelSelect with no Result flash.

- [ ] **Step 7: Commit**

```bash
git add src/game/tuning.ts src/game/debug.ts src/scenes/GameScene.ts
git commit -m "fix(game): hold the scene after the last question so final effects finish"
```

---

### Task 2: Pure celebration script

**Files:**
- Create: `src/game/celebration.ts`
- Test: `src/game/celebration.test.ts`

**Interfaces:**
- Consumes: `LevelResult` from `src/core/session.ts`.
- Produces:

```ts
export type CountLine = 'correct' | 'score' | 'bonus';
export type CelebrationStep =
  | { at: number; kind: 'title' }
  | { at: number; kind: 'reason' }
  | { at: number; kind: 'star'; index: 0 | 1 | 2 }
  | { at: number; kind: 'count'; line: CountLine; durationMs: number }
  | { at: number; kind: 'confetti' }
  | { at: number; kind: 'sfx'; name: 'pass' | 'correct' }
  | { at: number; kind: 'voice'; category: 'threeStars' | 'levelPass' | 'levelFail' };
export const CELEBRATION_MAX_MS = 2500;
export const STAR_FIRST_MS = 500;
export const STAR_GAP_MS = 350;
export function celebrationSteps(result: LevelResult): CelebrationStep[]; // ascending `at`, stable
export function celebrationDurationMs(steps: CelebrationStep[]): number; // max over steps of at + ownDuration
```

Own durations for `celebrationDurationMs`: `count` = its `durationMs`; `star` = 250; `confetti` = 1200; `title` = 300; `reason` = 300; `sfx`/`voice` = 0.

- [ ] **Step 1: Write the failing tests in `src/game/celebration.test.ts`**

Helper `res(over: Partial<LevelResult>): LevelResult` with defaults `{ levelId: 1, passed: true, correctCount: 20, score: 480, timeBonus: 55, totalScore: 535, stars: 3 }`.

```ts
it('steps are sorted by time', ...)            // every steps[i].at <= steps[i+1].at, for stars 0..3 and a failed result
it('passed page drops one star per earned star at 500 + 350·i', ...)
  // stars:2 → star steps [{at:500,index:0},{at:850,index:1}], each with an sfx 'correct' at the same `at`
it('passed page opens with title and pass sfx at 0 and counts correct/score/bonus at 300/700/900', ...)
  // count correct durationMs 500; score and bonus durationMs 600
it('three stars add confetti and the threeStars voice 250 ms after the last star', ...)
  // at = 500 + 350*2 + 250 = 1450: one confetti and voice 'threeStars'; no 'levelPass'
it('one or two stars play levelPass instead of confetti', ...)
  // stars:1 → voice levelPass at 500 + 250 = 750, no confetti
it('failed page has no star, confetti or pass steps', ...)
  // passed:false, stars:0 → kinds ⊆ {title, reason, count, voice}; reason at 200; count correct at 300 (500 ms); voice levelFail at 600; no 'score'/'bonus' count
it('every script has exactly one voice step', ...)
it('every script fits in CELEBRATION_MAX_MS', ...)  // celebrationDurationMs(steps) <= 2500 for stars 0..3 and failed
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/game/celebration.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/game/celebration.ts`** per the Interfaces block; build the array then sort by `at` with a stable sort (`Array.prototype.sort` is stable in modern engines). Failed page: `title@0`, `reason@200`, `count correct@300 (500)`, `voice levelFail@600`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/game/celebration.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/celebration.ts src/game/celebration.test.ts
git commit -m "feat(game): pure celebration step script for the Result scene"
```

---

### Task 3: Celebration assets — pass sfx, star slots, confetti burst

**Files:**
- Modify: `src/audio/synth.ts:1-30` (`SfxName`, `SFX_TONES`)
- Modify: `src/ui/claywidgets.ts:48-57` (`clayStars`)
- Modify: `src/game/effects.ts:27-47,61-67` (`burst`, `shockwave`)
- Test: `src/ui/clay.test.ts` (existing file; add one test), `src/audio/synth.test.ts` if it exists, else none (tones are data)

**Interfaces:**
- Produces: `SfxName` gains `'pass'`; `export function starSlots(size: number): { x: number; y: number }[]` (three local offsets, centre star raised by `size * 0.08`, step `size * 1.15`); `export function confettiBurst(scene, x, y, depth: number): void` in effects.ts.
- `clayStars` unchanged in behaviour, now built from `starSlots`.

- [ ] **Step 1: Add `'pass'` to `SfxName` and `SFX_TONES`**

```ts
pass: [
  { freq: 523, at: 0, dur: 0.12, type: 'sine' },
  { freq: 659, at: 0.1, dur: 0.12, type: 'sine' },
  { freq: 784, at: 0.2, dur: 0.12, type: 'sine' },
  { freq: 1047, at: 0.3, dur: 0.22, type: 'sine' },
],
```

- [ ] **Step 2: Write the failing test for `starSlots` in `src/ui/clay.test.ts`**

```ts
it('starSlots: three slots on a 1.15·size pitch, centre raised by 8 %', () => {
  expect(starSlots(100)).toEqual([{ x: -115, y: 0 }, { x: 0, y: -8 }, { x: 115, y: 0 }]);
});
```

Run: `npx vitest run src/ui/clay.test.ts -t starSlots` → FAIL (not exported). If `clay.test.ts` cannot import claywidgets without Phaser side effects, put the test in a new `src/ui/claywidgets.test.ts` and import only `starSlots` (keep `starSlots` free of Phaser calls).

- [ ] **Step 3: Implement `starSlots` and use it inside `clayStars`**; run the test → PASS.

- [ ] **Step 4: Add `confettiBurst` to `effects.ts`**

Give `burst` a trailing optional `minY = QUESTION_AREA_BOTTOM` parameter and an optional `depth = FX_DEPTH`. Then:

```ts
/** Result-page confetti: 30 clay stars/dots in 3 ball colours falling from (x, y), 1200 ms. Not clamped to the play field. */
export function confettiBurst(scene: Phaser.Scene, x: number, y: number, depth: number): void
```
Per colour: `particleStar` 5 + `particleBall` 5, `speed {min:200,max:520}`, `angle {min:60,max:120}` (downward fan), `gravityY: 500`, `rotate {start:0,end:360}` for stars, `scale {start: 1.4*TEX, end: 0.3*TEX}`.

- [ ] **Step 5: Typecheck and run all unit tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/audio/synth.ts src/ui/claywidgets.ts src/ui/clay.test.ts src/game/effects.ts
git commit -m "feat(ui): pass fanfare, star slots and confetti burst for the Result celebration"
```

---

### Task 4: ResultScene plays the celebration

**Files:**
- Modify: `src/scenes/ResultScene.ts`
- Modify: `src/game/debug.ts` (`DebugState.celebrating?: boolean`)
- Modify: `e2e/flow.spec.ts` (one added assertion), `CLAUDE.md` (two sentences)

**Interfaces:**
- Consumes: `celebrationSteps`, `celebrationDurationMs` (Task 2); `starSlots`, `bakeStars`, `clayImage`; `confettiBurst`, `shockwave` (Task 3); `getAudio()` from `src/ui/theme.ts`; `AudioService.sfx('pass'|'correct')`, `.voice(category)`.
- Produces: `DebugState.celebrating` — true from `create()` until the timeline completes.

- [ ] **Step 1: Restructure `create()`**

Keep layout and buttons exactly as today, but:
- Title text: `setScale(0.6)`; `reason` text (failed only): `setAlpha(0)`.
- Stars: replace `clayStars(...)` with three unlit images at `starSlots(RESULT_STAR_SIZE)` offsets around `(cx, 255)` using `bakeStars(this, RESULT_STAR_SIZE).off`, plus for each `i < r.stars` a lit image at the same slot with `alpha 0`, `scale 1.6 / RENDER_SCALE`, `y - 140` (kept in `private lit: Phaser.GameObjects.Image[]`).
- Numbers: keep three Text objects in fields `countText: Record<CountLine, Phaser.GameObjects.Text>` with initial values `答对 0/20`, `得分 0`, `时间奖励 +0`; the target values are `correctCount`, `score`, `timeBonus`.
- Buttons: `setDepth(10)` on each container; confetti depth 5.

- [ ] **Step 2: Build and play the timeline**

```ts
private playCelebration(r: LevelResult): void
```
`const steps = celebrationSteps(r)`; `this.timeline = this.add.timeline(steps.map(s => ({ at: s.at, run: () => this.runStep(s) })))`; add a final event at `celebrationDurationMs(steps)` that sets `this.celebrating = false`; `.play()`.

`private runStep(s: CelebrationStep): void` maps:
- `title`: tween title `scale: 1`, 300 ms, `Back.Out`.
- `reason`: tween alpha 1, 300 ms.
- `star`: tween `lit[index]` to `{ y: slotY, alpha: 1, scale: 1 / RENDER_SCALE }`, 250 ms, `Back.Out`; `onComplete`: `shockwave(this, x, y)` and `this.cameras.main.shake(80, 0.002)`.
- `count`: tween a `{ v: 0 }` holder to the target over `durationMs`, `onUpdate` sets the text (`Math.round`), formats: `答对 ${v}/${QUESTIONS_PER_LEVEL}`, `得分 ${v}`, `时间奖励 +${v}`.
- `confetti`: `confettiBurst(this, cx - 300, 120, 5)` and `confettiBurst(this, cx + 300, 120, 5)`.
- `sfx`: `getAudio(this)?.sfx(name)`; `voice`: `getAudio(this)?.voice(category)`.

- [ ] **Step 3: Clean up on shutdown**

`this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.timeline?.destroy(); this.timeline = undefined; })`. Particle emitters from `confettiBurst` self-destroy via `delayedCall` on the scene clock, which the scene drops on shutdown.

- [ ] **Step 4: Expose `celebrating` in `debugState()`** and add `celebrating?: boolean` to `DebugState`.

- [ ] **Step 5: Add an e2e assertion in `e2e/flow.spec.ts`** right after the first `stars).toBe(3)`:

```ts
await expect.poll(async () => (await state(page)).celebrating, { timeout: 4000 }).toBe(false);
```
(Extend the local `S` type with `celebrating?: boolean`.) The existing immediate `press('再玩一次')` on the failed Result (celebration still running) covers Review Focus 3.

- [ ] **Step 6: Run everything**

Run: `npm run typecheck && npx vitest run && npm run test:e2e`
Expected: PASS, including `clay.spec.ts` "no clay: key added after Boot" on Result.

- [ ] **Step 7: Manual check** (`npm run dev`): three-star pass shows title pop, three star drops with rings, counting numbers, confetti and the three-star line; a failed level shows only the gentle sequence; buttons respond during the animation.

- [ ] **Step 8: Update `CLAUDE.md`** — in "Event bus" or a new short bullet under Architecture: "`GameScene` holds `LEVEL_END_HOLD_MS` after the last question before starting Result (debug actions flush it). Result plays `celebrationSteps(result)` (`src/game/celebration.ts`, pure, tested) through a Phaser Timeline; the pass/fail voice is played there, not in GameScene."

- [ ] **Step 9: Commit**

```bash
git add src/scenes/ResultScene.ts src/game/debug.ts e2e/flow.spec.ts CLAUDE.md docs/superpowers/specs/2026-10-23-result-celebration-design.md docs/superpowers/plans/2026-10-23-result-celebration.md
git commit -m "feat(ui): Result celebration timeline; design and plan docs"
```
