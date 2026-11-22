import { test, expect, type Page } from '@playwright/test';

test('boots to a canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

type Layout = { kind: string; width: number; height: number };
const debugState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __funyDebug: { state(): { scene: string; layout?: Layout } } }).__funyDebug.state());

test('debug state reports the landscape layout', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(
    () => (window as unknown as { __funyDebug?: { state(): { scene: string } } }).__funyDebug?.state().scene === 'Menu',
  );
  expect((await debugState(page)).layout).toEqual({ kind: 'landscape', width: 1280, height: 720 });
});
