import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1512, height: 860 }, deviceScaleFactor: 2 });

test('canvas renders at the screen pixel density (Retina not blurry)', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __funyDebug?: { state(): { scene: string } } }).__funyDebug?.state().scene === 'Menu');
  const m = await page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const r = c.getBoundingClientRect();
    return { backingW: c.width, physicalW: r.width * devicePixelRatio };
  });
  // The backing store must carry (nearly) one canvas pixel per physical screen pixel.
  expect(m.backingW).toBeGreaterThanOrEqual(m.physicalW * 0.9);
});

test('clicks still land on the right world coordinates at 2x', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __funyDebug?: { state(): { scene: string } } }).__funyDebug?.state().scene === 'Menu');
  // 「开始游戏」 is a real canvas button; click it by screen position via the pointer, not the debug press().
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const pos = await page.evaluate(() => {
    const g = (window as unknown as { __funyGame?: Phaser.Game }).__funyGame;
    const s = g?.scene.getScene('Menu');
    const btn = s?.children.list.find(o => (o as Phaser.GameObjects.Container).list?.some(c => (c as Phaser.GameObjects.Text).text === '开始游戏')) as Phaser.GameObjects.Container | undefined;
    return btn ? { x: btn.x, y: btn.y } : null;
  });
  expect(pos).not.toBeNull();
  await page.mouse.click(box.x + (pos!.x / 1280) * box.width, box.y + (pos!.y / 720) * box.height);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __funyDebug: { state(): { scene: string } } }).__funyDebug.state().scene)).toBe('LevelSelect');
});
