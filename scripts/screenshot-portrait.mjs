// Portrait screenshots on a 390x844 @3x phone viewport. Needs the dev server on :5199.
// Usage: node scripts/screenshot-portrait.mjs   -> /tmp/portrait-<name>.png
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const dbg = fn => page.evaluate(fn);
const shot = name => page.screenshot({ path: `/tmp/portrait-${name}.png` });
const startLevel = async id => {
  await dbg(`window.__funyDebug.startLevel(${id})`);
  await page.waitForFunction(() => {
    const s = window.__funyDebug.state();
    return s.scene === 'Game' && s.status === 'playing';
  });
};
const balls = () => page.waitForFunction(() => (window.__funyDebug.state().balls ?? []).length >= 3);

await page.addInitScript(() => localStorage.removeItem('funy-app:physics-tuning'));
await page.goto('http://localhost:5199/?debug');
await page.waitForFunction(() => window.__funyDebug?.state().scene === 'Menu');
await page.waitForTimeout(500);
await shot('menu');

await dbg('window.__funyDebug.unlockAll()');
const toScene = async (label, scene) => {
  await dbg(`window.__funyDebug.press(${JSON.stringify(label)})`);
  await page.waitForFunction(s => window.__funyDebug.state().scene === s, scene);
  await page.waitForTimeout(400);
};
await toScene('开始游戏', 'LevelSelect');
await shot('levelselect');
await toScene('返回', 'Menu');
await toScene('设置', 'Settings');
await shot('settings');
await toScene('返回', 'Menu');
await startLevel(1);
await balls();
await shot('game-l1');

await dbg('window.__funyDebug.press("暂停")');
await page.waitForFunction(() => window.__funyDebug.state().status === 'paused');
await page.waitForTimeout(300);
await shot('pause');
await dbg('window.__funyDebug.press("返回选关")');
await page.waitForFunction(() => window.__funyDebug.state().scene === 'LevelSelect');

await startLevel(3);
await balls();
await page.waitForTimeout(500);
await shot('game-l3');

await browser.close();
