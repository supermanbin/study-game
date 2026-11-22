# Phone portrait support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game plays on a phone held upright (720-wide portrait layout, chosen by window shape) while the desktop landscape experience stays identical apart from a new on-screen pause button and pause panel.

**Architecture:** A pure layout module (`src/layout/`) describes two layouts: landscape 1280×720 (today's numbers, pinned by test) and portrait 720×H (H 1280–1560). It covers field physics geometry, HUD geometry and menu-side screen geometry. Scenes and `src/game/` read the applied layout from the registry (`getLayout(scene)`) instead of constants. A layout switch is only applied between scenes (`startScene` → bake missing textures → `scale.setGameSize`). A window watcher decides per scene: menu pages re-open at once, Game pauses with a hint, Result waits. `LevelSession` picks the time limit by layout kind.

**Tech Stack:** Phaser 3.90 (Matter, ScaleManager FIT), TypeScript, Vite, Vitest, Playwright (desktop project plus a new mobile-portrait Chromium project).

**Spec:** `docs/superpowers/specs/2026-11-07-mobile-portrait-design.md` (read with the main spec `2026-10-22-multiplication-game-design.md` and `CLAUDE.md`).

## Global Constraints

- Pure core, thin scenes: rules stay in `LevelSession`; layout geometry is pure and unit-tested in `src/layout/`; scenes and `src/game/` only read it. Never lay out from `scale.width` or camera size.
- Landscape must not change except for the pause button and panel. `landscapeLayout()` equals today's constants (pinned by test), and the landscape `timeLimitSec` stays `[140, 150, 110, 110, 120, 110]`.
- `applyHiDpi(this)` is still the first line of every `create()`. `RENDER_SCALE` is fixed for the page load, and for a landscape window it equals today's formula.
- Layout selection: portrait iff `innerWidth < innerHeight`. Portrait width is 720 and `H = clamp(round(720 × vh / vw), 1280, 1560)`. A flip must be stable for 300 ms before it counts. H is computed only when a layout is chosen.
- No clay texture is baked during play or on scene entry. Baking happens only in Boot (`bakeLayout`) and in `applyPendingLayout` (between scenes).
- e2e drives the game only through `window.__funyDebug`, plus real pointer or touch where a task says so. New state is exposed via `debugState()` / `DebugState`.
- Gentle wording: new texts are exactly 暂停中, 继续游戏, 返回选关, 点空白处或按空格继续 (landscape), 点空白处也能继续 (portrait), 把手机竖过来，再点继续吧, 把手机横过来，再点继续吧, 1～5, 6～9. None of 笨/错了/不行/差劲/失败.
- Portrait text ≥ 22 design units everywhere, and portrait 口诀 cards ≥ 28 on one line.
- Effects stay at depth < 50, and the question band and HUD are never covered. Ball radii stay at 42 / 52. `LEVEL_GRAVITY_FACTOR` and the tuning panel are shared by both layouts.
- Single touch pointer (Phaser default `activePointers`). Do not add pointers, enlarge ball hit areas or use `viewport-fit=cover`.
- Commits: `type(scope): summary`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `feat/mobile-portrait`.

## Decisions beyond the spec (user may overturn)

1. **Portrait 口诀卡 page 「1～5」**: it has 5 columns, and the 5-character 「五五二十五」 at 28 px does not fit an equal-width card in 720. Card width is therefore set per column, as the widest 口诀 in that column × 28 + 16.
2. **Silent-loop audio fallback runs only on iOS.** Android and desktop have no mute switch, and a looping media element can raise a media notification on Android.
3. **Page background `#efe5d8` (`CLAY.bgOuter`) instead of `#fdf6e3`**, so the portrait letterbox bands match the canvas edge. On desktop this only tints the letterbox.
4. **Pause panel background is not interactive**, so a tap anywhere except the two buttons resumes. This keeps today's 「点一下继续」 and the existing `game.spec.ts` canvas-centre resume.
5. **The pause button only pauses.** Resuming is done from the panel, or Space.
6. **LAN port 4173.**

## Review Focus

1. **Rotation during the level-end hold.** Expected: no pause panel on a finished level, Result still starts after the hold, and the pending layout applies when Result starts. Test: Task 7, `rotate during the level-end hold`.
2. **Flip and flip back within 300 ms** (dragging a window edge, a wobbly phone). Expected: no relayout. Test: Task 7, `flip-flop inside the settle window does nothing`.
3. **A relayout that re-opens a page keeps its data.** Expected: the Cards page tab survives rotate → rotate back. Test: Task 7, `cards page survives relayout`.
4. **Fullscreen request rejected or unsupported** (debug `press` outside a gesture, iPhone Safari). Expected: LevelSelect opens with no page error. Test: Task 8, `开始游戏 still opens level select when fullscreen is refused`.
5. **Repeated touches and a rejected `play()` on the iOS silent loop.** Expected: one `<audio>` element, retried on the next gesture, never throws. Test: Task 8, `installSilentLoop creates one element and retries after a rejection`.

---

### Task 1: Pure layout module

**Files:**
- Modify: `src/core/types.ts` (add `LayoutKind`)
- Create: `src/layout/select.ts`, `src/layout/select.test.ts`
- Create: `src/layout/game.ts`, `src/layout/game.test.ts`
- Create: `src/layout/pegs.ts`, `src/layout/pegs.test.ts` (move `pegPositions` / `clearOfPegsX` out of `src/game/Pegs.ts`; delete `src/game/Pegs.test.ts` after porting its cases)
- Modify: `src/game/Pegs.ts`, `src/game/OptionBody.ts` (import from `src/layout/pegs`, passing `landscapeLayout().field` until Task 2)

**Interfaces:**
- Produces:
  - `type LayoutKind = 'landscape' | 'portrait'` in `src/core/types.ts`.
  - In `select.ts`:
    - `interface DesignSize { kind: LayoutKind; width: number; height: number }`
    - constants `PORTRAIT_WIDTH = 720`, `PORTRAIT_MIN_H = 1280`, `PORTRAIT_MAX_H = 1560`, `LAYOUT_SETTLE_MS = 300`
    - functions `layoutKindFor(vw, vh): LayoutKind`, `portraitHeight(vw, vh): number`, `designSize(vw, vh): DesignSize`, `renderScaleFor(size: DesignSize, dpr, vw, vh): number`
    - `type SwitchAction = 'none' | 'relayout' | 'gameMismatch' | 'gameMatch'` and `switchAction(applied: LayoutKind, wanted: LayoutKind, sceneKey: string): SwitchAction`
  - In `game.ts`:
    - types `Box {x,y,w,h}`, `TextBox extends Box {fontSize}`, `FieldLayout`, `HudLayout`, `Layout { kind; width; height; field: FieldLayout; hud: HudLayout }`
    - functions `landscapeLayout(): Layout`, `portraitLayout(height: number): Layout`, `layoutFor(size: DesignSize): Layout`
    - constant `PILE_H_PORTRAIT = 440`
  - In `pegs.ts`: `pegPositions(field: FieldLayout): {x,y}[]` and `clearOfPegsX(x, y, r, min, max, field: FieldLayout): number`. Same algorithms as today, with rows, spacing, per-row counts `[even, odd]` and width read from `field`.

`FieldLayout` fields: `width, height, ceilingY, groundY, warningY, spawnXMin, spawnXMax, tossY, tossInset, pegRowsY: readonly number[], pegSpacing, pegCounts: readonly [number, number], floorH`.

`HudLayout` fields:
- `band: Box`
- `prompt: {x, y, fontSize}`
- `score: TextBox`, `combo: TextBox`
- `time: TextBox & { prefix: string }`
- `pause: Box`
- `items: { y, w, h, fontSize, x: Record<ItemKind, number>, keyHints: boolean }`
- `reveal: TextBox`
- `boss: {x, y}`
- `pausePanel: { w, h, hint: string }`

| | landscape | portrait(H) |
|---|---|---|
| field | width 1280, height 720, ceilingY 140, groundY 700, warningY 520, spawnX 120–1160, tossY 190, tossInset 70, pegRowsY [240,320,400,480], pegSpacing 195, pegCounts [6,5], floorH 40 | width 720, height H, ceilingY 226, groundY H−40, warningY groundY−440, spawnX 80–640, tossY 276, tossInset 70, pegRowsY `k=1..4: round(226 + (warningY−226)·k/5)`, pegSpacing 160, pegCounts [4,3], floorH 60 |
| band / prompt | {640,70,1252,120} / {640,50,64} | {360,141,696,150} / {360,106,72} |
| score / combo | {119,38,190,44,28} / {301,38,150,36,24} | {87,34,150,44,24} / {231,34,118,40,22} |
| time | {1171,42,170,52,34, prefix '时间 '} | {574,34,120,44,28, prefix ''} |
| pause | {1042,42,64,48} | {676,34,64,44} |
| items | y 106, w 150, h 38, fs 21, x {freeze 99, magnifier 261}, keyHints true | y 186, w 140, h 40, fs 22, x {freeze 94, magnifier 246}, keyHints false |
| reveal / boss | {640,110,280,44,30} / {1190,92} | {360,250,340,44,30} / {660,186} |
| pausePanel | {560,440,'点空白处或按空格继续'} | {560,440,'点空白处也能继续'} |

`switchAction`:
- If `wanted === applied`: return `'gameMatch'` for `Game`, otherwise `'none'`.
- Otherwise: return `'relayout'` for `Menu`, `LevelSelect`, `Cards` and `Settings`; `'gameMismatch'` for `Game`; `'none'` for anything else (`Result`, `BootScene`).

`renderScaleFor`: `min(3, max(1, ceil(dpr × max(vw/size.width, vh/size.height) × 2) / 2))`. For landscape this is exactly today's formula.

- [ ] **Step 1: Write the failing tests**

`select.test.ts`:
- `layoutKindFor`: (1280,720) → landscape, (720,720) → landscape, (390,844) → portrait.
- `portraitHeight`: (390,844) → 1558, (720,1280) → 1280, (768,1024) → 1280, (360,900) → 1560.
- `designSize` returns `{landscape,1280,720}` / `{portrait,720,1558}`.
- `renderScaleFor` matches a local `legacy(dpr,vw,vh)` copy of today's formula for (1,1280,720), (2,1512,860), (3,3000,2000) and (1,800,600).
- `renderScaleFor(designSize(390,844), 3, 390, 844) === 2`.
- `switchAction` covers all 12 cases above (6 scene keys × same/different kind).

`game.test.ts`:
- `landscapeLayout()` deep-equals the landscape column, including `hud`.
- For H ∈ [1280, 1400, 1558, 1560]:
  - `groundY === H − 40` and `groundY − warningY === 440`.
  - `720 × 440 ≥ 1280 × 180`.
  - `band` lies within x 0..720, and its bottom (y + h/2) is ≤ `ceilingY`.
  - Every HUD box lies within 0..720.
  - The top-row boxes (score, combo, time, pause) don't overlap.
  - The item boxes end left of the boss HP bar start, which is `boss.x − 30 − 252 − 12` (`Boss.ts` geometry).
  - Every HUD `fontSize` and the prompt size are ≥ 22.

`pegs.test.ts`: port the four `pegPositions` cases and two `clearOfPegsX` cases into a `describe.each` over `[landscapeLayout(), portraitLayout(1280), portraitLayout(1560)]`:
- Counts per row match `pegCounts`.
- Any two pegs are more than `2 × (EXPR_RADIUS + PEG_RADIUS)` apart.
- `min(p.x, width − p.x) − PEG_RADIUS > 2 × EXPR_RADIUS`.
- Every peg is above `warningY`.
- `clearOfPegsX` swept over `[spawnXMin, spawnXMax]` at `y = ceilingY + EXPR_RADIUS + 2` never overlaps row 0 and stays in range.

- [ ] **Step 2: Run** `npx vitest run src/layout`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `select.ts`, `game.ts`, `pegs.ts`** with the values above.
  - `PEG_RADIUS`, `EXPR_RADIUS` and `NUMBER_RADIUS` stay in `src/game/tuning.ts`; `pegs.ts` imports them from there.
  - Remove the two functions from `Pegs.ts`.
  - Point `Pegs.ts` and `OptionBody.ts` at `src/layout/pegs`, with `landscapeLayout().field`.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(layout): pure landscape/portrait layout, selection and peg geometry`

---

### Task 2: Read the layout everywhere (landscape only, no visible change)

**Files:**
- Modify: `src/config.ts` (drop `GAME_WIDTH`/`GAME_HEIGHT`; `RENDER_SCALE = renderScaleFor(designSize(innerWidth, innerHeight), devicePixelRatio, innerWidth, innerHeight)`, or `1` without `window`)
- Modify: `src/main.ts` (`const initial = landscapeLayout()`; game size `initial.width/height × RENDER_SCALE`; `game.registry.set('layout', initial)` in `callbacks.preBoot`)
- Modify: `src/ui/theme.ts` (`getLayout`, `title()` centred on `getLayout(scene).width / 2`)
- Modify: `src/game/tuning.ts` (remove `GROUND_Y`, `WARNING_LINE_Y`, `QUESTION_AREA_BOTTOM`, `SPAWN_X_*`, `TOSS_Y`, `PEG_ROWS_Y`, `PEG_SPACING`; keep radii, densities, timings)
- Modify: `src/ui/clay.ts` (`bakeBackground(scene, w, h)`, key `clay:bg:<w>:<h>`, radial gradient from inner circle `(w/2, h·330/720, 40)` to outer circle `(w/2, h/2, 0.625·max(w,h))`, which reproduces today's `(640,330,40) → (640,360,800)` at 1280×720; `bakeAll(scene, size: {width, height})`)
- Modify: `src/ui/claywidgets.ts` (`clayBackground` uses `getLayout(scene)` size)
- Modify: `src/game/Hud.ts`, `src/game/Pegs.ts`, `src/game/OptionBody.ts`, `src/game/effects.ts`, `src/scenes/GameScene.ts`, `src/scenes/BootScene.ts`, `src/scenes/MenuScene.ts`, `src/scenes/ResultScene.ts`
- Modify: `src/scenes/prebake.ts` (`bakeLayout(scene, layout)` = `bakeAll(scene, layout)` + `prebakeHud(scene, layout)` + `prebakeScenes(scene, layout)`; Boot calls `bakeLayout(this, getLayout(this))`)
- Modify: `src/game/debug.ts` (`DebugState.layout: { kind: LayoutKind; width: number; height: number }`, filled from registry `layout` in `state()`)
- Test: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: Task 1 `Layout`, `FieldLayout`, `landscapeLayout`, `designSize`, `renderScaleFor`, `pegPositions`, `clearOfPegsX`.
- Produces:
  - `getLayout(scene: Phaser.Scene): Layout` (registry key `'layout'`; changes only between scenes).
  - `bakeLayout(scene, layout)`, `prebakeHud(scene, layout)`, `prebakeScenes(scene, layout)`, `bakeAll(scene, size)`, `bakeBackground(scene, w, h)`.
  - `new Pegs(scene, enabled, field)`, `new OptionBody(scene, spec, field)`.
  - `new Hud(scene, layout, { onItem, onResume })`: geometry from `layout.hud`; floor `layout.width × field.floorH`; time text `${prefix}m:ss`; item label `${keyHints ? '1 ' : ''}冰冻 ×n` and `${keyHints ? '2 ' : ''}放大镜 ×n`.
  - `effects.ts` reads `getLayout(scene)` for `ceilingY` (burst / shockwave / floatScore minimum y), the floatScore x clamp `60..width−60`, and centreCombo at `(width/2, height/2)`.
  - GameScene keeps `this.layout = getLayout(this)` from `create()`. It builds ground, walls and ceiling from `field`, creates the `PileOverflowTracker(field.warningY, …)` in `create()`, and uses `field.ceilingY` in the pointer guard, spawn slots, `outOfField(width, groundY)` and the Boss at `hud.boss`.

- [ ] **Step 1: Add the failing e2e assertion.** In `smoke.spec.ts` add test `debug state reports the landscape layout`: go to `/?debug`, wait for Menu, and expect `state().layout` toEqual `{ kind: 'landscape', width: 1280, height: 720 }`.
- [ ] **Step 2: Run** `npx playwright test e2e/smoke.spec.ts`. Expected: FAIL (`layout` undefined).
- [ ] **Step 3: Apply the refactor above.** `grep -rn "GAME_WIDTH\|GAME_HEIGHT\|GROUND_Y\|WARNING_LINE_Y\|QUESTION_AREA_BOTTOM\|SPAWN_X_\|TOSS_Y\|PEG_ROWS_Y\|PEG_SPACING" src` must return nothing.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run && npm run test:e2e`. Expected: all pass, unchanged. `clay.spec.ts` still finds `clay:bg:1280:720` behaviour and no texture growth.
- [ ] **Step 5: Commit** `refactor(layout): scenes and game code read the applied layout`

---

### Task 3: Pause button and pause panel (both layouts)

**Files:**
- Modify: `src/ui/clay.ts` (new `ClayShape` `'pause'`, `SHAPE_SIZE.pause = {w: 22, h: 24}`: two rounded bars 8×24, radius 4, 6 apart; default colour `CLAY.ink2`)
- Modify: `src/ui/Button.ts`:
  - New `ButtonOpts.icon?: ClayShape`. The button shows the clay icon instead of the label text and still registers under `label`.
  - `buttonLook` height becomes `opts.icon ? (opts.height ?? 44) : Math.max(64, opts.height ?? 72)`.
- Modify: `src/game/Hud.ts`:
  - Pause button and the new overlay. Export `PAUSE_RESUME_BUTTON = {width 320, height 88, fontSize 40, color CLAY.primary}`, `PAUSE_EXIT_BUTTON = {width 320, height 72, fontSize 32, color BALL_COLORS[1]}` and `pauseButtonOpts(layout) = {width: hud.pause.w, height: hud.pause.h, color: CLAY.plaque, icon: 'pause'}`.
  - `prebakeHud` also bakes the pause panel and these three buttons.
- Modify: `src/scenes/GameScene.ts` (callbacks `onPause: () => setPaused(true)`, `onExit: () => exitToLevelSelect()`)
- Create: `e2e/support.ts` (shared helpers: `dbg`, `press`, `sceneIs`, `waitMenu`, `startLevel`, `toPage(page, x, y)` using `state().layout` size, `tap(page, x, y)` = touchscreen when the project has touch, otherwise mouse)
- Create: `e2e/pause.spec.ts`

**Interfaces:**
- Consumes: Task 2 `Hud(scene, layout, …)`, `layout.hud.pause`, `layout.hud.pausePanel`.
- Produces:
  - `interface HudCallbacks { onItem(kind: ItemKind): void; onPause(): void; onResume(): void; onExit(): void }`
  - `new Hud(scene, layout, callbacks)`, `Hud.setRotateHint(text: string | null): void` (used by Task 7)
  - `Hud.swallowsClick` also covers the pause button and both overlay buttons.

Overlay contents:
- Full-screen shade (`CLAY.bgInner`, alpha 0.75), interactive; `pointerdown` calls `onResume`.
- Panel `pausePanel.w × h` at the screen centre (not interactive).
- Offsets from the centre:
  - 暂停中: dy −150, fs 52, `CLAY.ink`
  - 继续游戏 button: dy −45
  - 返回选关 button: dy +60
  - `pausePanel.hint`: dy +130, fs 24, `CLAY.ink2`
  - Rotate hint: dy +180, fs 26, `CLAY.accent`, hidden while null
- All of it sits at depth ≥ 110. The pause button sits at `hud.pause`, depth 100, label 暂停.

- [ ] **Step 1: Write `e2e/pause.spec.ts`**
  - `pause button pauses and 继续游戏 resumes`: `startLevel(1)`, `press('暂停')`, poll status `paused`, `timeLeftMs` unchanged after 1000 ms; `press('继续游戏')`, poll `playing`.
  - `返回选关 leaves to level select`: `press('暂停')`, `press('返回选关')`, `sceneIs('LevelSelect')`.
  - `tapping outside the panel resumes`: `press('暂停')`, `tap(toPage(20, layout.height − 20))`, poll `playing`, score unchanged.
  - Each test collects `pageerror` and expects none.
- [ ] **Step 2: Run** `npx playwright test e2e/pause.spec.ts`. Expected: FAIL (no 暂停 button).
- [ ] **Step 3: Implement** the shape, the icon button, the Hud overlay and the GameScene callbacks.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run && npm run test:e2e`. Expected: all pass, including `game.spec.ts` (Space toggle, canvas-centre click resumes because the panel is not interactive) and `clay.spec.ts` (no new texture during play).
- [ ] **Step 5: Commit** `feat(game): on-screen pause button and pause panel with resume and exit`

---

### Task 4: Portrait game on a phone viewport

**Files:**
- Modify: `src/main.ts` (`const initial = layoutFor(designSize(innerWidth, innerHeight))`)
- Modify: `playwright.config.ts`:
  - `projects`: `desktop` (current `use`, `testIgnore: '**/mobile/**'`) and `mobile` (`viewport {390, 844}`, `deviceScaleFactor 3`, `isMobile true`, `hasTouch true`, `testMatch: ['**/mobile/**/*.spec.ts', '**/pause.spec.ts']`).
  - Rationale: `pause.spec.ts` runs in both projects.
- Modify: `src/game/OptionBody.ts` (`debugInfo()` adds `correct: boolean`, `clickable: boolean`), `src/game/debug.ts` (types)
- Modify: `src/scenes/GameScene.ts` (`debugState().prompt = { text, width }` from the Hud prompt Text, via a `Hud.promptInfo()` getter)
- Create: `e2e/mobile/game.spec.ts`
- Modify: `e2e/support.ts`: add `tapCorrectBall(page): Promise<boolean>`. It tries up to 15 times: find a ball with `correct && clickable` and `y > layout ceilingY` (portrait 226, landscape 140, from `state().layout.kind`), tap it via `tap(toPage(x, y))`, then poll for a score increase or a `questionIndex` change for 600 ms. Task 7 reuses it.
- Create: `scripts/screenshot-portrait.mjs` (dev server :5199; viewport 390×844 at DPR 3; saves `/tmp/portrait-<name>.png` for Menu, Game L1 after 3 balls spawned, Game L3 (boss), and the pause panel; later tasks append screens)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `DebugState.balls[].correct/clickable`, `DebugState.prompt`, and the `mobile` Playwright project.

- [ ] **Step 1: Write `e2e/mobile/game.spec.ts`**
  - `reports the portrait layout`: `state().layout` toEqual `{portrait, 720, 1558}`.
  - `canvas renders at the screen pixel density`: backing width ≥ 0.9 × CSS width × DPR (as `hidpi.spec.ts`).
  - `a real touch on the correct ball scores`: `startLevel(1)`, expect `await tapCorrectBall(page)` to be true, then expect the score ≥ 10.
  - `the longest prompts fit the band on one line`:
    - `unlockAll`, `startLevel(4)`.
    - For 20 questions, record `prompt.width`, then call `answerCorrect`.
    - Expect the maximum ≤ `696 − 24`.
  - `gameplay allocates no named textures`: same as the `clay.spec.ts` test, in portrait.
- [ ] **Step 2: Run** `npx playwright test --project=mobile e2e/mobile/game.spec.ts`. Expected: FAIL (layout landscape).
- [ ] **Step 3: Implement** the items above.
- [ ] **Step 4: Run** `npx playwright test --project=mobile && npx playwright test --project=desktop`. Expected: all pass. Then run `node scripts/screenshot-portrait.mjs` and open the Game PNGs. Check that the prompt, items, boss, top row and pause button are inside the band or top row and that nothing overlaps.
- [ ] **Step 5: Commit** `feat(layout): portrait game screen selected by window shape; mobile e2e project`

---

### Task 5: Portrait Boot, Menu, LevelSelect, Settings

**Files:**
- Create: `src/layout/screens.ts`, `src/layout/screens.test.ts`
- Modify: `src/ui/Button.ts` (`ButtonOpts.subtitleSize?: number`, default 20)
- Modify: `src/scenes/BootScene.ts`, `MenuScene.ts`, `LevelSelectScene.ts`, `SettingsScene.ts`, `prebake.ts` (level tiles baked with `levelTileOpts(lv, i, locked, layout.kind)`)
- Create: `e2e/mobile/screens.spec.ts`; extend `scripts/screenshot-portrait.mjs` (Menu, LevelSelect, Settings)

**Interfaces:**
- Consumes: `Layout` (only `kind`, `width`, `height` are used here).
- Produces (all pure, positions in design px; `L` is `{kind, width, height}`):
  - `menuScreen(L)` returns `{ balls: {y, step}, title: {y, size}, subtitle: {y, size}, start: {x,y}, cards: {x,y}, settings: {x,y} }`.
  - `levelSelectScreen(L)` returns `{ title: {y, size}, tile: {w, h, fontSize, subtitleSize}, tiles: {x,y}[6], starsDy, lock: {dx, dy}, back: {x,y} }`.
  - `settingsScreen(L)` returns `{ title: {y, size}, rows: { button: {x,y}, toggle: {x,y}, state: {x,y} }[3], stateSize, back: {x,y} }`.
  - `levelTileOpts(lv, i, locked, kind)` takes the tile size from `levelSelectScreen`.

| | landscape (today) | portrait (H) |
|---|---|---|
| menu | balls y 62 step 130; title y 170 size 96; subtitle y 255 size 30; buttons x 640, y 380/495/595 | balls y .17H; title .27H; subtitle .35H; buttons x 360, y .50H/.61H/.70H (sizes as landscape) |
| level select | title y 60 size 56; tile 340×150 fs 40 sub 20; tiles x 240+(i%3)·400, y 200+⌊i/3⌋·190; back (640,620) | title .08H; tile 310×200 fs 40 sub 24; tiles x [190,530][i%2], y [.27H,.46H,.65H][⌊i/2⌋]; back (360, H−110) |
| both | starsDy = tile.h/2 − 29; lock dx = tile.w/2 − 40, dy = −tile.h/2 + 33 | (same formula) |
| settings | title y 90 size 64; row y 230+120i, button x 640, toggle (850, y−8), state (850, y+34) size 22; back (640,620) | title .12H; row y round(.30H)+i·round(.13H), button x 300, toggle (560, y−8), state (560, y+34) size 22; back (360, H−128) |

All fractions of H are `Math.round`ed. Boot centres its title on `(width/2, height/2)`.

- [ ] **Step 1: Write `screens.test.ts`**
  - `landscape screens equal today's coordinates`: spot-check every row of the landscape column.
  - For H ∈ [1280, 1558, 1560] and each portrait screen: every button rect (x ± w/2, y ± h/2, using its `ButtonOpts` size), toggle (84×44) and text centre lies within 720 × H. Vertical button rects don't overlap. Every font size, including `tile.subtitleSize`, is ≥ 22.
- [ ] **Step 2: Run** `npx vitest run src/layout/screens.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `screens.ts`, `subtitleSize`, and the four scenes reading `menuScreen(getLayout(this))` etc. `prebakeScenes(scene, layout)` bakes tiles for `layout.kind`.
- [ ] **Step 4: Write `e2e/mobile/screens.spec.ts`**
  - `menu, level select and settings work in portrait`: press 开始游戏 → LevelSelect → 返回 → 设置, toggle 音乐 twice → 返回 → Menu. Expect no `pageerror`.
  - `a real tap on 开始游戏 lands`: find the button container by its text (as in `hidpi.spec.ts`), `tap(toPage(btn.x, btn.y))`, expect LevelSelect.
  - `no clay texture is added after Boot`: Boot count equals the count after the loop above.
- [ ] **Step 5: Run** `npx vitest run && npx playwright test --project=mobile && npx playwright test --project=desktop`. Expected: all pass. Screenshot the three screens, open them, and check that nothing is clipped or overlapping.
- [ ] **Step 6: Commit** `feat(layout): portrait boot, menu, level select and settings`

---

### Task 6: Portrait Result and 口诀卡册 pages

**Files:**
- Modify: `src/layout/screens.ts`, `src/layout/screens.test.ts`
- Modify: `src/scenes/ResultScene.ts`, `src/scenes/CardsScene.ts`, `src/scenes/prebake.ts`, `src/game/debug.ts`
- Modify: `e2e/mobile/screens.spec.ts`; extend `scripts/screenshot-portrait.mjs` (Result passed / failed, Cards both pages)

**Interfaces:**
- Produces:
  - `resultScreen(L)` returns `{ panel: Box, title: {x,y,size}, reason: {x,y,size}, starsY, counts: Record<CountLine, {x,y,size}>, buttonsAt(n: 2 | 3): {x,y}[], confetti: {y, dx} }`.
  - `cardPages(): [Fact[], Fact[]]`: b ≤ 5 / b ≥ 6, in `ALL_FACTS` order.
  - `cardGrid(L, page: 0 | 1)` returns `{ fontSize, cards: { fact, x, y, w, h }[] }`. In landscape it lists all 45 cards and ignores `page`.
  - `cardsScreen(L)` returns `{ title: {x,y,size}, tabs: {x,y}[] /* portrait only */, back: {x,y} }`.
  - Exports `CARD_TAB_ACTIVE = {width 180, height 64, fontSize 32, color CLAY.primary}` and `CARD_TAB_IDLE` (same with `BALL_COLORS[5]`).
  - `bakeCard(scene, f, lit, w, h)`.
  - CardsScene `init(data: { page?: 0 | 1 })`. Tabs 1～5 and 6～9 call `this.scene.restart({ page })`.
  - `DebugState.cardsPage?: 0 | 1` (portrait only) and `cardsShown: number`.

Result:
- Landscape is unchanged: panel {640,282,780,510}, title (640,90) 72, reason (640,160) 32, starsY 255, counts y 350/405/455 sizes 40/36/36, buttons y 600 at x = 640 + (k − (n−1)/2)·330, confetti {120, 300}, order 再玩一次, 下一关?, 选关.
- Portrait, with `top = round(.06H)`:
  - panel {360, top+310, 640, 620}
  - title (360, top+80) 72; reason (360, top+150) 32
  - starsY top+270; counts y top+400/465/530
  - buttons x 360, y_k = H − round(.08H) − (n−1−k)·110
  - confetti {top+40, 200}
  - button order top to bottom: 下一关?, 再玩一次, 选关
- Button opts are unchanged; the portrait panel is a new pre-baked size.

Cards:
- Landscape is unchanged (112×54 cards, 118 pitch, fs 20, back (1130,665), one page).
- Portrait:
  - title (360, round(.06H)) 40, same text `口诀卡册    已点亮 x / 45` on both pages
  - tabs y round(.13H), x [250, 470]
  - cards: fs 28, h 64, row pitch 72 (row = a), first row centre round(.20H)+32, column = b
  - card width per column = (most characters of any 口诀 in that column) × 28 + 16
  - columns 6 px apart, grid centred on x 360
  - back (360, H−100)

- [ ] **Step 1: Extend `screens.test.ts`**
  - `cardPages splits 15 + 30 and covers all 45 once`.
  - For H ∈ [1280, 1560], `cardGrid(portrait, page)`:
    - Page 0 has 15 cards in 5 columns and page 1 has 30 in 4 columns × 9 rows.
    - No two card rects overlap.
    - All cards lie within 0..720 and below the tabs.
    - Every `w ≥ koujue(f).length × 28 + 16`.
    - `fontSize ≥ 28`.
  - `landscape cardGrid keeps today's positions` (spot-check 1×1, 1×9 and 9×9).
  - Portrait `resultScreen`: panel within the screen, buttons below the panel, no overlaps, sizes ≥ 22.
- [ ] **Step 2: Run** `npx vitest run src/layout`. Expected: FAIL.
- [ ] **Step 3: Implement** the two scenes and the prebake. `prebakeScenes` bakes the portrait cards (both widths, lit and unlit per fact), the tabs in both colours and the portrait result panel only when `layout.kind === 'portrait'`.
- [ ] **Step 4: Extend `e2e/mobile/screens.spec.ts`**
  - `menu to result by press in portrait` (spec §13): Menu → `press('开始游戏')` → `press('第1关')` → Game → 20× `answerCorrect` → Result, `celebrating` true then false → `press('下一关')` → Game (level 2) → 20× `missCurrent` → Result → `press('再玩一次')` → Game → `press('暂停')` → `press('返回选关')` → LevelSelect → `press('返回')` → Menu. Expect no `pageerror`.
  - `cards pages`: Cards → `cardsPage 0`, `cardsShown 15` → `press('6～9')` → `cardsPage 1`, `cardsShown 30` → `press('1～5')` → 15.
  - Extend the no-new-clay test to cover Result and both Cards pages.
- [ ] **Step 5: Run** `npx vitest run && npx playwright test --project=mobile && npx playwright test --project=desktop`. Expected: all pass. Screenshot Result (3★ and failed) and both Cards pages, open them, and check for clipping or overlap.
- [ ] **Step 6: Commit** `feat(layout): portrait result and two-page 口诀卡册`

---

### Task 7: Layout switching on rotation

**Files:**
- Create: `src/layout/apply.ts`
- Modify: `src/main.ts` (`installLayoutWatcher(game, bakeLayout)`)
- Modify: `src/scenes/{Boot,Menu,LevelSelect,Cards,Settings,Result,Game}Scene.ts`: every `this.scene.start(...)` becomes `startScene(this, ...)`. Settings' toggle `restart()` and the Cards tab `restart({page})` stay.
- Modify: `src/game/debug.ts` (`startLevel` calls `applyPendingLayout(game, <any active scene>)` before starting; `DebugState.rotateHint?: boolean`)
- Modify: `src/scenes/GameScene.ts` (mismatch listener)
- Create: `e2e/mobile/rotate.spec.ts`

**Interfaces:**
- Consumes: `designSize`, `layoutFor`, `switchAction`, `LAYOUT_SETTLE_MS`, `Hud.setRotateHint`, `bakeLayout`.
- Produces:
  - `installLayoutWatcher(game: Phaser.Game, bake: (scene: Phaser.Scene, layout: Layout) => void): void`. The baker is injected so that `apply.ts` does not import the scenes (avoids an import cycle).
  - `applyPendingLayout(game: Phaser.Game, baker: Phaser.Scene): boolean`. If registry `pendingLayout` is set: remove it, bake it, set registry `layout`, then `game.scale.setGameSize(width × RENDER_SCALE, height × RENDER_SCALE)`.
  - `startScene(from: Phaser.Scene, key: string, data?: object): void` = `applyPendingLayout(from.game, from)` then `from.scene.start(key, data)`.
  - `LAYOUT_MISMATCH_EVENT = 'layout-mismatch'`, emitted on `game.events` with `(mismatch: boolean)`.

Watcher:
- On every window `resize`, reset a `LAYOUT_SETTLE_MS` timer.
- When the timer fires:
  - `wanted = designSize(innerWidth, innerHeight)` and `applied = registry layout`.
  - Set registry `pendingLayout = wanted.kind !== applied.kind ? layoutFor(wanted) : undefined`.
  - Act on `switchAction(applied.kind, wanted.kind, activeKey)`:
    - `relayout` → `startScene(active, activeKey, active.sys.settings.data)`
    - `gameMismatch` → emit `true`
    - `gameMatch` → emit `false`
    - `none` → nothing

GameScene, on `true`:
- `hud.setRotateHint(layout.kind === 'portrait' ? '把手机竖过来，再点继续吧' : '把手机横过来，再点继续吧')`.
- Then `setPaused(true)`, which is ignored unless playing. If the session is not playing or paused, the hint is not set.

GameScene, on `false`: `hud.setRotateHint(null)` and stay paused. Remove the listener on SHUTDOWN.

- [ ] **Step 1: Write `e2e/mobile/rotate.spec.ts`** (rotate means `page.setViewportSize({width: 844, height: 390})`, rotate back means `{390, 844}`):
  - `in game: rotating pauses with a hint and keeps the layout`:
    - `startLevel(1)`, rotate, then poll: status `paused`, `rotateHint` true, `layout.kind` `portrait`.
    - Rotate back → `rotateHint` false, still `paused`.
    - `press('继续游戏')` → `playing`.
    - Rotate → `press('返回选关')` → LevelSelect with layout `{landscape, 1280, 720}`.
  - `menu pages relayout at once`: on Menu, rotate → poll `layout.kind` landscape, scene Menu. Rotate back → `{portrait, 720, 1558}`.
  - `result keeps its layout until left`: 20× `answerCorrect` → Result. Rotate, wait 700 ms → `layout.kind` portrait and scene Result. `press('选关')` → LevelSelect landscape.
  - `rotate during the level-end hold` (Review Focus 1):
    - `startLevel(1)`, 19× `answerCorrect`.
    - Answer the last question with `tapCorrectBall` (no debug flush), then poll `levelEnding` true.
    - Rotate. Expect status `won` and `rotateHint` falsy, then scene Result within 4 s with layout landscape.
  - `flip-flop inside the settle window does nothing` (Review Focus 2): on Menu, rotate, wait 100 ms, rotate back, wait 700 ms → layout still `{portrait, 720, 1558}`.
  - `cards page survives relayout` (Review Focus 3): Cards → `press('6～9')` → rotate → landscape Cards with `cardsShown` 45 → rotate back → `cardsPage` 1.
  - `clay textures only grow at a switch`: after one switch to landscape and back, loop Menu → LevelSelect → Settings → Cards twice. The count after the second loop equals the count after the first.
- [ ] **Step 2: Run** `npx playwright test --project=mobile e2e/mobile/rotate.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `apply.ts`, the call-site changes, the debug `startLevel` change and the GameScene listener.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run && npx playwright test --project=mobile && npx playwright test --project=desktop`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(layout): switch layouts on rotation between scenes; pause with a hint in game`

---

### Task 8: Phone browser details (gestures, audio, fullscreen, icons)

**Files:**
- Modify: `index.html` (meta, CSS, manifest and icon links)
- Create: `public/manifest.webmanifest`, `scripts/icons/generate.mjs`, `public/icons/icon-180.png`, `icon-192.png`, `icon-512.png`
- Create: `src/audio/mobileAudio.ts`, `src/audio/mobileAudio.test.ts`
- Create: `src/ui/fullscreen.ts`, `src/ui/fullscreen.test.ts`
- Modify: `src/main.ts` (call `setupMobileAudio()` before `new Phaser.Game`), `src/scenes/MenuScene.ts` (开始游戏 calls `requestFullscreenOnTouch()` before `startScene`), `src/game/TuningPanel.ts` (span `音频: <path>`), `src/game/debug.ts` (`DebugState.audioPath`)
- Create: `e2e/mobile/browser.spec.ts`

**Interfaces:**
- Produces:
  - `type AudioPath = 'audioSession' | 'silentLoop' | 'none'`
  - `isIOS(ua: string, platform: string, maxTouchPoints: number): boolean`. True for iPhone, iPad or iPod in the UA, or for `MacIntel` with touch points > 1.
  - `chooseAudioPath(env: { hasAudioSession: boolean; ios: boolean }): AudioPath`. Returns audioSession if available, otherwise silentLoop on iOS, otherwise none.
  - `silentWavDataUri(ms: number, sampleRate = 8000): string`. A mono 8-bit PCM WAV whose samples are all `0x80`.
  - `installSilentLoop(doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'createElement'>): void`:
    - It listens for `touchend` and `pointerup` (capture).
    - On a gesture it creates one `<audio>` (only once): `loop`, `playsinline`, src = `silentWavDataUri(500)`.
    - It then calls `play()`. On resolve it removes the listeners; on reject it keeps them and reuses the same element.
    - It never throws.
  - `setupMobileAudio(): AudioPath`: sets `navigator.audioSession.type = 'playback'`, or calls `installSilentLoop(document)`, or does nothing. Stores the path.
  - `currentAudioPath(): AudioPath`
  - `shouldRequestFullscreen(env: { maxTouchPoints: number; fullscreenEnabled: boolean; fullscreenElement: unknown }): boolean`. True only for touch devices that support fullscreen and are not already fullscreen.
  - `requestFullscreenOnTouch(): void`. Calls `document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })` inside try, and `.catch(() => {})` on the promise.

`index.html`:
- viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`
- `apple-mobile-web-app-capable` yes, `mobile-web-app-capable` yes, `apple-mobile-web-app-status-bar-style` default, `apple-mobile-web-app-title` 九九乘法, `theme-color` #efe5d8
- `apple-touch-icon` 180, manifest link
- `html, body`: background #efe5d8, `touch-action: none`, `overscroll-behavior: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`
- `canvas { touch-action: none }`

Manifest: name 九九乘法闯关, short_name 九九乘法, `start_url "/"`, `display "fullscreen"`, no `orientation`, background and theme #efe5d8, icons 192 and 512 (png).

Icon generator: a Playwright Chromium page draws on a canvas and saves via `toDataURL`. The drawing is a cream square (#efe5d8), a coral clay ball (`0xff8a6b`) about 80% of the size with a radial highlight from the upper left and a soft drop shadow, and a bold white 「9×9」 with a dark stroke. It writes all three sizes.

- [ ] **Step 1: Write the unit tests**
  - `isIOS` covers iPhone UA, iPad UA, iPadOS desktop UA with 5 touch points, Android UA and Mac desktop with 0 touch points.
  - `chooseAudioPath` covers all four input combinations.
  - `silentWavDataUri(500)` decodes to `RIFF`/`WAVE`, `fmt ` with PCM, 1 channel and 8 bits, and a `data` length of 4000 with every byte 0x80.
  - `installSilentLoop creates one element and retries after a rejection` (Review Focus 5). Use a fake doc whose first `play()` rejects and second resolves:
    - Two gestures → `createElement` called once and `play` twice.
    - After the resolve, `removeEventListener` is called for both events.
    - A third gesture calls nothing.
  - `shouldRequestFullscreen` truth table.
- [ ] **Step 2: Run** `npx vitest run src/audio/mobileAudio.test.ts src/ui/fullscreen.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the modules, the wiring, `index.html`, the manifest and the generator. Run `node scripts/icons/generate.mjs` and open the PNGs to check them.
- [ ] **Step 4: Write `e2e/mobile/browser.spec.ts`**
  - `page blocks browser gestures`: computed `touch-action` is `none` on body and canvas, `overscroll-behavior` is `none` on body, and the viewport meta contains `user-scalable=no` and not `viewport-fit`.
  - `manifest and icons are served`: `/manifest.webmanifest` returns 200 with `display === 'fullscreen'`, and the three icon URLs return 200 `image/png`.
  - `开始游戏 still opens level select when fullscreen is refused` (Review Focus 4): `press('开始游戏')` (not a user gesture, so Chromium rejects) → LevelSelect, with no `pageerror`.
  - `audio path is reported`: `state().audioPath === 'none'` (Chromium is not iOS).
- [ ] **Step 5: Run** `npx vitest run && npx playwright test --project=mobile && npx playwright test --project=desktop`. Expected: all pass.
- [ ] **Step 6: Commit** `feat(mobile): touch-safe page, iOS playback audio, Android fullscreen, icons and manifest`

---

### Task 9: Portrait time limits (measured)

**Files:**
- Modify: `scripts/measure-question-time.mjs`:
  - New env `LAYOUT=portrait` → `browser.newContext({ viewport: { width: 400, height: 880 } })`, which gives H = 1560.
  - Before measuring, assert `state().layout` deep-equals `{portrait, 720, 1560}`.
  - Print `timeLimitSec.<layout> =`.
- Modify: `src/core/levels.ts` (`timeLimitSec: Record<LayoutKind, number>`), `src/core/levels.test.ts`
- Modify: `src/core/session.ts` (`SessionOpts.layout: LayoutKind`; `timeLeftMs = level.timeLimitSec[opts.layout] × 1000`), `src/core/session.test.ts` (helper passes `layout: 'landscape'`)
- Modify: `src/scenes/GameScene.ts` (passes `layout: this.layout.kind`)

**Interfaces:**
- Produces: `LevelSpec.timeLimitSec: Record<LayoutKind, number>` and `SessionOpts.layout: LayoutKind`.

- [ ] **Step 1: Add portrait mode to the script**, then measure. Start `npm run dev -- --port 5199` in the background and check `uptime` (load average < 2, otherwise wait). Then run `caffeinate -dims env LAYOUT=portrait node scripts/measure-question-time.mjs`. Expected: six rows with gameClock/wall ≈ 1 (0.95–1.05) and 0 stalls. Re-run any level outside that range. Record the printed `timeLimitSec.portrait = [...]` and the table in the commit message.
- [ ] **Step 2: Write the failing tests**
  - `levels.test.ts`: `LEVELS.map(l => l.timeLimitSec.landscape)` toEqual `[140,150,110,110,120,110]`, and `.portrait` toEqual the measured array.
  - `session.test.ts`: `a portrait session starts with the portrait time limit` (`timeLeftMs === getLevel(1).timeLimitSec.portrait × 1000`).
- [ ] **Step 3: Run** `npx vitest run src/core`. Expected: FAIL.
- [ ] **Step 4: Implement** the type change, the session option and the GameScene argument.
- [ ] **Step 5: Run** `npm run typecheck && npx vitest run && npm run test:e2e`. Expected: all pass.
- [ ] **Step 6: Commit** `feat(core): per-layout time limits; portrait limits measured at H 1560`

---

### Task 10: LAN serving, docs, final verification

**Files:**
- Modify: `package.json` (`"serve:lan": "npm run build && vite preview --host --port 4173 --strictPort"`)
- Modify: `CLAUDE.md`, per spec §14:
  - Commands: `serve:lan` plus the usage notes from spec §12 (same Wi-Fi, open the printed Network URL, fix the computer's LAN IP in the router, iPhone: 添加到主屏幕 and always open from there; progress is tied to address + port and Safari tabs may clear after ~7 days).
  - HiDPI: "current layout" instead of 1280×720.
  - New "Layouts" paragraph on `src/layout/`, `getLayout`, `startScene` and the switch rules.
  - Clay rule: "except at a layout switch".
  - Measurement: `LAYOUT=portrait`.
  - e2e: `--project=mobile`.
- Modify: `docs/superpowers/specs/2026-10-22-multiplication-game-design.md`: §2 drops 「手机或平板的触屏适配」 from the non-goals and links the portrait spec; §3 adds the phone environment; §10 adds touch and the pause button.
- Modify: `docs/superpowers/specs/2026-11-07-mobile-portrait-design.md` (status 已实现, and a note on the decisions listed at the top of this plan)

- [ ] **Step 1: Verify LAN serving.** Run `npm run serve:lan` in the background, then check that `curl -sI http://localhost:4173/` returns 200, `curl -s http://localhost:4173/manifest.webmanifest` contains `"fullscreen"`, and the output lists a `Network:` URL. Stop it.
- [ ] **Step 2: Update the docs.**
- [ ] **Step 3: Full verification.** Run `npm run build && npx vitest run && npm run test:e2e`. Expected: build ok and every unit and e2e test passes in both projects.
- [ ] **Step 4: Commit** `docs: portrait support in CLAUDE.md and specs; serve:lan`

---

## Handoff: device checks (human, after Task 10)

These come from spec §13 and need a real iPhone and a real Android phone on the same Wi-Fi, via `npm run serve:lan`:

1. Play one level upright. Text should be readable and balls tappable, with no zoom, scroll or long-press menu.
2. iPhone with the mute switch on: voice and sfx should still be audible. Note the iOS version and the path shown by `?debug`'s tuning panel (`音频: audioSession` or `silentLoop`).
3. iPhone opened from the home screen should be fullscreen with the notch not covering the HUD. Android should go fullscreen on 开始游戏.
4. Rotate mid-level: the game should pause with the hint, and resume only via 继续游戏.
5. Frame rate should stay ≥ 30 and gameClock/wall ≈ 1 (run with `?debug` and watch `state().gameMs` against wall time). If not, lower the portrait `renderScaleFor` cap to 2 and re-check.
