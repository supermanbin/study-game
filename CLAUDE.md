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

**Voice pipeline.** `content/voice-lines.json` (text + ids, 12 categories) -> `scripts/tts/generate.mjs` (provider in `scripts/tts/providers/`, edge-tts; honors `EDGE_TTS_BIN`, else `.venv-tts/bin/edge-tts`) -> `public/audio/voice/<id>.mp3` (committed) -> `src/audio/voiceLines.ts` / `AudioService`. `src/audio/voiceLines.test.ts` requires an mp3 for every id and checks that wrong/missed/levelFail lines avoid forbidden words, so after editing the JSON, regenerate before running tests. Setup: `python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts`.

## Debug hook and e2e

With `?debug` in the URL (or in dev mode) `src/game/debug.ts` installs `window.__funyDebug` from `MenuScene.create` (idempotent, so its existence implies Boot is done; e2e still waits for `state().scene === 'Menu'` before acting) (`answerCorrect`, `answerWrong`, `missCurrent`, `doubleClickCorrect`, `startLevel`, `unlockAll`, `press(label)`, `state()`). The e2e tests in `e2e/` drive the canvas game only through this hook (the canvas has no DOM to click), so a new scene or action that e2e needs must be exposed through `DebuggableScene` methods or `debugState()`. `press(label)` triggers buttons registered by `src/ui/Button.ts` by label, so renaming a button label breaks e2e. After a miss the next question starts `MISS_REVEAL_MS` later (`state().nextQuestionPending`); the debug answer/miss actions start a pending question immediately so tests can chain them.

## Physics tuning, miss rule, measurement

- `src/game/physicsTuning.ts` (pure) holds `PhysicsTuning` (gravity, bounce, air, pegs, launch), `DEFAULT_TUNING`, `TUNING_RANGES` and `loadTuning`/`saveTuning` (localStorage key `funy-app:physics-tuning`). `GameScene` re-reads it at every question start, so changes apply from the next question. Effective gravity y = `tuning.gravity × LEVEL_GRAVITY_FACTOR[level] × difficultyAt(i).fallSpeed`.
- `src/game/TuningPanel.ts` (`mountTuningPanel`, called from `src/main.ts`) shows a `#tuning-panel` below the canvas only when `location.search` includes `debug` (not in plain dev mode). It has 重力/弹性/空气阻力/弹珠钉/出场方式 and 「恢复默认」; every change is saved immediately. e2e clears the storage key before each test.
- Misses are rest-based: a question is missed only once every option has spawned and all correct balls have rested for 1500 ms. A question therefore lasts several seconds without clicks, and `timeLimitSec` in `src/core/levels.ts` comes from measurement, not guesswork.
- `?debug&notime` (both required, so it never affects a normal session) freezes the countdown. It is measurement-only. `state().gameMs` is the game clock spent playing.
- `node scripts/measure-question-time.mjs` (dev server on port 5199, no clicks) measures per-question time T on the game clock for levels 1-6 and prints `round10(20 × T × 1.2)` (levels 1-2) / `round10(20 × T × 1.0)` (levels 3-6). Run levels serially: in parallel the physics lags the game clock and T is inflated. Re-run it after changing physics, then update `LEVELS` and `levels.test.ts`.

## Anti-goals from the spec (constrain every change)

- Never a negative score: a wrong click costs 5 points, but the score never goes below 0, and feedback stays gentle. Early levels must not be time-pressured (fall speed per level is `LEVEL_FALL_FACTOR` in `src/game/tuning.ts`; the falling time, not the countdown, is the real per-question limit).
- Gentle wording in UI and voice: no criticism (笨, 错了, 不行, 差劲, 失败).
- Reverse mode (look at the product, click the expression) must judge by evaluating the expression: `12 = 3×4` and `4×3` are both correct. Never compare to a stored pair.
- Effects stay short (about 1 s at most). They may draw above balls but must never cover the question band or the HUD (depth below 50).
- Random clicking must not yield a high score.
