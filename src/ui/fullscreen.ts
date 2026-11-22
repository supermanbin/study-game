export function shouldRequestFullscreen(env: {
  maxTouchPoints: number;
  fullscreenEnabled: boolean;
  fullscreenElement: unknown;
}): boolean {
  return env.maxTouchPoints > 0 && env.fullscreenEnabled && !env.fullscreenElement;
}

/** Android: go fullscreen from the 开始游戏 tap (a user gesture). Refusal or no support is silent. */
export function requestFullscreenOnTouch(): void {
  try {
    if (
      !shouldRequestFullscreen({
        maxTouchPoints: navigator.maxTouchPoints,
        fullscreenEnabled: document.fullscreenEnabled,
        fullscreenElement: document.fullscreenElement,
      })
    )
      return;
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {});
  } catch {
    // fullscreen is optional
  }
}
