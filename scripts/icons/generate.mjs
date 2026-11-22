// Draws the app icon (clay ball with 9×9) in headless Chromium and writes public/icons/*.png.
// Run from the repo root: node scripts/icons/generate.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZES = [180, 192, 512];
const OUT = 'public/icons';

function draw(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#efe5d8';
  g.fillRect(0, 0, size, size);
  const r = size * 0.4; // ball diameter 80% of the icon
  const cx = size / 2;
  const cy = size / 2 - size * 0.01;
  // soft drop shadow
  g.save();
  g.shadowColor = 'rgba(120, 60, 40, 0.35)';
  g.shadowBlur = size * 0.06;
  g.shadowOffsetX = size * 0.02;
  g.shadowOffsetY = size * 0.035;
  g.fillStyle = '#ff8a6b';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // clay body with radial highlight from the upper left
  const grad = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r);
  grad.addColorStop(0, '#ffc4b0');
  grad.addColorStop(0.35, '#ff8a6b');
  grad.addColorStop(1, '#e56b4b');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // 9×9
  g.font = `900 ${Math.round(size * 0.27)}px "PingFang SC", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.035;
  g.strokeStyle = '#5a3426';
  g.strokeText('9×9', cx, cy + size * 0.01);
  g.fillStyle = '#ffffff';
  g.fillText('9×9', cx, cy + size * 0.01);
  return c.toDataURL('image/png');
}

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const url = await page.evaluate(`(${draw.toString()})(${size})`);
  writeFileSync(`${OUT}/icon-${size}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote ${OUT}/icon-${size}.png`);
}
await browser.close();
