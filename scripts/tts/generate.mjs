#!/usr/bin/env node
// Usage: node scripts/tts/generate.mjs [--provider edge] [--force]
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const force = argv.includes('--force');
const pi = argv.indexOf('--provider');
const providerName = pi >= 0 ? argv[pi + 1] : 'edge';
if (!/^[a-z0-9-]+$/.test(providerName ?? '')) {
  console.error('invalid --provider');
  process.exit(1);
}

const { synthesize } = await import(`./providers/${providerName}.mjs`);
const { voice, lines } = JSON.parse(readFileSync(resolve(root, 'content/voice-lines.json'), 'utf8'));
const outDir = resolve(root, 'public/audio/voice');
mkdirSync(outDir, { recursive: true });

let made = 0, skipped = 0;
for (const items of Object.values(lines)) {
  for (const { id, text } of items) {
    const out = resolve(outDir, `${id}.mp3`);
    if (!force && existsSync(out) && statSync(out).size > 0) { skipped++; continue; }
    await synthesize(text, out, { voice });
    console.log(`generated ${id}`);
    made++;
  }
}
console.log(`done: ${made} generated, ${skipped} skipped`);
