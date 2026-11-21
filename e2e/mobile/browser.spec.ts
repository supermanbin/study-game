import { test, expect } from '@playwright/test';
import { press, sceneIs, state, waitMenu } from '../support';

test('page blocks browser gestures', async ({ page }) => {
  await waitMenu(page);
  const r = await page.evaluate(() => ({
    body: getComputedStyle(document.body).touchAction,
    canvas: getComputedStyle(document.querySelector('canvas')!).touchAction,
    overscroll: getComputedStyle(document.body).overscrollBehavior,
    viewport: document.querySelector('meta[name=viewport]')!.getAttribute('content')!,
  }));
  expect(r.body).toBe('none');
  expect(r.canvas).toBe('none');
  expect(r.overscroll).toMatch(/^none/);
  expect(r.viewport).toContain('user-scalable=no');
  expect(r.viewport).not.toContain('viewport-fit');
});

test('manifest and icons are served', async ({ page, request }) => {
  await waitMenu(page);
  const m = await request.get('/manifest.webmanifest');
  expect(m.status()).toBe(200);
  expect((await m.json()).display).toBe('fullscreen');
  for (const n of [180, 192, 512]) {
    const r = await request.get(`/icons/icon-${n}.png`);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toBe('image/png');
  }
});

test('开始游戏 still opens level select when fullscreen is refused', async ({ page }) => {
  const errors: string[] = [];
  await waitMenu(page, errors);
  await press(page, '开始游戏'); // not a user gesture, so Chromium rejects requestFullscreen
  await sceneIs(page, 'LevelSelect');
  expect(errors).toEqual([]);
});

test('audio path is reported', async ({ page }) => {
  await waitMenu(page);
  expect((await state(page)).audioPath).toBe('none');
  await expect(page.locator('#audio-path')).toHaveText('音频: none');
});
