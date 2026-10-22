import { test, expect, type Page } from '@playwright/test';

type DebugState = {
  scene: string;
  questionIndex?: number;
  score?: number;
  status?: string;
  timeLeftMs?: number;
  stars?: number;
};

declare global {
  interface Window {
    __funyDebug: {
      answerCorrect(): void;
      answerWrong(): void;
      missCurrent(): void;
      doubleClickCorrect(): void;
      startLevel(id: number): void;
      unlockAll(): void;
      state(): DebugState;
    };
  }
}

const state = (page: Page) => page.evaluate(() => window.__funyDebug.state());

async function startLevel1(page: Page, errors: string[]) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__funyDebug?.state().scene === 'Menu');
  await page.evaluate(() => window.__funyDebug.startLevel(1));
  await page.waitForFunction(() => {
    const s = window.__funyDebug.state();
    return s.scene === 'Game' && s.questionIndex === 0 && s.status === 'playing';
  });
}

test('scoring through the click path, wrong penalty, blur auto-pause', async ({ page }) => {
  const errors: string[] = [];
  await startLevel1(page, errors);

  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__funyDebug.answerCorrect());
  let s = await state(page);
  expect(s.score).toBe(35);
  expect(s.questionIndex).toBe(3);

  await page.evaluate(() => window.__funyDebug.answerWrong());
  s = await state(page);
  expect(s.score).toBe(30);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => (await state(page)).status).toBe('paused');
  const before = (await state(page)).timeLeftMs;
  await page.waitForTimeout(1500);
  expect((await state(page)).timeLeftMs).toBe(before);

  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).status).toBe('playing');
  expect(errors).toEqual([]);
});

test('double click on the correct option scores once and advances one question', async ({ page }) => {
  const errors: string[] = [];
  await startLevel1(page, errors);
  await page.evaluate(() => window.__funyDebug.doubleClickCorrect());
  const s = await state(page);
  expect(s.score).toBe(10);
  expect(s.questionIndex).toBe(1);
  expect(errors).toEqual([]);
});

test('finishing all 20 questions shows the result scene with stars', async ({ page }) => {
  const errors: string[] = [];
  await startLevel1(page, errors);
  for (let i = 0; i < 20; i++) await page.evaluate(() => window.__funyDebug.answerCorrect());
  await page.waitForFunction(() => window.__funyDebug.state().scene === 'Result');
  expect((await state(page)).stars).toBe(3);
  const saved = await page.evaluate(() => localStorage.getItem('funy-app:progress:default'));
  expect(saved).not.toBeNull();
  const data = JSON.parse(saved!);
  expect(data.levels['1'].bestStars).toBe(3);
  expect(data.unlockedLevel).toBe(2);
  expect(errors).toEqual([]);
});

test('missCurrent advances without scoring', async ({ page }) => {
  const errors: string[] = [];
  await startLevel1(page, errors);
  await page.evaluate(() => window.__funyDebug.missCurrent());
  const s = await state(page);
  expect(s.questionIndex).toBe(1);
  expect(s.score).toBe(0);
  expect(errors).toEqual([]);
});
