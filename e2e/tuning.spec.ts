import { test, expect } from '@playwright/test';

const KEY = 'funy-app:physics-tuning';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(k => {
    if (!sessionStorage.getItem('tuning-cleared')) {
      localStorage.removeItem(k);
      sessionStorage.setItem('tuning-cleared', '1');
    }
  }, KEY);
});

test('panel is shown only with ?debug', async ({ page }) => {
  await page.goto('/?debug');
  await expect(page.locator('#tuning-panel')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('#tuning-panel')).toHaveCount(0);
});

test('gravity persists across reload and reset restores the default', async ({ page }) => {
  await page.goto('/?debug');
  const gravity = page.locator('#tuning-panel input[data-key="gravity"]');
  await gravity.evaluate((el: HTMLInputElement) => {
    el.value = '1.5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload();
  await expect(gravity).toHaveValue('1.5');
  await page.getByRole('button', { name: '恢复默认' }).click();
  await expect(gravity).toHaveValue('1');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}').gravity, KEY)).toBe(1);
});
