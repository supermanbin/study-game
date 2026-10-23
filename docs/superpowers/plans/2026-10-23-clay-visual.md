# 软萌黏土视觉风格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every graphical element in all 7 scenes as soft matte clay, using textures generated at boot with Canvas 2D. Gameplay, rules, physics and timing do not change.

**Architecture:** A single clay painter, `src/ui/clay.ts`, draws shapes with Canvas 2D at `RENDER_SCALE` (radial/linear gradients, outer drop shadow, inner light and dark) and registers them as Phaser canvas textures under stable cache keys.
- Pure helpers (colour shading, shadow parameters, contrast, cache keys) are unit-tested.
- `clayImage()` places a texture at design size: origin at the shape centre, scale `1/RENDER_SCALE`.
- `BootScene` pre-bakes every fixed-size texture.
- Variable-size panels and buttons are baked on first use inside a scene's `create()`, never during gameplay frames.
- Scenes and game objects swap their `Graphics`, `Arc` and `Rectangle` visuals for clay images. Balls become two layers: a non-rotating shell and a rotating stripe.

**Tech Stack:** TypeScript, Phaser 3.90 (canvas textures), Canvas 2D, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-clay-visual-design.md`. Approved mockups are in `.superpowers/brainstorm/5451-1792720923/content/3d-style.html` (option B) and `clay-game.html`; they are untracked. Where a mockup and spec §4 disagree, the mockup wins for shape and feel, and §4 ranges win for numbers.

## Global Constraints

- **Clay material:**
  - Matte base colour.
  - Outer drop shadow toward the lower right, offset 8–12% of size, soft blur, colour = darkened base at partial alpha.
  - Inner dark on the lower right, ~10–12% of size. Inner light on the upper left, ~8–10% of size, whitish.
- **Inset variant** (warning dots, empty HP segments, locked/unlit, toggle track): inner dark upper-left, light lower-right, no drop shadow.
- **Faded clay** (grey balls, disabled buttons, unlit cards): base `#d9d0c5`, text `#9b8f82`, lighter shadow.
- **Palette:**
  - Page background: cream radial `#fbf6ef` → `#efe5d8`.
  - Panels and plaques: `#f6efe6` / `#efe7de`.
  - Text: dark `#5a4636`, secondary `#6b5a4b`, accent `#e0703c`.
  - Ball colours, in this order: coral `#ff8a6b`, sky `#6fb7f2`, mint `#6fcf97`, lemon `#f7c94b`, grape `#b48ce6`, peach `#f79ab0`, teal `#5cc8c0`.
  - Elements: peg `#f2b765`, floor `#c99a74`, warning dot `#e9b3a6` (inset), boss `#a98be0`, HP on `#f08a7a`, HP off `#e3d9ce`, primary button `#79c96b`.
- **Balls:**
  - The visible body radius equals the collision radius (42 / 52). The drop shadow lies outside that radius, and the origin is set so the body centre equals the physics centre.
  - Hit testing stays on the physics circle.
  - Two layers: a non-rotating shell (shadow, base, inner light/dark, light always from the upper left) and a rotating overlay holding only a short white matte stripe. The label stays upright.
- **Text** is never clay-rendered. Labels on balls use the existing white with a soft drop shadow, plus whatever the contrast rule (Review Focus 1) needs.
- **Textures:**
  - Generated at `RENDER_SCALE` and displayed at `1/RENDER_SCALE`.
  - Fixed-size ones are pre-baked in Boot; nothing is generated during gameplay frames.
  - No 9-slice: each size used gets its own texture, cached by key.
  - No external image or font assets.
- **Components:**
  - Clay button: pressed state shrinks the shadow and sinks the button about 3 px. Disabled buttons use faded clay. Labels stay as they are, because e2e uses `press(label)`.
  - Lock: a drawn clay lock replaces 🔒.
  - Boss hit: squash-and-rebound replaces `flashWhite`; the screen shake stays.
  - Warning line: a row of inset dots.
  - Pause overlay and miss reveal: clay panel and plaque.
  - `+N` and combo text: "clay text", meaning accent fill, thick light stroke and a small drop shadow.
- **Must not regress:** every unit test, every e2e test (including `hidpi.spec.ts`) and `--repeat-each=5`. `applyHiDpi(this)` stays first in every `create()`. The `press(label)` labels do not change.
- **Performance:** game FPS with 20+ balls at DPR 2 is ≥ 90% of the baseline measured in Task 1. Total clay bake time at `RENDER_SCALE` 2.5 is ≤ ~500 ms. Both numbers go in the reports.
- **Commits:** conventional messages with the harness attribution trailer.

## Review Focus

1. **Label contrast on light ball colours** (lemon, mint, teal, peach) and on faded balls. White text on `#f7c94b` is hard to read for a 7-year-old. Each ball colour gets a label colour/stroke whose contrast is ≥ 3:1 for large text. → unit test in Task 1, used in Task 3.
2. **Re-entering scenes or restarting levels re-adds textures under an existing key.** Phaser then logs "Texture key already in use" or leaks textures. Painters must reuse cached keys. → e2e in Task 2 (navigate Menu → LevelSelect → Game → Result → Menu twice; the texture count stays stable and there are no console errors).
3. **Hit areas grow with the shadow padding.** A button or ball whose clickable area includes the drop shadow makes edge clicks land wrong. → assertions in Tasks 2 and 4.
4. **FPS regression from many large `Image`s at `RENDER_SCALE` 2.5–3.** → measured before (Task 1) and after (Task 4).
5. **HUD text that updates every frame** (score, time) must not trigger texture regeneration. Plaques are baked once at a fixed width; only the Text changes. → the texture-count e2e in Task 3 runs during play.

---

## File Structure

```
src/ui/palette.ts            # colour constants (Global Constraints palette)
src/ui/clay.ts (+ clay.test.ts)   # pure helpers + Canvas2D painters + clayImage + bake list
src/ui/Button.ts             # clay button
src/ui/claywidgets.ts        # background, panel, plaque, clayText style, star, lock, toggle
src/ui/theme.ts              # BG/INK → palette; title() uses dark text
src/scenes/*.ts              # per-scene restyle
src/game/OptionBody.ts       # two-layer ball
src/game/Pegs.ts, Hud.ts, Boss.ts, effects.ts
scripts/measure-fps.mjs      # Playwright FPS probe
e2e/clay.spec.ts             # texture stability, hit areas
```

---

### Task 1: Clay painter core, palette, FPS baseline

**Files:**
- Create: `src/ui/palette.ts`, `src/ui/clay.ts`, `src/ui/clay.test.ts`, `scripts/measure-fps.mjs`

**Interfaces:**
- Produces:

```ts
// palette.ts
export const CLAY = { bgInner, bgOuter, panel, plaque, ink, ink2, accent, faded, fadedText, peg, floor, warnDot,
  boss, hpOn, hpOff, primary } as const;      // numbers (0xRRGGBB)
export const BALL_COLORS: readonly number[];  // 7, in spec order
// clay.ts — pure (no DOM), unit-tested
export function shade(color: number, amount: number): number;      // amount -1..1: toward black / white, per channel
export function clayParams(size: number): { dropX: number; dropY: number; dropBlur: number; dark: number; light: number };
//   dropX = dropY ∈ [0.08,0.12]×size, dark ∈ [0.10,0.12]×size, light ∈ [0.08,0.10]×size, dropBlur ≈ 0.18×size
export function contrastRatio(a: number, b: number): number;      // WCAG relative-luminance ratio
export function labelStyleFor(ball: number): { color: string; stroke: string; strokeThickness: number };
//   returns white text with a darkened-ball stroke, or dark ink, whichever reaches ≥ 3:1 against `ball`
export function clayKey(kind: string, ...parts: (string | number)[]): string;  // 'clay:kind:part:part'
// clay.ts — painters (DOM canvas; e2e-tested)
export interface ClayTex { key: string; originX: number; originY: number }
export function bakeBall(scene: Phaser.Scene, color: number, radius: number, faded?: boolean): ClayTex;
export function bakeStripe(scene: Phaser.Scene, radius: number): ClayTex;
export function bakeRoundRect(scene: Phaser.Scene, w: number, h: number, r: number, color: number, inset?: boolean): ClayTex;
export function bakeShape(scene: Phaser.Scene, kind: 'star' | 'starOff' | 'lock' | 'monster' | 'monsterHurt' | 'chest' | 'peg' | 'dot' | 'hpOn' | 'hpOff' | 'particleBall' | 'particleStar', color?: number): ClayTex;
export function clayImage(scene: Phaser.Scene, x: number, y: number, tex: ClayTex): Phaser.GameObjects.Image; // scale 1/RENDER_SCALE
export function bakeAll(scene: Phaser.Scene): number;  // pre-bakes every fixed texture, returns elapsed ms
```

Painters return early when `scene.textures.exists(key)`. They draw on a `document.createElement('canvas')` sized `(shape + padding) × RENDER_SCALE`, then call `scene.textures.addCanvas(key, canvas)`. The padding covers the drop shadow on the lower right plus a small margin. Origins are computed so the shape centre is the anchor.

- [ ] **Step 1: Baseline FPS.** Write `scripts/measure-fps.mjs`:
  - Playwright Chromium, viewport 1512×860, `deviceScaleFactor: 2`, against `BASE` (default `http://localhost:5199`), `?debug&notime`.
  - It starts level 1, misses 8 questions with `missCurrent` (pile plus current balls ≥ 20), then samples `requestAnimationFrame` over 5 s and prints mean FPS. Run it 3 times and print the median.
  - Run it now on the current code. Write the result into the task report as the baseline.
- [ ] **Step 2: Write failing unit tests** (`clay.test.ts`):
  - `shade(0x808080, 0) === 0x808080`; `shade(0xff8a6b, -1) === 0x000000`; `shade(0xff8a6b, 1) === 0xffffff`.
  - `clayParams(100)` returns `dropX` in [8, 12], `dark` in [10, 12] and `light` in [8, 10].
  - `contrastRatio(0xffffff, 0x000000)` ≈ 21; `contrastRatio(0xffffff, 0xffffff)` = 1.
  - **Review Focus 1:** for every `BALL_COLORS` entry and for `CLAY.faded`, compute the effective contrast of `labelStyleFor(c)`, taking the stroke as the background when `strokeThickness ≥ 4`. It must be ≥ 3.
  - `clayKey('ball', 0xff8a6b, 42, 2.5) === 'clay:ball:ff8a6b:42:2.5'`.
- [ ] **Step 3:** `npx vitest run src/ui/clay.test.ts` → FAIL.
- [ ] **Step 4:** Implement `palette.ts` and `clay.ts`.
  - Painters follow the Global Constraints material.
  - Drop shadow: draw the shape filled with `shade(color, -0.35)` at alpha 0.35, offset by `dropX`/`dropY` and blurred via `ctx.filter = 'blur(...)'`. Fall back to `shadowBlur` if `filter` is unsupported.
  - Base: draw the shape.
  - Inner dark and light: clip to the shape, then stroke or fill large offset blurred copies.
  - Stripe: a short white rounded bar at alpha 0.85, near the top edge.
  - Monster, chest, lock and star: draw them with paths in the clay material, using the mockup shapes (rounded monster with two round eyes, small ears and a cheeky mouth; hurt variant has X eyes).
- [ ] **Step 5:** `npx vitest run && npm run typecheck` → PASS.
- [ ] **Step 6:** Commit `feat(ui): clay painter, palette, fps probe`.

---

### Task 2: Shared widgets and menu-side scenes

**Files:**
- Create: `src/ui/claywidgets.ts`, `e2e/clay.spec.ts`
- Modify: `src/ui/Button.ts`, `src/ui/theme.ts`, `src/scenes/BootScene.ts`, `MenuScene.ts`, `SettingsScene.ts`, `ResultScene.ts`, `LevelSelectScene.ts`, `CardsScene.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (`claywidgets.ts`):

```ts
export function clayBackground(scene: Phaser.Scene): Phaser.GameObjects.Image;   // full-screen cream radial, depth -100
export function clayPanel(scene, x, y, w, h, color?: number): Phaser.GameObjects.Image;  // rounded r = min(28, h/3)
export function clayPlaque(scene, x, y, w, h, color?: number): Phaser.GameObjects.Image;  // rounded r = h/2.6
export const CLAY_TEXT: Phaser.Types.GameObjects.Text.TextStyle; // accent fill, stroke '#fff7ec' 8px, shadow 0,3 rgba(120,80,50,.35)
export function clayStars(scene, x, y, lit: 0|1|2|3, size: number): Phaser.GameObjects.Container;
export function clayLock(scene, x, y, size: number): Phaser.GameObjects.Image;
export function clayToggle(scene, x, y, on: boolean): Phaser.GameObjects.Container;   // inset track + raised knob (mint on / faded off)
```

- `createButton` keeps its signature and its `opts`:
  - Its visual becomes `bakeRoundRect` with `opts.color` (default `CLAY.primary`) or faded when disabled.
  - The hit area is the button rect `w × h` only, not the shadow padding (`c.setSize(w, h)` is kept and the interactive area set explicitly).
  - On `pointerdown` it sinks 3 px and swaps to a smaller-shadow texture. On `pointerup`/`pointerout` it restores.
  - The existing hover scale is removed, because it fought the press feel.
  - Label text colour is white on coloured buttons, with `labelStyleFor`-style contrast if needed, and `CLAY.fadedText` when disabled.
- `theme.ts`: `BG` becomes `CLAY.bgOuter` as a hex string and `INK` becomes `CLAY.ink`.
- `BootScene`: calls `bakeAll(this)` after preload, and logs the elapsed ms in DEV only (`console.info`, not error).
- Scenes:
  - Every menu-side scene adds `clayBackground` right after `applyHiDpi`.
  - **Menu:** the title uses `INK`. Add 5 static decorative clay balls (one per palette colour) along the title, with a slight gentle bob tween.
  - **LevelSelect:** tiles stay `createButton` (so `press('第N关')` works) with tile colours from the palette (boss levels grape, others primary/sky alternating). Stars become `clayStars` and 🔒 becomes `clayLock`.
  - **Result:** a big `clayPanel` behind the texts, `clayStars` at 96 px size, clay buttons.
  - **Cards:** each card is `bakeRoundRect` 112×54. Lit cards cycle `BALL_COLORS` by `(a + b) % 7` with `labelStyleFor` text; unlit cards are inset faded with `CLAY.fadedText` text.
  - **Settings:** each row is a clay button (label unchanged) plus `clayToggle` replacing the 开/关 text. Keep a small 开/关 text under the toggle for clarity.

- [ ] **Step 1: Write the failing e2e** `e2e/clay.spec.ts` (`?debug`, use `window.__funyGame`):
  - **Review Focus 2:** go Menu → LevelSelect → Menu → Settings → Menu → Cards → Menu twice via `press`. `game.textures.list` key count after the first loop equals the count after the second. No console errors (including Phaser's "Texture key already in use" warning: collect `console` messages of type `warning` and `error`).
  - **Review Focus 3:** on Menu, the 「开始游戏」 container's `input.hitArea` has width 360 and height 88, matching the button size, not the texture size.
  - `bakeAll` exists: on Menu, `game.textures.exists('clay:ball:ff8a6b:42:<RENDER_SCALE>')` is true. Read `RENDER_SCALE` back from the canvas width / 1280.
- [ ] **Step 2:** `npx playwright test e2e/clay.spec.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run && npm run typecheck && npm run test:e2e` → PASS.
- [ ] **Step 5: Visual check.**
  - Use a throwaway Playwright script at DPR 2 to screenshot Menu, LevelSelect (with some stars and locks; use `unlockAll` plus a written progress), Result (pass and fail), Cards (write a progress with some lit cards) and Settings into `.superpowers/sdd/2026-10-23-clay-visual/t2-*.png`.
  - View them and compare with the mockups.
  - Fix any obvious mismatch: hard edges, wrong light direction, unreadable text.
- [ ] **Step 6:** Commit `feat(ui): clay widgets and menu-side scenes`.

---

### Task 3: Game world — balls, pegs, floor, warning dots, HUD, pause, miss plaque

**Files:**
- Modify: `src/game/OptionBody.ts`, `src/game/Pegs.ts`, `src/game/Hud.ts`, `src/scenes/GameScene.ts`
- Test: `e2e/clay.spec.ts` (extend)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `OptionBody` structure:
    - `shell: Phaser.GameObjects.Image` is the non-rotating clay ball (`bakeBall(color, radius)`; `bakeBall(faded)` after `setGrey()`). It sits at depth 10 and follows the body position in `syncLabel()` (rename to `syncVisuals()`, updating all callers).
    - The Matter container keeps only the stripe image (`bakeStripe(radius)`) and rotates with the body at depth 10.5.
    - The label (depth 11) uses `labelStyleFor(color)`, or faded text when grey.
    - The pop-in, squash and shake tweens target the shell, stripe and label together; the body is never scaled.
    - Ball colour comes from `BALL_COLORS[colorIndex % 7]`. The stripe goes to alpha 0.5 when grey.
  - `Pegs`: each peg is `clayImage(bakeShape('peg'))` with the static Matter circle (radius unchanged). `flash()` tweens scale 1.6 and adds a brief brighten via `setTintFill(0xffffff)` for ~60 ms, then `clearTint`.
  - `Hud`:
    - The question band is `clayPanel(GAME_WIDTH/2, 70, GAME_WIDTH - 28, 120)` at depth 50.
    - Score, combo and time sit on `clayPlaque`s of fixed width (score 190×44, combo 150×36, time 170×52) with the Text on top. The texts change; the plaques never re-bake.
    - Item buttons become clay plaques in light sky `#e6f1fb` (150×38), staying interactive and keeping `swallowsClick`.
    - Warning line: a row of inset `dot` images every 36 px at `WARNING_LINE_Y`.
    - Floor: `bakeRoundRect(GAME_WIDTH, GAME_HEIGHT - GROUND_Y + 20, 20, CLAY.floor)` at `GROUND_Y`.
    - Pause overlay: cream shade `0xfbf6ef` at alpha 0.75, plus a `clayPanel` 760×160 with the same label text in `INK`. The shade stays the interactive resume target.
    - Miss reveal: the existing text drawn on a `clayPlaque` (shown only while revealing).
  - `GameScene`: camera background removed in favour of `clayBackground` (light cream, so the balls pop).

- [ ] **Step 1: Extend the failing e2e:**
  - **Review Focus 5:** start level 1. Record the texture count after question 1 has spawned, answer 5 questions with `answerCorrect`, miss 2 with `missCurrent`, then the count is unchanged.
  - **Review Focus 3:** compare a current ball's shell image `displayWidth` with `2 × radius + shadow padding`; the body radius stays 42 or 52. Expose `debugBalls(): {radius: number; shellW: number}[]` on GameScene's debug state if needed.
  - Shell `angle` stays 0 while the stripe container's angle changes after 1 s of play.
- [ ] **Step 2:** `npx playwright test e2e/clay.spec.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run && npm run typecheck && npm run test:e2e && npx playwright test --repeat-each=5` → PASS.
- [ ] **Step 5: Visual check.** Take DPR 2 screenshots: mid-question with pegs, balls, plaques and the floor; a pile of faded balls; the pause overlay; the miss reveal. Save them to `.superpowers/sdd/2026-10-23-clay-visual/t3-*.png` and compare with `clay-game.html`.
- [ ] **Step 6:** Commit `feat(game): clay balls, pegs, HUD, floor`.

---

### Task 4: Boss and effects in clay, performance, docs

**Files:**
- Modify: `src/game/Boss.ts`, `src/game/effects.ts`, `src/scenes/GameScene.ts`, `CLAUDE.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `Boss`:
    - The monster becomes `clayImage(bakeShape('monster'))` and is swapped to `monsterHurt` for 250 ms on hit. The chest becomes `bakeShape('chest')`.
    - HP is 16 `hpOn`/`hpOff` images (inset when off). Positions are unchanged.
    - `hit()` squashes and rebounds: scaleY 0.75 / scaleX 1.2, 90 ms yoyo, plus the existing x wiggle. `get target` stays.
  - `GameScene`: the boss-hit branch no longer calls `flashWhite`. Remove `flashWhite` from `effects.ts` if it has no other caller.
  - Effects:
    - `explode` uses `bakeShape('particleBall', color)` / `particleStar` textures for each `BALL_COLORS` entry, baked in `bakeAll`. Emitters pick a random texture frame, or use one emitter per colour, at most 3 colours per burst. The particles' displayed size is unchanged: scale = `1/RENDER_SCALE`.
    - `spark` uses small clay dots.
    - `floatScore` and `centerCombo` use `CLAY_TEXT` (sizes and timings unchanged).
    - The shockwave stays a white soft ring.
  - `CLAUDE.md`: a short "Clay visuals" paragraph covering:
    - the painter and its cache keys;
    - `bakeAll` in Boot;
    - no gameplay-frame baking;
    - `clayImage` scale and origin;
    - the two-layer balls;
    - `labelStyleFor`, with the contrast test as the guard.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npx vitest run && npm run typecheck && npm run build && npm run test:e2e && npx playwright test --repeat-each=5` → PASS.
- [ ] **Step 3: Performance (Review Focus 4).**
  - Run `scripts/measure-fps.mjs` (median of 3) and compare with the Task 1 baseline. It must be ≥ 90%.
  - Record the `bakeAll` elapsed ms at `RENDER_SCALE` 2.5 (viewport 1512×860, DPR 2). It must be ≤ ~500 ms.
  - If either target fails, first reduce the cost (fewer distinct textures, smaller blur radius), then re-measure. Report both numbers.
- [ ] **Step 4: Visual check.**
  - Take DPR 2 screenshots: boss monster with HP, boss hurt squash, chest mode, a correct-answer burst with clay particles, a combo popup and a `+N`.
  - Save them as `.superpowers/sdd/2026-10-23-clay-visual/t4-*.png` and compare.
- [ ] **Step 5:** Commit `feat(game): clay boss and effects; docs`.
