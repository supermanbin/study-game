// Measures how long a question lasts when the child never clicks (rest-based miss), per level, on the GAME clock
// (debug state `gameMs`, the sum of capped frame deltas). The physics and the game clock share the same per-frame
// cap (MAX_FRAME_DELTA_MS = Matter runner maxFrameTime), so slow frames slow both equally; results still depend
// somewhat on frame rate and host load, so run on a quiet machine and check the printed gameClock/wall ratio
// (≈1 means the browser kept up with real time).
//
// Ramp coverage: spec §6 wants T averaged over all 20 questions of a level, including the difficultyAt ramp. A
// level with no clicks ends by pile overflow after ~7-8 misses, so each run picks the lowest under-sampled
// question index i, answers every other question correctly via __funyDebug.answerCorrect (all before i, and
// those from i on whose parity differs from i, so the pile grows at half the no-click rate from i on), and
// samples only the unanswered questions (indices >= i with i's parity) until the level ends. Runs repeat until every index
// 0..19 has SAMPLES samples. T = mean of the per-index means (each of the 20 questions weighs the same).
//
// Usage: npm run dev -- --port 5199   (separate terminal), then: node scripts/measure-question-time.mjs
// Env: BASE (default http://localhost:5199), SAMPLES per question index (default 2), LEVELS (default 1,2,3,4,5,6).
// Levels run serially (in parallel the browsers starve each other's frames).
// On macOS run it under `caffeinate -dims` so the host does not sleep: the game clock is immune, but the wall-clock
// watchdog then aborts runs and the gameClock/wall ratio becomes meaningless.
// Per-question duration = gameMs from the question's start to the miss, excluding MISS_REVEAL_MS.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5199';
const SAMPLES = Number(process.env.SAMPLES ?? 2);
const LEVEL_IDS = (process.env.LEVELS ?? '1,2,3,4,5,6').split(',').map(Number);
const QUESTIONS = 20;
const BUCKET = 5;
/** Watchdog: game-clock ms for one unanswered question, and wall ms without any question boundary. */
const STALL_MS = 30_000;
const STALL_WALL_MS = 180_000;
const round10 = x => Math.ceil(x / 10) * 10;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

async function measureLevel(browser, level) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.removeItem('funy-app:physics-tuning'));
  await page.goto(`${BASE}/?debug&notime`);
  await page.waitForFunction(() => window.__funyDebug?.state().scene === 'Menu');
  /** samples[i] = durations (ms) of unanswered question index i. */
  const samples = Array.from({ length: QUESTIONS }, () => []);
  const wallStart = Date.now();
  let gameTotal = 0;
  let lastFirst = -1;
  let lastFirstCount = -1;
  let idleRuns = 0;
  let stalls = 0;
  for (;;) {
    const first = samples.findIndex(s => s.length < SAMPLES);
    if (first < 0) break;
    if (samples[first].length === lastFirstCount && first === lastFirst && ++idleRuns >= 3) {
      throw new Error(`L${level}: three runs in a row added no sample for question ${first}`);
    }
    if (first !== lastFirst || samples[first].length !== lastFirstCount) idleRuns = 0;
    lastFirst = first;
    lastFirstCount = samples[first].length;
    const parity = first % 2;
    const sampled = i => i >= first && i % 2 === parity;
    await page.evaluate(n => window.__funyDebug.startLevel(n), level);
    let startMs = null;
    let startIdx = null;
    let runStartMs = null;
    let lastMs = 0;
    let lastPile = 0;
    let answeredIdx = -1;
    let runWall = Date.now();
    for (;;) {
      await page.waitForTimeout(40);
      const s = await page.evaluate(() => window.__funyDebug.state());
      // Watchdog: a question that never ends (a ball that never rests) or a wedged page. Discard the run.
      const stuckQuestion = startMs !== null && s.gameMs - startMs > STALL_MS;
      if (stuckQuestion || Date.now() - runWall > STALL_WALL_MS) {
        stalls++;
        console.error(`L${level} watchdog: run aborted (${stuckQuestion ? `q${startIdx} > ${STALL_MS / 1000}s` : 'no progress'}) ${JSON.stringify(s)}`);
        await page.screenshot({ path: `/tmp/measure-stall-L${level}-${stalls}.png` }).catch(() => {});
        break;
      }
      if (s.scene !== 'Game' || s.status !== 'playing') {
        if (runStartMs === null) continue;
        // The level ended: by pile overflow, or by the miss of the last question (no pending phase then).
        // The Result scene follows within a frame, so the last question's end is the last game-clock reading
        // (an overflow needs a tall pile, which the last question never has after the answered ones).
        if (startIdx === QUESTIONS - 1 && startMs !== null && (s.questionIndex === QUESTIONS || (s.scene !== 'Game' && lastPile < 12))) {
          const end = s.scene === 'Game' ? s.gameMs : lastMs;
          samples[startIdx].push(end - startMs);
          console.error(`L${level} q${startIdx} ${((end - startMs) / 1000).toFixed(1)}s (level end)`);
        }
        if (s.scene === 'Game') lastMs = s.gameMs;
        break;
      }
      lastMs = s.gameMs;
      lastPile = s.pileCount;
      if (runStartMs === null) runStartMs = s.gameMs;
      // questionIndex advances at the miss / correct answer, so a question runs from pending=false until
      // pending flips to true.
      if (!s.nextQuestionPending && startMs === null) {
        if (!sampled(s.questionIndex)) {
          if (s.questionIndex !== answeredIdx) runWall = Date.now();
          answeredIdx = s.questionIndex;
          // Retried on every poll until the answer lands (the correct ball may not be clickable yet).
          await page.evaluate(() => window.__funyDebug.answerCorrect());
          continue;
        }
        startMs = s.gameMs;
        startIdx = s.questionIndex;
      } else if (s.nextQuestionPending && startMs !== null) {
        samples[startIdx].push(s.gameMs - startMs);
        console.error(`L${level} q${startIdx} ${((s.gameMs - startMs) / 1000).toFixed(1)}s pile=${s.pileCount}`);
        startMs = null;
        runWall = Date.now();
      }
    }
    gameTotal += lastMs - (runStartMs ?? 0);
  }
  const wall = Date.now() - wallStart;
  await ctx.close();
  const perIndex = samples.map(s => mean(s) / 1000);
  const buckets = [];
  for (let b = 0; b < QUESTIONS; b += BUCKET) buckets.push(mean(perIndex.slice(b, b + BUCKET)));
  const all = samples.flat();
  return {
    level,
    n: all.length,
    mean: mean(perIndex),
    buckets,
    min: Math.min(...all) / 1000,
    max: Math.max(...all) / 1000,
    speed: gameTotal / wall,
    stalls,
  };
}

const limitOf = r => round10(20 * r.mean * (r.level <= 2 ? 1.2 : 1.0));
const browser = await chromium.launch();
const results = [];
for (const l of LEVEL_IDS) results.push(await measureLevel(browser, l));
await browser.close();

const bucketHead = Array.from({ length: QUESTIONS / BUCKET }, (_, b) => `q${b * BUCKET}-${b * BUCKET + BUCKET - 1}`);
console.log(['level', 'n', 'meanT(s)', ...bucketHead, 'min', 'max', 'gameClock/wall', 'stalls', 'limit(s)'].join('\t'));
for (const r of results) {
  console.log(
    [r.level, r.n, r.mean.toFixed(2), ...r.buckets.map(b => b.toFixed(2)), r.min.toFixed(1), r.max.toFixed(1), r.speed.toFixed(2), r.stalls, limitOf(r)].join('\t'),
  );
}
console.log('timeLimitSec =', JSON.stringify(results.map(limitOf)));
