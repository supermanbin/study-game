import { test, expect, type Page } from '@playwright/test';

type S = { scene: string; status?: string; bossHp?: number; bossMode?: string; pileCount?: number };
type Dbg = {
  answerCorrect(): void;
  missCurrent(): void;
  startLevel(id: number): void;
  unlockAll(): void;
  state(): S;
};
const state = (page: Page) => page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.state());

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window as unknown as { __funyDebug?: Dbg }).__funyDebug);
}

test('boss level: 16 correct defeats the boss (chest mode), level continues to 20', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => {
    (window as unknown as { __funyDebug: Dbg }).__funyDebug.unlockAll();
    (window as unknown as { __funyDebug: Dbg }).__funyDebug.startLevel(3);
  });
  await page.waitForFunction(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.state().scene === 'Game');
  let s = await state(page);
  expect(s.bossHp).toBe(16);
  expect(s.bossMode).toBe('monster');

  for (let i = 0; i < 16; i++) await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.answerCorrect());
  s = await state(page);
  expect(s.bossHp).toBe(0);
  expect(s.status).toBe('playing');
  await expect.poll(async () => (await state(page)).bossMode).toBe('chest');

  for (let i = 0; i < 4; i++) await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.answerCorrect());
  await page.waitForFunction(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.state().scene === 'Result');
  expect(errors).toEqual([]);
});

test('only pile bodies are counted for overflow (missed question options)', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.startLevel(1));
  await page.waitForFunction(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.state().scene === 'Game');
  expect((await state(page)).pileCount).toBe(0);
  await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.missCurrent());
  await expect.poll(async () => (await state(page)).pileCount, { timeout: 12000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
