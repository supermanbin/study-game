import { test, expect, type Page } from '@playwright/test';

export type DebugState = {
  scene: string;
  layout: { kind: string; width: number; height: number };
  questionIndex?: number;
  score?: number;
  status?: string;
  timeLeftMs?: number;
  [k: string]: unknown;
};

export const dbg = <T>(page: Page, fn: (d: any) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__funyDebug)`) as Promise<T>;
export const state = (page: Page): Promise<DebugState> => dbg(page, d => d.state());
export const press = (page: Page, label: string) => page.evaluate(l => (window as any).__funyDebug.press(l), label);
export const sceneIs = (page: Page, scene: string) => expect.poll(async () => (await state(page)).scene).toBe(scene);

export async function waitMenu(page: Page, errors: string[] = []): Promise<void> {
  await page.addInitScript(() => localStorage.removeItem('funy-app:physics-tuning'));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as any).__funyDebug?.state().scene === 'Menu');
}

export async function startLevel(page: Page, id: number, errors: string[] = []): Promise<void> {
  await waitMenu(page, errors);
  await page.evaluate(i => (window as any).__funyDebug.startLevel(i), id);
  await page.waitForFunction(() => {
    const s = (window as any).__funyDebug.state();
    return s.scene === 'Game' && s.questionIndex === 0 && s.status === 'playing';
  });
}

/** Design coordinates to page (CSS px) coordinates: the canvas is letterboxed inside the viewport. */
export async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const { width, height } = (await state(page)).layout;
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + (x / width) * box.width, y: box.y + (y / height) * box.height };
}

/** Touch tap on a touch project, otherwise a mouse click. */
export async function tap(page: Page, x: number, y: number): Promise<void> {
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Aim only at a ball this early in its rest: a rest-based miss needs 1500 ms (REST_MISS_MS) of it. */
const TAP_MAX_REST_MS = 800;

/**
 * Touch-taps (or clicks) a correct, clickable, resting ball; true once the score rises within 600 ms of a tap.
 *
 * Only a resting ball can be aimed at: in headless Chromium the game runs at about 15 fps, so a tap lands a few
 * hundred ms after the state it was aimed from, and a falling ball has moved well past its radius by then. A
 * resting ball stays put, and with `restMs < TAP_MAX_REST_MS` a rest-based miss cannot beat the tap. The sample
 * and its page position come from one evaluate, so the tap follows it by a single round trip.
 * At that frame rate a level-1 ball takes up to about 20 s to come to rest: callers need a 60 s test timeout.
 */
export async function tapCorrectBall(page: Page): Promise<boolean> {
  for (const until = Date.now() + 40_000; Date.now() < until; ) {
    const aim = await page.evaluate(maxRest => {
      const s = (window as any).__funyDebug.state();
      const ball = ((s.balls ?? []) as { x: number; y: number; correct: boolean; clickable: boolean; restMs: number }[]).find(
        b => b.correct && b.clickable && b.restMs > 0 && b.restMs < maxRest,
      );
      if (!ball) return null;
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return { score: (s.score ?? 0) as number, x: r.left + (ball.x / s.layout.width) * r.width, y: r.top + (ball.y / s.layout.height) * r.height };
    }, TAP_MAX_REST_MS);
    if (!aim) {
      await page.waitForTimeout(50);
      continue;
    }
    await tap(page, aim.x, aim.y);
    for (const deadline = Date.now() + 600; Date.now() < deadline; ) {
      // Score only: a questionIndex change alone can be a rest-based miss that raced the tap (score stays put).
      if (((await state(page)).score ?? 0) > aim.score) return true;
      await page.waitForTimeout(50);
    }
  }
  return false;
}
