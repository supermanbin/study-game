// Measures how long a question lasts when the child never clicks (rest-based miss), per level, on the GAME clock
// (debug state `gameMs`, the sum of capped frame deltas), so a slow or loaded headless browser does not skew it.
// Usage: npm run dev -- --port 5199   (separate terminal), then: node scripts/measure-question-time.mjs
// Env: BASE (default http://localhost:5199), QUESTIONS (default 20), PARALLEL=1 to run levels concurrently (invalid under load: physics lags the game clock; serial is the default).
// Per-question duration = gameMs from the question's start to the miss, excluding MISS_REVEAL_MS.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5199';
const TARGET = Number(process.env.QUESTIONS ?? 20);
const round10 = x => Math.ceil(x / 10) * 10;

async function measureLevel(browser, level) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.removeItem('funy-app:physics-tuning'));
  await page.goto(`${BASE}/?debug&notime`);
  await page.waitForFunction(() => window.__funyDebug?.state().scene === 'Menu');
  const durations = [];
  const wallStart = Date.now();
  let gameTotal = 0;
  while (durations.length < TARGET) {
    await page.evaluate(n => window.__funyDebug.startLevel(n), level);
    // questionIndex already advances at the miss, so key off nextQuestionPending instead:
    // a question runs from pending=false (start) until pending flips to true (the miss).
    let startMs = null;
    let runStartMs = null;
    let lastMs = 0;
    for (;;) {
      await page.waitForTimeout(40);
      const s = await page.evaluate(() => window.__funyDebug.state());
      // The level ended (e.g. pile overflow shows the Result scene): restart it for more samples.
      if (s.scene !== 'Game') {
        if (runStartMs !== null) break;
        continue;
      }
      lastMs = s.gameMs;
      if (runStartMs === null) runStartMs = s.gameMs;
      if (s.status !== 'playing') break; // level ended (e.g. pile overflow): restart for more samples
      if (!s.nextQuestionPending && startMs === null) {
        startMs = s.gameMs;
      } else if (s.nextQuestionPending && startMs !== null) {
        durations.push(s.gameMs - startMs);
        console.error(`L${level} q${durations.length} ${((s.gameMs - startMs) / 1000).toFixed(1)}s`);
        startMs = null;
        if (durations.length >= TARGET) break;
      }
    }
    gameTotal += lastMs - (runStartMs ?? 0);
  }
  const wall = Date.now() - wallStart;
  await ctx.close();
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length / 1000;
  return { level, n: durations.length, mean, min: Math.min(...durations) / 1000, max: Math.max(...durations) / 1000, speed: gameTotal / wall };
}

const browser = await chromium.launch();
const levels = [1, 2, 3, 4, 5, 6];
const results = !process.env.PARALLEL
  ? await levels.reduce(async (acc, l) => [...(await acc), await measureLevel(browser, l)], Promise.resolve([]))
  : await Promise.all(levels.map(l => measureLevel(browser, l)));
await browser.close();

console.log('level  n   meanT(s)  min   max   gameClock/wall  limit(s)');
for (const r of results) {
  const factor = r.level <= 2 ? 1.2 : 1.0;
  const limit = round10(20 * r.mean * factor);
  console.log(
    `${r.level}      ${r.n}  ${r.mean.toFixed(2)}      ${r.min.toFixed(1)}  ${r.max.toFixed(1)}  ${r.speed.toFixed(2)}            ${limit}`,
  );
}
console.log('timeLimitSec =', JSON.stringify(results.map(r => round10(20 * r.mean * (r.level <= 2 ? 1.2 : 1.0)))));
