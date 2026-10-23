import { test, expect, type Page } from '@playwright/test';

type G = {
  textures: { list: Record<string, unknown>; exists(k: string): boolean };
  canvas: HTMLCanvasElement;
  scene: { getScenes(active: boolean): { scene: { key: string }; children: { list: { type: string; input?: { hitArea: { width: number; height: number } } }[] } }[] };
};
const press = (p: Page, l: string) => p.evaluate(x => (window as unknown as { __funyDebug: { press(l: string): void } }).__funyDebug.press(x), l);
const sceneIs = (p: Page, key: string) =>
  p.waitForFunction(k => (window as unknown as { __funyDebug?: { state(): { scene: string } } }).__funyDebug?.state().scene === k, key);
const textureCount = (p: Page) => p.evaluate(() => Object.keys((window as unknown as { __funyGame: G }).__funyGame.textures.list).length);

async function ready(page: Page): Promise<string[]> {
  const bad: string[] = [];
  page.on('console', m => {
    // Headless Chrome's own GPU perf notices are not app warnings.
    if ((m.type() === 'warning' || m.type() === 'error') && !m.text().includes('GL Driver Message')) bad.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', e => bad.push(`pageerror: ${e.message}`));
  await page.goto('/?debug');
  await sceneIs(page, 'Menu');
  return bad;
}

async function loop(page: Page): Promise<void> {
  for (const [to, back] of [['开始游戏', '返回'], ['设置', '返回'], ['口诀卡册', '返回']] as const) {
    await press(page, to);
    await sceneIs(page, to === '开始游戏' ? 'LevelSelect' : to === '设置' ? 'Settings' : 'Cards');
    await press(page, back);
    await sceneIs(page, 'Menu');
  }
}

test('menu-side scenes reuse cached clay textures (no growth, no warnings)', async ({ page }) => {
  const bad = await ready(page);
  await loop(page);
  const first = await textureCount(page);
  await loop(page);
  expect(await textureCount(page)).toBe(first);
  expect(bad).toEqual([]);
});

test('button hit area is the button rect, not the texture', async ({ page }) => {
  await ready(page);
  const hit = await page.evaluate(() => {
    const menu = (window as unknown as { __funyGame: G }).__funyGame.scene.getScenes(true).find(s => s.scene.key === 'Menu')!;
    const c = menu.children.list.find(o => o.type === 'Container' && o.input && o.input.hitArea.width === 360 && o.input.hitArea.height === 88);
    return c ? { w: c.input!.hitArea.width, h: c.input!.hitArea.height } : null;
  });
  expect(hit).toEqual({ w: 360, h: 88 });
});

test('Boot pre-bakes clay textures', async ({ page }) => {
  await ready(page);
  const ok = await page.evaluate(() => {
    const scale = (window as unknown as { __funyGame: G }).__funyGame.canvas.width / 1280;
    return (window as unknown as { __funyGame: G }).__funyGame.textures.exists(`clay:ball:ff8a6b:42:${scale}`);
  });
  expect(ok).toBe(true);
});
