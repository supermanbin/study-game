# 弹珠物理与动画升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the in-game physics and juice match the approved spike (`spikes/physics.ts`): pegs, side tosses, spinning bouncy balls, rest-based misses, big correct-answer bursts with shove, and a `?debug` tuning panel. All game rules stay as they are.

**Architecture:** Rules stay in `LevelSession` (untouched). Tunable physics parameters move into a small pure module, `src/game/physicsTuning.ts`, which persists to localStorage separately from progress. Rest, stuck and out-of-field detection are pure, unit-tested helpers in `src/game/motion.ts`. `GameScene` / `OptionBody` / new `Pegs.ts` consume them. Effects extend `src/game/effects.ts`. The tuning panel is a DOM overlay (`src/game/TuningPanel.ts`) mounted only when `location.search` contains `debug`.

**Tech Stack:** TypeScript, Phaser 3.90 (Matter.js), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-physics-juice-design.md` (amends `docs/superpowers/specs/2026-10-22-multiplication-game-design.md`)

## Global Constraints

- Default tuning: gravity 1, bounce 0.75, air friction 0.004, pegs on, launch `'toss'`. Ball friction 0.05, density 0.002.
- Panel ranges: gravity 0.3–2, bounce 0.2–0.95, air 0–0.04. Changes apply from the next question.
- Effective gravity y = `tuning.gravity × LEVEL_GRAVITY_FACTOR[level] × difficultyAt(i).fallSpeed`. Freeze still works only through the engine `timing.timeScale`.
- Toss spawn: alternate left/right just below the question band. vx magnitude 5–11, vy −2…−7 (upward), random spin. Spawn stagger 220 ms, plus a pop-in scale tween. Drop spawn: random x just below the band, small vx.
- Balls rotate; the label text stays upright. Number balls have radius 42. Reverse-mode `a × b` options are balls of radius ~52 with a smaller font. No more pills.
- There is an invisible ceiling at `QUESTION_AREA_BOTTOM` (140). Pegs: 4 staggered rows, y ≈ 190–380, restitution 0.9, flash when hit. Warning line ≈ 420. Ground stays at 700.
- Miss: only after every option of the question has spawned, when all correct balls have been resting (supported by ground or pile, speed < 0.8) continuously for 1500 ms. Any movement resets that correct ball's timer.
- Stuck: a ball that is slow but unsupported for > 1000 ms gets nudged.
- Pile overflow counts only resting pile balls (grey options of earlier questions) whose top is above the warning line for 2000 ms.
- On correct: the clicked ball explodes now. Every other option of that question (including greyed) becomes unclickable immediately, vanishes at ~700 ms, and the next question starts at ~950 ms.
- Wrong: grey, density → 0.006, shake, 500 ms lockout (session).
- Effects:
  - Correct:
    - star/confetti burst with gravity, ~0.9 s;
    - white shockwave ring, 0.45 s;
    - floating `+N` (actual scoreDelta), ~0.9 s;
    - camera shake 120 ms at 0.004;
    - shove of balls within radius 320.
  - Combo ≥ 3: centered 「N 连击！」 popup, ~0.85 s total.
  - Squash on hard ground hits. Sparks when relative speed > 4.
  - Peg hit: flash plus a pitched blip.
  - Collision sounds are throttled.
  - Every effect lasts ≤ ~1 s. Effects may draw above balls but never over the question band or HUD (depth < 50).
- Time limits: recomputed from measurement (Task 5): levels 1–2 = round10(20 × T × 1.2), levels 3–6 = round10(20 × T × 1.0). Running out of time still fails the level.
- Tuning panel: only when `location.search` includes `debug`. Stored under localStorage key `funy-app:physics-tuning`. Has a 「恢复默认」 button. e2e clears that key before each test.
- Must not regress: double-click guard, 500 ms lockout, auto-pause on blur/hidden, click/Space resume, Esc saves → LevelSelect, per-outcome save, Button registry cleanup, debug hook installed from Menu, all unit tests, all e2e, e2e `--repeat-each=5` green.
- Commits: conventional messages ending with the harness attribution trailer.

## Review Focus

1. **Clicking a leftover ball of a just-answered question during its 0.7 s fade.** The session has already advanced, and option ids restart at 0, so the click would be scored against the next question. The leftover balls must be unclickable the moment the answer lands. → e2e in Task 3.
2. **A ball balanced on a peg or wedged between pegs.** It never rests on the ground, so a miss would never fire and the question would hang. → `StuckTimer` unit test in Task 1, nudge wiring in Task 3.
3. **A ball escaping the field** (thrown over the ceiling by a shove, tunnelling through a wall at high speed). The question can never resolve. → `outOfField` unit test in Task 1, respawn wiring in Task 3.
4. **Pause or Esc during the 0.7–0.95 s post-correct delay.** There must be no double question start, and no start after leaving. → e2e in Task 3.
5. **Corrupt or out-of-range stored tuning** (bad JSON, gravity 99, missing fields). The game must use clamped or default values. → unit tests in Task 1.

---

## File Structure

```
src/game/physicsTuning.ts (+ .test.ts)  # PhysicsTuning type, defaults, clamp/parse, load/save
src/game/motion.ts (+ .test.ts)         # RestTimer, StuckTimer, outOfField, isResting — pure
src/game/Pegs.ts                        # builds peg rows (static bodies + Arc visuals), flash()
src/game/OptionBody.ts                  # ball-only, spin, upright label, launch(), heavy(), rest state
src/game/tuning.ts                      # layout constants updated; LEVEL_GRAVITY_FACTOR replaces LEVEL_FALL_FACTOR
src/game/effects.ts                     # bigger burst, shockwave, floatScore, centerCombo, shove, squash, sparks
src/audio/synth.ts, AudioService.ts     # 'peg' sfx, sfx(name, intensity?)
src/game/TuningPanel.ts                 # DOM panel (?debug only)
src/scenes/GameScene.ts                 # wiring
src/core/levels.ts (+ test)             # new time limits (Task 5)
scripts/measure-question-time.mjs       # Playwright measurement script (Task 5)
```

---

### Task 1: Pure helpers — tuning model and motion detectors

**Files:**
- Create: `src/game/physicsTuning.ts`, `src/game/physicsTuning.test.ts`, `src/game/motion.ts`, `src/game/motion.test.ts`

**Interfaces:**
- Produces:

```ts
// physicsTuning.ts (no Phaser import)
export type LaunchMode = 'toss' | 'drop';
export interface PhysicsTuning { gravity: number; bounce: number; air: number; pegs: boolean; launch: LaunchMode }
export const DEFAULT_TUNING: PhysicsTuning;           // {1, 0.75, 0.004, true, 'toss'}
export const TUNING_RANGES: { gravity: [0.3, 2]; bounce: [0.2, 0.95]; air: [0, 0.04] };
export const TUNING_STORAGE_KEY = 'funy-app:physics-tuning';
export function parseTuning(raw: unknown): PhysicsTuning;   // per-field: valid → clamped, invalid/missing → default
export function loadTuning(storage: Storage | null): PhysicsTuning;   // bad JSON / throw → DEFAULT_TUNING
export function saveTuning(storage: Storage | null, t: PhysicsTuning): void; // swallows errors

// motion.ts (no Phaser import)
export const REST_SPEED = 0.8;
export const REST_MISS_MS = 1500;
export const STUCK_NUDGE_MS = 1000;
export function isResting(speed: number, supported: boolean): boolean;   // supported && speed < REST_SPEED
export class RestTimer { update(dtMs: number, resting: boolean): number; get ms(): number; reset(): void }
export class StuckTimer { update(dtMs: number, slow: boolean, supported: boolean): boolean } // true once slow && !supported ≥ STUCK_NUDGE_MS, then resets
export function outOfField(x: number, y: number, width: number, groundY: number): boolean; // x < -100 || x > width+100 || y > groundY+200
```

- [ ] **Step 1: Write failing tests.**
  - `parseTuning(undefined)` → `DEFAULT_TUNING`.
  - `parseTuning({gravity: 99, bounce: 0.1, air: -1, pegs: 'x', launch: 'fly'})` → `{gravity: 2, bounce: 0.2, air: 0, pegs: true, launch: 'toss'}`.
  - `parseTuning({gravity: 0.5})` → `{...DEFAULT_TUNING, gravity: 0.5}`.
  - Map-backed storage round trip: `saveTuning` then `loadTuning` returns the same values.
  - Stored `'{bad'` → `DEFAULT_TUNING`.
  - `loadTuning(null)` → `DEFAULT_TUNING`.
  - `setItem` throwing → `saveTuning` doesn't throw.
  - `isResting(0.5, true)` → true; `isResting(0.5, false)` → false; `isResting(0.9, true)` → false.
  - `RestTimer`: `update(1000, true)` → 1000, then `update(600, true)` → 1600. `update(16, false)` → 0.
  - `StuckTimer`: `update(999, true, false)` → false, then `update(1, true, false)` → true, then the next `update(16, true, false)` → false (reset). `update(500, true, true)` resets.
  - `outOfField(-101, 300, 1280, 700)` → true; `(640, 901, 1280, 700)` → true; `(640, 300, 1280, 700)` → false.
- [ ] **Step 2:** `npx vitest run src/game` → FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** `npx vitest run && npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(game): physics tuning model and motion detectors`.

---

### Task 2: Marble world — balls, pegs, toss/drop launch, ceiling

**Files:**
- Create: `src/game/Pegs.ts`
- Modify: `src/game/OptionBody.ts`, `src/game/tuning.ts`, `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `PhysicsTuning`, `loadTuning`, `safeLocalStorage` (`src/core/store.ts`).
- Produces:
  - `tuning.ts`:
    - remove `LEVEL_FALL_FACTOR`, `BASE_GRAVITY_Y`, `FRICTION_AIR`, `RESTITUTION`, `PILL_W`, `PILL_H`, `SPAWN_Y`;
    - add `LEVEL_GRAVITY_FACTOR: Record<LevelId, number>` (start at `{1: 0.8, 2: 0.8, 3: 1, 4: 1, 5: 1, 6: 1}`; Task 5 confirms);
    - add `EXPR_RADIUS = 52`, `BALL_FRICTION = 0.05`, `BALL_DENSITY = 0.002`, `HEAVY_DENSITY = 0.006`, `SPAWN_STAGGER_MS = 220`, `TOSS_Y = QUESTION_AREA_BOTTOM + 50`, `PEG_ROWS_Y = [190, 253, 316, 380]`, `PEG_RADIUS = 9`;
    - set `WARNING_LINE_Y = 420`.
  - `class Pegs { constructor(scene: Phaser.Scene, enabled: boolean); static isPeg(body: MatterJS.BodyType): boolean; flash(body: MatterJS.BodyType): void; destroy(): void }`. Static circles labelled `'peg'`, restitution 0.9, 10/9 alternating per row across the width. Visuals are `Arc`s at depth 9. `flash` = scale 1.6 yoyo 70 ms.
  - `OptionBody`:
    - every option is a circle (radius `NUMBER_RADIUS`, or `EXPR_RADIUS` when the label contains `×`);
    - the ball visual is a `Graphics` circle with a white stripe and highlight, inside a container that rotates with the body;
    - the label `Text` is a separate object at depth 11 that copies the container's x/y every frame (`syncLabel()`) and never rotates;
    - `launch(t: PhysicsTuning, index: number, x?: number): void` replaces `drop()`. It creates the body (restitution `t.bounce`, frictionAir `t.air`, friction `BALL_FRICTION`, density `BALL_DENSITY`) and sets velocity/angular velocity per the toss/drop rules: toss side = `index % 2 === 0 ? left (x=70) : right (x=1210)`; drop uses the given x. It adds the 0.2 → 1 pop-in tween (220 ms, `Back.Out`);
    - `heavy(): void` sets density to `HEAVY_DENSITY`;
    - `speed(): number` returns the body speed or 0;
    - `respawn(t: PhysicsTuning): void` moves the body back to its toss/drop start with fresh velocity;
    - `vanish()` also destroys the label;
    - the `setInertia(Infinity)` call is removed.
  - `GameScene.buildWorld()`:
    - adds a static ceiling rectangle (label `'ceiling'`) whose bottom edge sits at `QUESTION_AREA_BOTTOM`;
    - builds `Pegs` from `tuning.pegs`;
    - `this.tuning = loadTuning(safeLocalStorage())` is read in `create()` and again at each `startQuestion()`. When `tuning.pegs` changes, the pegs are rebuilt.
  - Gravity: `setGravity(0, tuning.gravity * LEVEL_GRAVITY_FACTOR[levelId] * difficultyAt(i).fallSpeed)`.
  - The miss rule is still the old "touch ground" one in this task (Task 3 replaces it). The existing e2e must stay green.

- [ ] **Step 1:** Implement the changes above. They are visual and physics-only; the existing unit and e2e tests are the regression net.
- [ ] **Step 2:** Run `npx vitest run && npm run typecheck && npm run test:e2e`. Expected PASS. If the existing pile e2e times out because bouncing delays the first ground contact, raise only its poll timeout.
- [ ] **Step 3: Visual check.** Write a throwaway Playwright script in `/tmp`. Take screenshots of level 1 and level 3 (reverse-mode balls) at ~1.5 s and ~4 s after start into `.superpowers/sdd/2026-10-22-physics-juice/t2-*.png`, view them, and confirm:
  - pegs are visible;
  - balls are thrown from both sides and spin, with upright numbers;
  - nothing renders inside the question band;
  - `a × b` fits inside its ball.
- [ ] **Step 4:** Commit `feat(game): marble world with pegs, tosses and spinning balls`.

---

### Task 3: Rest-based miss, stuck/escape handling, post-correct flow

**Files:**
- Modify: `src/scenes/GameScene.ts`, `src/game/OptionBody.ts`, `src/game/debug.ts`
- Test: `e2e/game.spec.ts`, `e2e/boss.spec.ts`

**Interfaces:**
- Consumes: Task 1 `isResting`, `RestTimer`, `StuckTimer`, `outOfField`, `REST_MISS_MS`; Task 2 `OptionBody.speed()`, `respawn()`, `heavy()`.
- Produces:
  - `OptionBody`:
    - `lastSupportMs: number`, set by GameScene whenever a collision pair (start or active) touches `'ground'` or a grey pile option;
    - `supported(nowMs)` = `nowMs - lastSupportMs < 100`;
    - `rest: RestTimer`, `stuck: StuckTimer`;
    - `spawned: boolean` (true after `launch`);
    - state `'resolved'` is added: not clickable, not pile.
  - Remove `markLanded`, `checkAllCorrectLanded` and `onPile`-based miss logic. In `update()`, per option:
    - `syncLabel()`;
    - escaped (`outOfField(...)`) → `respawn(tuning)`;
    - `stuck.update(dt, speed < REST_SPEED, supported)` → nudge (`setVelocity(±2, -1)`);
    - `rest.update(dt, isResting(speed, supported))`.
  - Miss fires when every current option is `spawned`, the question isn't resolved, and every current correct option has `rest.ms ≥ REST_MISS_MS`.
  - `pileOptions()` = grey options of earlier serials. Overflow feeds `PileOverflowTracker` with the min `topY()` of pile options where `rest.ms > 0`.
  - On missed questions, options turn grey and `heavy()`; they stay in the world.
  - On correct / late correct:
    - all current options except the clicked one get `state = 'resolved'` immediately;
    - the clicked ball vanishes now;
    - the others vanish via `time.delayedCall(700)`;
    - the next question starts via the existing `pendingStart` mechanism with a 950 ms delay;
    - both delays use the scene clock, so pause holds them;
    - the guards check `leaving` and status.
  - On wrong: `heavy()` in addition to grey + shake.
  - The miss reveal stays as is (`MISS_REVEAL_MS`).
  - `debug.ts` adds `clickResolvedOption(): void`, which fires the pointer path on any `'resolved'` option of the current serial. GameScene implements `debugClickResolved()`.
  - Debug answers (`debugAnswer`, `debugDoubleClickCorrect`, `debugMiss`) still flush `pendingStart` first, so e2e stays fast.

- [ ] **Step 1: Write failing e2e tests** (`e2e/game.spec.ts`; every test first runs `localStorage.removeItem('funy-app:physics-tuning')` via `page.addInitScript`):
  - **Review Focus 1:** `answerCorrect()` → score 10, `questionIndex` 1. Then `clickResolvedOption()` → score still 10, `questionIndex` still 1.
  - **Review Focus 4:** `answerCorrect()`, then immediately press Space (pause). Wait 1500 ms → `questionIndex` 1 and `nextQuestionPending` true. Press Space → `nextQuestionPending` becomes false within 2 s and `questionIndex` stays 1. In a second test, `answerCorrect()` then Esc → scene `LevelSelect`, no page errors.
  - **Rest-based miss:** start level 1, don't click. Within 30 s, `questionIndex` becomes 1 by itself and `score` stays 0.
- [ ] **Step 2:** `npx playwright test e2e/game.spec.ts` → the new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run && npm run typecheck && npm run test:e2e && npx playwright test --repeat-each=5` → all PASS.
- [ ] **Step 5:** Commit `feat(game): rest-based misses, stuck/escape recovery, post-correct fade`.

---

### Task 4: Juice — effects and sounds

**Files:**
- Modify: `src/game/effects.ts`, `src/audio/synth.ts`, `src/audio/AudioService.ts`, `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `SessionEvent` (`correct` carries `scoreDelta`, `combo`, `x`, `y`), `OptionBody`, `Pegs.flash`.
- Produces:
  - `effects.ts`:
    - `explode(scene, x, y, small?)`: stars + confetti, lifespan ~900 ms, gravityY 600, speed 250–650, ~36 particles (half when `small`);
    - `shockwave(scene, x, y)`: white ring scaling 1 → 4 while fading, 450 ms;
    - `floatScore(scene, x, y, delta)`: `+N` text rising 120 px and fading, 900 ms; nothing when delta ≤ 0;
    - `centerCombo(scene, combo)`: 「N 连击！」 96 px at the field centre, scale 0.3 → 1.1 Back.Out, hold 300 ms, yoyo, ≈ 850 ms total; replaces `comboPopup`;
    - `shove(scene: Phaser.Scene, x: number, y: number, balls: OptionBody[])` (adds velocity via `scene.matter.body.setVelocity`; skips the origin ball, removed balls and balls without a body): radius 320, strength `(1 - d/320) × 16`, plus an upward −4 on vy;
    - `squash(scene, target)`: scaleY 0.78 / scaleX 1.15, 60 ms yoyo;
    - `spark(scene, x, y)` is kept (throttled).
    - Effect depths: particles, ring and float text at 20–30, combo at 40, all < 50 (band). `FX_DEPTH` is updated with a comment explaining the change (spec §7 allows effects over balls).
  - Correct-answer camera shake: `cameras.main.shake(120, 0.004)`. Boss levels keep their existing stronger shake and flash on boss hit.
  - Audio:
    - `SfxName` gains `'peg'`;
    - `sfx(name, intensity = 1)` with intensity clamped to 0..1 scales volume, and for `'peg'`/`'bump'` also pitch (peg ≈ 900 + 600 × intensity Hz sine blip ≈ 70 ms; bump ≈ 300 + 375 × intensity Hz);
    - `'peg'` is throttled at 35 ms in AudioService;
    - on correct, play `'correct'` (two rising tones) together with `'explode'`.
  - GameScene collision handling, from relative speed `v` of each pair involving an option:
    - peg hit → `pegs.flash(pegBody)` + `sfx('peg', v/15)`;
    - option vs ground with v > 5 → `squash`;
    - v > 4 → `spark`;
    - other option hits → `sfx('bump', v/15)`.
  - The 'correct' handler runs `explode` + `shockwave` + `floatScore(e.scoreDelta)` + camera shake + `shove` (over all non-removed options) + `centerCombo` when combo ≥ 3. The existing boss and voice logic stays as it is.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npx vitest run && npm run typecheck && npm run test:e2e` → PASS. No console errors.
- [ ] **Step 3: Visual check.** Use a throwaway Playwright script. Capture:
  - a correct answer mid-burst (shockwave visible, `+10` floating, neighbours shoved);
  - a 3-combo centre popup;
  - a peg flash.

  Save them to `.superpowers/sdd/2026-10-22-physics-juice/t4-*.png`, view them, and confirm the question band and HUD are never covered.
- [ ] **Step 4:** Commit `feat(game): marble juice — bursts, shockwave, shove, combo, peg sounds`.

---

### Task 5: Debug tuning panel, time-limit measurement, docs

**Files:**
- Create: `src/game/TuningPanel.ts`, `scripts/measure-question-time.mjs`, `e2e/tuning.spec.ts`
- Modify: `src/main.ts` (mount panel), `src/core/levels.ts`, `src/core/levels.test.ts`, `src/game/tuning.ts` (final `LEVEL_GRAVITY_FACTOR`), `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: `PhysicsTuning`, `TUNING_RANGES`, `DEFAULT_TUNING`, `loadTuning`, `saveTuning`, `safeLocalStorage`.
- Produces:
  - `mountTuningPanel(): void`. It is a no-op unless `location.search.includes('debug')`.
  - When active it appends a `<div id="tuning-panel">` below the canvas (fixed at the bottom, semi-transparent, not overlapping the canvas click area; the body may need `overflow:auto`). It contains labelled controls 重力, 弹性, 空气阻力, 弹珠钉, 出场方式, and a 「恢复默认」 button. Labels match the spike.
  - Each change calls `saveTuning`. 「恢复默认」 saves `DEFAULT_TUNING` and updates the controls. GameScene already re-reads tuning at each question.
  - `scripts/measure-question-time.mjs`:
    - a Node + Playwright script with no clicks, run against `npm run dev` on port 5199;
    - for each level 1–6 it clears tuning, calls `startLevel(n)`, waits until `questionIndex` reaches 20 or 25 questions' worth of time pass, and records the per-question duration from `questionStart` to miss;
    - durations exclude `MISS_REVEAL_MS`; the script reads them from `window.__funyDebug.state()` polling `questionIndex` and `nextQuestionPending`;
    - it prints per-level mean T and the proposed limits `round10(20 × T × 1.2)` for levels 1–2 and `round10(20 × T × 1.0)` for levels 3–6;
    - the time limit is temporarily irrelevant: it runs with `?debug&notime`. Add a debug-only `notime` flag that makes GameScene skip `session.tick` countdown failure. Simplest: when `notime` is present, call `session.tick(0)`. Document it in CLAUDE.md as measurement-only.

- [ ] **Step 1: Write the failing e2e** `e2e/tuning.spec.ts`:
  - `/?debug` → `#tuning-panel` visible.
  - `/` → `#tuning-panel` absent.
  - Set gravity to 1.5 via the input + dispatch `input`, reload → still 1.5.
  - 「恢复默认」 → gravity 1.
- [ ] **Step 2:** `npx playwright test e2e/tuning.spec.ts` → FAIL.
- [ ] **Step 3:** Implement the panel and mount it in `main.ts`.
- [ ] **Step 4: Gravity factor for levels 1–2.**
  - Take screenshots or a short look at level 1 with factor 0.8.
  - Keep 0.8 unless the balls look sluggish (no bounce off pegs), and record the decision in the report.
  - Run the measurement script. Put T per level and the computed limits into `LEVELS[].timeLimitSec`, and update the `levels.test.ts` expectation to the new array.
- [ ] **Step 5:** Update CLAUDE.md:
  - the physics tuning module and panel;
  - rest-based miss;
  - `notime`;
  - the measurement script;
  - the new anti-goal note that effects may cover balls but not the band or HUD.

  Add a line to README on `?debug` tuning.
- [ ] **Step 6:** `npx vitest run && npm run typecheck && npm run build && npm run test:e2e && npx playwright test --repeat-each=5` → PASS.
- [ ] **Step 7:** Commit `feat: debug tuning panel, measured time limits, docs`.
