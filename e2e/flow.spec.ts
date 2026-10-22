import { test, expect, type Page } from '@playwright/test';

type S = { scene: string; stars?: number; litCards?: number; settings?: { music: boolean; voice: boolean; sfx: boolean } };
type Dbg = { answerCorrect(): void; missCurrent(): void; press(l: string): void; state(): S };
declare global {
  interface Window {
    __funyDebug: Dbg;
  }
}

const press = (p: Page, l: string) => p.evaluate(x => window.__funyDebug.press(x), l);
const state = (p: Page) => p.evaluate(() => window.__funyDebug.state());
const ready = async (p: Page) => {
  await p.goto('/?debug');
  await p.waitForFunction(() => window.__funyDebug?.state().scene === 'Menu');
};

test('menu to level select to result to persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?debug');
  await page.evaluate(() => localStorage.clear());
  await ready(page);

  await press(page, '开始游戏');
  await expect.poll(async () => (await state(page)).scene).toBe('LevelSelect');
  await press(page, '第2关');
  expect((await state(page)).scene).toBe('LevelSelect');

  await press(page, '第1关');
  await expect.poll(async () => (await state(page)).scene).toBe('Game');
  await page.waitForFunction(() => (window.__funyDebug.state() as { status?: string }).status === 'playing');
  for (let i = 0; i < 20; i++) await page.evaluate(() => window.__funyDebug.answerCorrect());
  await expect.poll(async () => (await state(page)).scene).toBe('Result');
  expect((await state(page)).stars).toBe(3);

  // Replay level 1 and fail it: the stale 下一关 handler must not survive on the failed Result.
  await press(page, '再玩一次');
  await expect.poll(async () => (await state(page)).scene).toBe('Game');
  await page.waitForFunction(() => (window.__funyDebug.state() as { status?: string }).status === 'playing');
  for (let i = 0; i < 20; i++) await page.evaluate(() => window.__funyDebug.missCurrent());
  await expect.poll(async () => (await state(page)).scene).toBe('Result');
  expect((await state(page)).stars).toBe(0);
  await press(page, '下一关');
  await page.waitForTimeout(300);
  expect((await state(page)).scene).toBe('Result');

  await press(page, '选关');
  await expect.poll(async () => (await state(page)).scene).toBe('LevelSelect');
  await press(page, '第2关');
  await expect.poll(async () => (await state(page)).scene).toBe('Game');

  await ready(page);
  await press(page, '开始游戏');
  await press(page, '第2关');
  await expect.poll(async () => (await state(page)).scene).toBe('Game');

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('funy-app:progress:default')!);
    raw.cards = { '3x4': 3, '5x6': 2, '9x9x': 9 };
    localStorage.setItem('funy-app:progress:default', JSON.stringify(raw));
  });
  await ready(page);
  await press(page, '口诀卡册');
  await expect.poll(async () => (await state(page)).scene).toBe('Cards');
  expect((await state(page)).litCards).toBe(1);

  await ready(page);
  await press(page, '设置');
  await expect.poll(async () => (await state(page)).scene).toBe('Settings');
  await press(page, '语音');
  await ready(page);
  expect((await state(page)).settings?.voice).toBe(false);
  expect(errors).toEqual([]);
});
