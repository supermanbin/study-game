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

type SupportBall = { x: number; y: number; correct: boolean; clickable: boolean };

/**
 * Touch-taps (or clicks) a correct, clickable ball below the ceiling, up to 15 tries; true once the score
 * rises within 600 ms of a tap.
 */
export async function tapCorrectBall(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 15; attempt++) {
    // Balls spawn one by one, so the correct one may not exist yet: wait for it (up to 8 s) before tapping.
    let s = await state(page);
    let ball: SupportBall | undefined;
    for (const until = Date.now() + 8000; Date.now() < until; ) {
      s = await state(page);
      const ceilingY = s.layout.kind === 'portrait' ? 226 : 140;
      ball = ((s.balls ?? []) as SupportBall[]).find(b => b.correct && b.clickable && b.y > ceilingY);
      if (ball) break;
      await page.waitForTimeout(100);
    }
    if (!ball) continue;
    const p = await toPage(page, ball.x, ball.y);
    await tap(page, p.x, p.y);
    const deadline = Date.now() + 600;
    while (Date.now() < deadline) {
      const n = await state(page);
      // Score only: a questionIndex change alone can be a rest-based miss that raced the tap (score stays put).
      if ((n.score ?? 0) > (s.score ?? 0)) return true;
      await page.waitForTimeout(50);
    }
  }
  return false;
}
