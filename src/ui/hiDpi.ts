import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';

/**
 * Call first thing in every scene's create(). Zooms the main camera (anchored at the top-left, so scroll
 * stays 0 and world coordinates remain the 1280×720 design space) and rasterizes every Text at the same
 * scale so labels stay crisp.
 */
export function applyHiDpi(scene: Phaser.Scene): void {
  if (RENDER_SCALE === 1) return;
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
  const sharpen = (go: Phaser.GameObjects.GameObject) => {
    if (go instanceof Phaser.GameObjects.Text) go.setResolution(RENDER_SCALE);
  };
  scene.children.list.forEach(sharpen);
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, sharpen);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, sharpen));
}
