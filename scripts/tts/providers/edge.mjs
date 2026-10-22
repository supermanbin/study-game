import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function resolveBin() {
  if (process.env.EDGE_TTS_BIN) return process.env.EDGE_TTS_BIN;
  const local = resolve(root, '.venv-tts/bin/edge-tts');
  return existsSync(local) ? local : 'edge-tts';
}

/** Provider contract: synthesize(text, outPath, { voice }) -> Promise<void> */
export function synthesize(text, outPath, { voice }) {
  const args = ['--voice', voice, '--rate=+5%', '--text', text, '--write-media', outPath];
  return new Promise((res, rej) => {
    execFile(resolveBin(), args, (err, _stdout, stderr) => {
      if (err) rej(new Error(`edge-tts failed (${err.code ?? err.message}): ${stderr}`));
      else res();
    });
  });
}
