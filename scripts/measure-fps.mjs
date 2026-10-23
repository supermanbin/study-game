// Measures mean game FPS with a crowded field (20+ balls) at devicePixelRatio 2, for the clay-visual
// performance budget (after ≥ 90% of before). Each run starts level 1 with `?debug&notime`, misses MISSES questions
// via __funyDebug.missCurrent (spaced so the balls spread out instead of stacking up at once), then counts
// requestAnimationFrame callbacks over SAMPLE_MS. RUNS runs, prints each and the median.
// MISSES defaults to 5 (5×4 grey + 4 current = 24 balls): at real speed 6+ misses on level 1 overflow the pile
// (2 s above the warning line) and end the level during sampling, which the script reports as an error.
//
// Usage: npx vite --port 5199 --strictPort   (separate terminal), then: node scripts/measure-fps.mjs
// Env: BASE (default http://localhost:5199), RUNS (default 3), SAMPLE_MS (default 5000), MISSES (default 5),
// GL (default `metal`: headless Chromium on the host GPU via ANGLE Metal with vsync and the frame-rate limit off,
// so the number is the uncapped frame rate and a per-frame cost increase shows up instead of hiding under 60 Hz;
// `swiftshader` = Playwright's default software WebGL, CPU-bound, ~8 fps, slow enough that the game runs in slow
// motion). Compare numbers taken with the same GL only.
// Results depend on host load: note `uptime` next to them and compare numbers taken under similar load.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5199';
const RUNS = Number(process.env.RUNS ?? 3);
const SAMPLE_MS = Number(process.env.SAMPLE_MS ?? 5000);
const MISSES = Number(process.env.MISSES ?? 5);
const MISS_GAP_MS = 700;
const MIN_BALLS = 20;
const GL = process.env.GL ?? 'metal';
const LAUNCH_ARGS = GL === 'swiftshader' ? [] : [`--use-angle=${GL}`, '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'];

async function measureOnce(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.addInitScript(() => localStorage.removeItem('funy-app:physics-tuning'));
    await page.goto(`${BASE}/?debug&notime`);
    await page.waitForFunction(() => window.__funyDebug?.state().scene === 'Menu');
    await page.evaluate(() => window.__funyDebug.startLevel(1));
    await page.waitForFunction(() => window.__funyDebug.state().scene === 'Game');
    await page.waitForTimeout(MISS_GAP_MS);
    for (let i = 0; i < MISSES; i++) {
      await page.evaluate(() => window.__funyDebug.missCurrent());
      await page.waitForTimeout(MISS_GAP_MS);
    }
    // Let the newest question's balls launch.
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => window.__funyDebug.state());
    const fps = await page.evaluate(
      ms =>
        new Promise(resolve => {
          let frames = 0;
          let t0 = null;
          const tick = t => {
            if (t0 === null) t0 = t;
            else frames++;
            if (t - t0 >= ms) resolve((frames * 1000) / (t - t0));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      SAMPLE_MS,
    );
    const after = await page.evaluate(() => window.__funyDebug.state());
    const renderScale = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? c.width / 1280 : null;
    });
    // pileCount = greyed balls of earlier questions; the current question adds 4 more on level 1's early indices.
    const balls = (before.pileCount ?? 0) + 4;
    if (after.scene !== 'Game' || after.status !== 'playing') {
      throw new Error(`level ended during sampling: ${JSON.stringify(after)}`);
    }
    if (balls < MIN_BALLS) throw new Error(`only ~${balls} balls on the field: ${JSON.stringify(before)}`);
    return { fps, balls, renderScale };
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
{
  const p = await browser.newPage();
  const gpu = await p.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(`WebGL renderer: ${gpu}`);
  await p.close();
}
const results = [];
try {
  for (let i = 0; i < RUNS; i++) {
    const r = await measureOnce(browser);
    results.push(r.fps);
    console.log(`run ${i + 1}: ${r.fps.toFixed(1)} fps (~${r.balls} balls, canvas scale ${r.renderScale})`);
  }
} finally {
  await browser.close();
}
const sorted = [...results].sort((a, b) => a - b);
console.log(`median: ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} fps over ${RUNS} runs`);
