import { test, expect } from '@playwright/test';
import { press, sceneIs, startLevel, state, tap, toPage } from './support';

test('pause button pauses and 继续游戏 resumes', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  await press(page, '暂停');
  await expect.poll(async () => (await state(page)).status).toBe('paused');
  const before = (await state(page)).timeLeftMs;
  await page.waitForTimeout(1000);
  expect((await state(page)).timeLeftMs).toBe(before);
  await press(page, '继续游戏');
  await expect.poll(async () => (await state(page)).status).toBe('playing');
  expect(errors).toEqual([]);
});

test('返回选关 leaves to level select', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  await press(page, '暂停');
  await press(page, '返回选关');
  await sceneIs(page, 'LevelSelect');
  expect(errors).toEqual([]);
});

test('tapping outside the panel resumes', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  await press(page, '暂停');
  await expect.poll(async () => (await state(page)).status).toBe('paused');
  const { score, layout } = await state(page);
  const p = await toPage(page, 20, layout.height - 20);
  await tap(page, p.x, p.y);
  await expect.poll(async () => (await state(page)).status).toBe('playing');
  expect((await state(page)).score).toBe(score);
  expect(errors).toEqual([]);
});

test('a real tap on the pause button pauses without answering', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  await expect.poll(async () => ((await state(page)).balls as unknown[]).length).toBeGreaterThanOrEqual(1);
  const { score, layout } = await state(page);
  // The pause button is the Game scene's interactive container whose hit area is the layout's pause box.
  const [w, h] = layout.kind === 'portrait' ? [64, 44] : [64, 48];
  const pos = await page.evaluate(
    ([bw, bh]) => {
      const g = (window as any).__funyGame;
      const scene = g.scene.getScene('Game');
      const c = scene.children.list.find((o: any) => o.type === 'Container' && o.input && o.input.hitArea.width === bw && o.input.hitArea.height === bh);
      return c ? { x: c.x, y: c.y } : null;
    },
    [w, h],
  );
  expect(pos).not.toBeNull();
  const p = await toPage(page, pos!.x, pos!.y);
  await tap(page, p.x, p.y);
  await expect.poll(async () => (await state(page)).status).toBe('paused');
  expect((await state(page)).score).toBe(score);
  expect(errors).toEqual([]);
});
