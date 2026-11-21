import { test, expect } from '@playwright/test';
import { dbg, startLevel, state, tapCorrectBall, waitMenu } from '../support';

type G = { textures: { list: Record<string, unknown> } };

test('reports the portrait layout', async ({ page }) => {
  await waitMenu(page);
  expect((await state(page)).layout).toEqual({ kind: 'portrait', width: 720, height: 1558 });
});

test('canvas renders at the screen pixel density', async ({ page }) => {
  await waitMenu(page);
  const m = await page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const r = c.getBoundingClientRect();
    return { backingW: c.width, physicalW: r.width * devicePixelRatio };
  });
  expect(m.backingW).toBeGreaterThanOrEqual(m.physicalW * 0.9);
});

test('a real touch on the correct ball scores', async ({ page }) => {
  const errors: string[] = [];
  await startLevel(page, 1, errors);
  expect(await tapCorrectBall(page)).toBe(true);
  expect(((await state(page)).score as number)).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
});

test('the longest prompts fit the band on one line', async ({ page }) => {
  await waitMenu(page);
  await dbg(page, d => d.unlockAll());
  await page.evaluate(() => (window as any).__funyDebug.startLevel(4));
  await page.waitForFunction(() => {
    const s = (window as any).__funyDebug.state();
    return s.scene === 'Game' && s.questionIndex === 0 && s.status === 'playing';
  });
  let max = 0;
  for (let i = 0; i < 20; i++) {
    const p = (await state(page)).prompt as { text: string; width: number } | undefined;
    if (p) max = Math.max(max, p.width);
    await dbg(page, d => d.answerCorrect());
  }
  expect(max).toBeGreaterThan(0);
  expect(max).toBeLessThanOrEqual(696 - 24);
});

const namedTextureCount = (p: import('@playwright/test').Page) =>
  p.evaluate(
    () =>
      Object.keys((window as unknown as { __funyGame: G }).__funyGame.textures.list).filter(
        k => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k),
      ).length,
  );

test('gameplay allocates no named textures', async ({ page }) => {
  await startLevel(page, 1);
  await expect.poll(async () => ((await state(page)).balls as unknown[]).length, { timeout: 5000 }).toBeGreaterThanOrEqual(3);
  const first = await namedTextureCount(page);
  for (let i = 0; i < 5; i++) await dbg(page, d => d.answerCorrect());
  for (let i = 0; i < 2; i++) await dbg(page, d => d.missCurrent());
  await page.waitForTimeout(1200);
  expect(await namedTextureCount(page)).toBe(first);
});
