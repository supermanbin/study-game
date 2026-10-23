# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Phaser 3 + TypeScript + Vite multiplication-table game for 2nd graders (九九乘法闯关). Spec: `docs/superpowers/specs/2026-10-22-multiplication-game-design.md` (read it before changing gameplay, scoring, wording or effects).

## Commands

```bash
npm run dev                  # vite dev server
npm run build                # tsc --noEmit && vite build
npm run typecheck
npx vitest run               # all unit tests (npm test is the same)
npx vitest run src/core/session.test.ts -t "combo"   # single unit test by name
npm run test:e2e             # Playwright; starts its own dev server on :5199
npx playwright test e2e/flow.spec.ts                 # single e2e file
node scripts/tts/generate.mjs [--force]              # regenerate voice mp3s
```

## Architecture

**Pure core, thin scenes.** `src/core/` has no Phaser imports and is unit-tested: `facts` (45 口诀), `questions`, `levels`, `progress`, `stats`, `store`, seeded `rng`, and `session.ts`. `LevelSession` is the single source of game rules (scoring, combo, items, timer, pass and star conditions). Scenes in `src/scenes/` and helpers in `src/game/` only render and forward input; never reimplement or duplicate a rule in a scene. A rule change goes in `LevelSession` plus its test.

**Event bus.** `GameScene` calls the session, then re-emits results as `'session-event'` on `this.events` (type `SessionEvent` in `GameScene.ts`). Effects (`src/game/effects.ts`), Boss, HUD and voice react to that event; add new reactions as listeners rather than inline in click handlers.

**Shared state via the Phaser registry**, keys `progress` (current `ProgressData`; replace with `registry.set`, don't mutate), `store` (a `ProgressStore`) and `audio` (`AudioService`). They are set in `BootScene`; `getProgress/getStore/getAudio` in `src/ui/theme.ts` read them. `ProgressStore` (`src/core/store.ts`) is the swap point for persistence: `LocalStorageProgressStore` today, a server-backed store later, with no scene changes. Always persist through `store.save`.

**HiDPI rendering.** The canvas is `RENDER_SCALE` × 1280×720 (`src/config.ts`, from devicePixelRatio and window size) and every scene must call `applyHiDpi(this)` (`src/ui/hiDpi.ts`) as the first line of `create()`. It zooms the main camera from the top-left so all layout, physics and input stay in 1280×720 design coordinates, and rasterizes Text at the same scale. Without it, a new scene renders at the wrong size; never lay out using `scale.width` / camera size. `e2e/hidpi.spec.ts` guards this at 2× DPR.

**Clay visuals.** Everything drawn is soft clay painted by `src/ui/clay.ts` (palette in `src/ui/palette.ts`, widgets in `src/ui/claywidgets.ts`): `bakeBall`, `bakeStripe`, `bakeRoundRect`, `bakeShape`, `bakeBackground` paint on a DOM canvas at `RENDER_SCALE` and register the result under a cache key `clay:<kind>:<colour hex>:<sizes...>:<RENDER_SCALE>` (`clayKey`), so asking again is a lookup. `BootScene` calls `bakeAll` (balls, stripes, fixed shapes, particles) and `prebakeHud`; never bake during gameplay frames (`e2e/clay.spec.ts` checks the texture count stays flat), and a new fixed-size texture belongs in a pre-bake. There is no 9-slice: each size gets its own texture. Show textures with `clayImage`, which sets scale `1/RENDER_SCALE` and the origin returned by the painter (the body centre, not the texture centre, because the drop shadow pads the lower right). Balls have two layers: a non-rotating shell (shadow, light from the upper left) and a rotating container holding only the white stripe; the label stays upright. Text is never clay-painted; ball labels take `labelStyleFor(colour)`, guarded by the contrast test in `src/ui/clay.test.ts`.

**Voice pipeline.** `content/voice-lines.json` (text + ids, 12 categories) -> `scripts/tts/generate.mjs` (provider in `scripts/tts/providers/`, edge-tts; honors `EDGE_TTS_BIN`, else `.venv-tts/bin/edge-tts`) -> `public/audio/voice/<id>.mp3` (committed) -> `src/audio/voiceLines.ts` / `AudioService`. `src/audio/voiceLines.test.ts` requires an mp3 for every id and checks that wrong/missed/levelFail lines avoid forbidden words, so after editing the JSON, regenerate before running tests. Setup: `python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts`.

## Debug hook and e2e

With `?debug` in the URL (or in dev mode) `src/game/debug.ts` installs `window.__funyDebug` from `MenuScene.create` (idempotent, so its existence implies Boot is done; e2e still waits for `state().scene === 'Menu'` before acting) (`answerCorrect`, `answerWrong`, `missCurrent`, `doubleClickCorrect`, `clickResolvedOption`, `startLevel`, `unlockAll`, `press(label)`, `state()`). The e2e tests in `e2e/` drive the canvas game only through this hook (the canvas has no DOM to click), so a new scene or action that e2e needs must be exposed through `DebuggableScene` methods or `debugState()`. `press(label)` triggers buttons registered by `src/ui/Button.ts` by label, so renaming a button label breaks e2e. After a miss the next question starts `MISS_REVEAL_MS` later (`state().nextQuestionPending`); the debug answer/miss actions start a pending question immediately so tests can chain them.

## Physics tuning, miss rule, measurement

- `src/game/physicsTuning.ts` (pure) holds `PhysicsTuning` (gravity, bounce, air, pegs, launch), `DEFAULT_TUNING`, `TUNING_RANGES` and `loadTuning`/`saveTuning` (localStorage key `funy-app:physics-tuning`). `GameScene` re-reads it at every question start, so changes apply from the next question. Effective gravity y = `tuning.gravity × LEVEL_GRAVITY_FACTOR[level] × difficultyAt(i).fallSpeed`.
- `src/game/TuningPanel.ts` (`mountTuningPanel`, called from `src/main.ts`) shows a `#tuning-panel` below the canvas only when `location.search` includes `debug` (not in plain dev mode). It has 重力/弹性/空气阻力/弹珠钉/出场方式 and 「恢复默认」; every change is saved immediately. e2e clears the storage key before each test.
- Misses are rest-based: a question is missed only once every option has spawned and all correct balls have rested for 1500 ms. A question therefore lasts several seconds without clicks, and `timeLimitSec` in `src/core/levels.ts` comes from measurement, not guesswork.
- `?debug&notime` (both required, so it never affects a normal session) freezes the countdown. It is measurement-only. `state().gameMs` is the game clock spent playing.
- `node scripts/measure-question-time.mjs` (dev server on port 5199) measures per-question time T without clicks on the game clock for levels 1-6 and prints `round10(20 × T × 1.2)` (levels 1-2) / `round10(20 × T × 1.0)` (levels 3-6). To cover the whole 20-question ramp (a no-click level overflows the pile after ~7-8 misses) each run answers every other question correctly through `answerCorrect` and samples only the unanswered ones; T is the mean of the per-index means over indices 0-19, also printed per 5-question bucket. Results depend on frame rate and host load: the game clock and the Matter runner share the per-frame cap `MAX_FRAME_DELTA_MS` (= runner `maxFrameTime`, 1000/30), but a loaded host still inflates T, so measure on a quiet machine (check `uptime`), run levels serially and check the printed gameClock/wall ratio (≈1). Re-run it after changing physics, then update `LEVELS` and `levels.test.ts`.

## Anti-goals from the spec (constrain every change)

- Never a negative score: a wrong click costs 5 points, but the score never goes below 0, and feedback stays gentle. Early levels must not be time-pressured (gravity per level is `LEVEL_GRAVITY_FACTOR` in `src/game/tuning.ts`; a question without clicks lasts until its correct balls have rested for 1500 ms, and `timeLimitSec` is measured from that, so the countdown must leave room for it).
- Gentle wording in UI and voice: no criticism (笨, 错了, 不行, 差劲, 失败).
- Reverse mode (look at the product, click the expression) must judge by evaluating the expression: `12 = 3×4` and `4×3` are both correct. Never compare to a stored pair.
- Effects stay short (about 1 s at most). They may draw above balls but must never cover the question band or the HUD (depth below 50).
- Random clicking must not yield a high score.
