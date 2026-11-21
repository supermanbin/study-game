import { test, expect } from '@playwright/test';
import { dbg, press, sceneIs, state, tap, toPage, waitMenu } from '../support';

const cleanBake = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__funyGame.registry.get('clayBake').textures as number);
const clayCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__funyGame.textures.getTextureKeys().filter((k: string) => k.startsWith('clay:')).length as number);

test('menu, level select and settings work in portrait', async ({ page }) => {
  const errors: string[] = [];
  await waitMenu(page, errors);
  await press(page, '开始游戏');
  await sceneIs(page, 'LevelSelect');
  await press(page, '返回');
  await sceneIs(page, 'Menu');
  await press(page, '设置');
  await sceneIs(page, 'Settings');
  for (let i = 0; i < 2; i++) {
    await press(page, '音乐');
    await expect.poll(async () => (await state(page)).scene).toBe('Settings');
    await page.waitForTimeout(100);
  }
  await press(page, '返回');
  await sceneIs(page, 'Menu');
  expect(errors).toEqual([]);
});

test('a real tap on 开始游戏 lands', async ({ page }) => {
  await waitMenu(page);
  const pos = await dbg(page, () => {
    const s = (window as any).__funyGame.scene.getScene('Menu');
    const btn = s.children.list.find((o: any) => o.list?.some((c: any) => c.text === '开始游戏'));
    return btn ? { x: btn.x, y: btn.y } : null;
  });
  expect(pos).not.toBeNull();
  const p = await toPage(page, pos!.x, pos!.y);
  await tap(page, p.x, p.y);
  await sceneIs(page, 'LevelSelect');
});

test('no clay texture is added after Boot', async ({ page }) => {
  await waitMenu(page);
  const boot = await cleanBake(page);
  await press(page, '开始游戏');
  await sceneIs(page, 'LevelSelect');
  await press(page, '返回');
  await sceneIs(page, 'Menu');
  await press(page, '设置');
  await sceneIs(page, 'Settings');
  await press(page, '音乐');
  await page.waitForTimeout(150);
  await press(page, '音乐');
  await page.waitForTimeout(150);
  await press(page, '返回');
  await sceneIs(page, 'Menu');
  expect(await clayCount(page)).toBe(boot);
});
