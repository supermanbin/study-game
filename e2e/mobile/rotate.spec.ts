import { test, expect, type Page } from '@playwright/test';
import { dbg, press, sceneIs, startLevel, state, tapCorrectBall, waitMenu } from '../support';

/** Turning the phone: the 390×844 viewport becomes 844×390 and back. */
const rotate = (page: Page) => page.setViewportSize({ width: 844, height: 390 });
const rotateBack = (page: Page) => page.setViewportSize({ width: 390, height: 844 });

const PORTRAIT = { kind: 'portrait', width: 720, height: 1558 };
const LANDSCAPE = { kind: 'landscape', width: 1280, height: 720 };

const clayCount = (page: Page) =>
  page.evaluate(() => (window as any).__funyGame.textures.getTextureKeys().filter((k: string) => k.startsWith('clay:')).length as number);

test('in game: rotating pauses with a hint and keeps the layout', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  await rotate(page);
  await expect
    .poll(async () => {
      const s = await state(page);
      return { status: s.status, rotateHint: s.rotateHint, kind: s.layout.kind };
    })
    .toEqual({ status: 'paused', rotateHint: true, kind: 'portrait' });
  await rotateBack(page);
  await expect.poll(async () => (await state(page)).rotateHint).toBe(false);
  expect((await state(page)).status).toBe('paused');
  await press(page, '继续游戏');
  await expect.poll(async () => (await state(page)).status).toBe('playing');
  await rotate(page);
  await expect.poll(async () => (await state(page)).rotateHint).toBe(true);
  await press(page, '返回选关');
  await sceneIs(page, 'LevelSelect');
  expect((await state(page)).layout).toEqual(LANDSCAPE);
  expect(errors).toEqual([]);
});

test('menu pages relayout at once', async ({ page }) => {
  const errors: string[] = [];
  await waitMenu(page, errors);
  await rotate(page);
  await expect.poll(async () => (await state(page)).layout.kind).toBe('landscape');
  expect((await state(page)).scene).toBe('Menu');
  await rotateBack(page);
  await expect.poll(async () => (await state(page)).layout).toEqual(PORTRAIT);
  await sceneIs(page, 'Menu');
  expect(errors).toEqual([]);
});

test('result keeps its layout until left', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  for (let i = 0; i < 20; i++) await dbg(page, d => d.answerCorrect());
  await sceneIs(page, 'Result');
  await rotate(page);
  await page.waitForTimeout(700);
  const s = await state(page);
  expect(s.layout.kind).toBe('portrait');
  expect(s.scene).toBe('Result');
  await press(page, '选关');
  await sceneIs(page, 'LevelSelect');
  expect((await state(page)).layout.kind).toBe('landscape');
  expect(errors).toEqual([]);
});

test('rotate during the level-end hold', async ({ page }) => {
  test.setTimeout(60_000); // tapCorrectBall waits for the ball to come to rest
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  for (let i = 0; i < 19; i++) await dbg(page, d => d.answerCorrect());
  // The last answer is a real touch, so the level-end hold is not flushed.
  expect(await tapCorrectBall(page)).toBe(true);
  await expect.poll(async () => (await state(page)).levelEnding, { intervals: [50] }).toBe(true);
  await rotate(page);
  // The settle may fire before or after Result starts (both legal): the game never pauses nor shows the hint.
  const samples: { scene: string; status?: string; rotateHint?: unknown }[] = [];
  const until = Date.now() + 4000;
  for (;;) {
    const s = await state(page);
    samples.push({ scene: s.scene, status: s.status, rotateHint: s.rotateHint });
    if (s.scene === 'Result' || Date.now() > until) break;
    await page.waitForTimeout(50);
  }
  expect(samples.at(-1)!.scene).toBe('Result');
  expect(samples.filter(s => s.status === 'paused' || s.rotateHint === true)).toEqual([]);
  await press(page, '选关');
  await sceneIs(page, 'LevelSelect');
  expect((await state(page)).layout).toEqual(LANDSCAPE);
  expect(errors).toEqual([]);
});

test('a stray resize while still rotated does not re-pause', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  await rotate(page);
  await expect
    .poll(async () => {
      const s = await state(page);
      return { status: s.status, rotateHint: s.rotateHint };
    })
    .toEqual({ status: 'paused', rotateHint: true });
  // The child goes on in the turned phone; a toolbar show/hide or window drag must not pause again.
  await press(page, '继续游戏');
  await expect.poll(async () => (await state(page)).status).toBe('playing');
  await page.setViewportSize({ width: 900, height: 400 });
  await page.waitForTimeout(700);
  const s = await state(page);
  expect(s.status).toBe('playing');
  expect(s.rotateHint).toBe(true);
  expect(errors).toEqual([]);
});

test('flip-flop inside the settle window does nothing', async ({ page }) => {
  await waitMenu(page);
  // A switch to landscape always bakes new textures, so an unchanged count proves none happened.
  const before = await clayCount(page);
  await rotate(page);
  await page.waitForTimeout(100);
  await rotateBack(page);
  await page.waitForTimeout(700);
  const s = await state(page);
  expect(s.layout).toEqual(PORTRAIT);
  expect(s.scene).toBe('Menu');
  expect(await clayCount(page)).toBe(before);
});

test('cards page survives relayout', async ({ page }) => {
  await waitMenu(page);
  await press(page, '口诀卡册');
  await sceneIs(page, 'Cards');
  await press(page, '6～9');
  await expect.poll(async () => (await state(page)).cardsPage).toBe(1);
  await rotate(page);
  await expect.poll(async () => (await state(page)).layout.kind).toBe('landscape');
  await sceneIs(page, 'Cards');
  await expect.poll(async () => (await state(page)).cardsShown).toBe(45);
  await rotateBack(page);
  await expect.poll(async () => (await state(page)).layout.kind).toBe('portrait');
  await expect.poll(async () => (await state(page)).cardsPage).toBe(1);
});

test('clay textures only grow at a switch', async ({ page }) => {
  await waitMenu(page);
  const boot = await clayCount(page);
  await rotate(page);
  await expect.poll(async () => (await state(page)).layout.kind).toBe('landscape');
  await rotateBack(page);
  await expect.poll(async () => (await state(page)).layout.kind).toBe('portrait');
  await sceneIs(page, 'Menu');
  const switched = await clayCount(page);
  expect(switched).toBeGreaterThan(boot);
  const loop = async () => {
    for (const [to, key] of [['开始游戏', 'LevelSelect'], ['设置', 'Settings'], ['口诀卡册', 'Cards']] as const) {
      await press(page, to);
      await sceneIs(page, key);
      await press(page, '返回');
      await sceneIs(page, 'Menu');
    }
    return clayCount(page);
  };
  const first = await loop();
  const second = await loop();
  expect(first).toBe(switched);
  expect(second).toBe(first);
});
