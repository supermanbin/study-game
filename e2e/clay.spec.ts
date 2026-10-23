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

// ---- Task 3: game world ----

type Ball = { radius: number; shellW: number; lookScaleX: number; shellOriginX: number; shellX: number; shellY: number; x: number; y: number; shellAngle: number; stripeAngle: number };
type Dbg = {
  startLevel(id: number): void;
  answerCorrect(): void;
  missCurrent(): void;
  state(): { scene: string; questionIndex?: number; status?: string; balls?: Ball[]; settings?: { music: boolean } };
};
const dbg = (p: Page) => p.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.state());
const balls = async (p: Page): Promise<Ball[]> => (await dbg(p)).balls ?? [];

async function startLevel(page: Page, id: number): Promise<string[]> {
  await page.addInitScript(() => localStorage.removeItem('funy-app:physics-tuning'));
  const bad = await ready(page);
  await page.evaluate(n => (window as unknown as { __funyDebug: Dbg }).__funyDebug.startLevel(n), id);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __funyDebug: Dbg }).__funyDebug.state();
    return s.scene === 'Game' && s.questionIndex === 0 && s.status === 'playing';
  });
  return bad;
}

/** Design px → page px on the FIT-scaled canvas. */
async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height };
}

/** Named textures only: every Text owns a canvas texture under a random UUID key, created and freed with it. */
const namedTextureCount = (p: Page) =>
  p.evaluate(
    () =>
      Object.keys((window as unknown as { __funyGame: G }).__funyGame.textures.list).filter(
        k => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k),
      ).length,
  );

test('gameplay allocates no textures (Review Focus 5)', async ({ page }) => {
  const bad = await startLevel(page, 1);
  // Question 1 has spawned all of its balls.
  await expect.poll(async () => (await balls(page)).length, { timeout: 5000 }).toBeGreaterThanOrEqual(3);
  const first = await namedTextureCount(page);
  for (let i = 0; i < 5; i++) await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.answerCorrect());
  for (let i = 0; i < 2; i++) await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.missCurrent());
  await page.waitForTimeout(1200);
  expect(await namedTextureCount(page)).toBe(first);
  expect(bad).toEqual([]);
});

// Shadow padding of a raised ball of diameter d (clay.ts pads()): [low, high] design px.
const PADS: Record<number, [number, number]> = { 42: [16, 34], 52: [18, 39] };

test('ball shell: body radius 42/52, shell = 2r + shadow padding, centred on the body (Review Focus 3)', async ({ page }) => {
  const bad = await startLevel(page, 1);
  await expect.poll(async () => (await balls(page)).length, { timeout: 5000 }).toBeGreaterThanOrEqual(3);
  const list = await balls(page);
  for (const b of list) {
    expect([42, 52]).toContain(b.radius);
    const [lo, hi] = PADS[b.radius];
    // shellW is the displayed width: undo the pop-in / squash visual scale.
    const w = b.shellW / b.lookScaleX;
    expect(Math.abs(w - (2 * b.radius + lo + hi))).toBeLessThan(1);
    // The visible body centre (lo + r into the texture) sits on the origin, which follows the physics centre.
    expect(Math.abs(b.shellOriginX * w - (lo + b.radius))).toBeLessThan(1);
    expect(Math.abs(b.shellX - b.x)).toBeLessThan(0.5);
    expect(Math.abs(b.shellY - b.y)).toBeLessThan(0.5);
  }
  expect(bad).toEqual([]);
});

test('shell never rotates; the stripe container spins with the body', async ({ page }) => {
  const bad = await startLevel(page, 1);
  await expect.poll(async () => (await balls(page)).length, { timeout: 5000 }).toBeGreaterThanOrEqual(3);
  const before = await balls(page);
  await page.waitForTimeout(1000);
  const after = await balls(page);
  for (const b of after) expect(b.shellAngle).toBe(0);
  const turned = after.some((b, i) => before[i] && Math.abs(b.stripeAngle - before[i].stripeAngle) > 1);
  expect(turned).toBe(true);
  expect(bad).toEqual([]);
});

test('pressing one button and releasing on another clicks neither', async ({ page }) => {
  await ready(page);
  const a = await toPage(page, 640, 380); // 开始游戏
  const b = await toPage(page, 640, 495); // 口诀卡册
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect((await dbg(page)).scene).toBe('Menu');
  // A normal click still works.
  await page.mouse.click(b.x, b.y);
  await sceneIs(page, 'Cards');
});

test('tapping a settings switch toggles it like its row button', async ({ page }) => {
  await ready(page);
  await press(page, '设置');
  await sceneIs(page, 'Settings');
  const before = (await dbg(page)).settings!.music;
  const t = await toPage(page, 850, 222); // 音乐 switch
  await page.mouse.click(t.x, t.y);
  await expect.poll(async () => (await dbg(page)).settings!.music).toBe(!before);
});

const clayCount = (p: Page) =>
  p.evaluate(() => Object.keys((window as unknown as { __funyGame: G }).__funyGame.textures.list).filter(k => k.startsWith('clay:')).length);

test('Boot pre-bakes every menu-side and result texture (no clay texture is added later)', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  const bad = await ready(page);
  // Count recorded by Boot right after its pre-bakes, so Menu's own textures are covered too.
  const boot = (await page.evaluate(() => (window as unknown as { __funyDebug: { state(): { clayBake?: { textures: number } } } }).__funyDebug.state().clayBake))!.textures;
  expect(await clayCount(page)).toBe(boot);
  for (const [to, key] of [['开始游戏', 'LevelSelect'], ['设置', 'Settings'], ['口诀卡册', 'Cards']] as const) {
    await press(page, to);
    await sceneIs(page, key);
    if (key === 'Settings') {
      // Both switch states: flip music off and back on (each flip restarts the scene).
      for (const want of [false, true]) {
        await press(page, '音乐');
        await expect.poll(async () => (await dbg(page)).settings!.music).toBe(want);
        await page.waitForTimeout(200);
      }
    }
    await press(page, '返回');
    await sceneIs(page, 'Menu');
  }
  await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.startLevel(1));
  await page.waitForFunction(() => {
    const s = (window as unknown as { __funyDebug: Dbg }).__funyDebug.state();
    return s.scene === 'Game' && s.status === 'playing';
  });
  for (let i = 0; i < 20; i++) await page.evaluate(() => (window as unknown as { __funyDebug: Dbg }).__funyDebug.answerCorrect());
  await sceneIs(page, 'Result');
  expect((await page.evaluate(() => (window as unknown as { __funyDebug: { state(): { stars?: number } } }).__funyDebug.state())).stars).toBe(3);
  await page.waitForTimeout(300);
  expect(await clayCount(page)).toBe(boot);
  expect(bad).toEqual([]);
});
