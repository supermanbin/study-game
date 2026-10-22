export type SfxName = 'correct' | 'wrong' | 'bump' | 'explode' | 'tick' | 'bossHit' | 'item';

interface Tone {
  freq: number;
  end?: number; // optional glide target
  at: number; // start offset (s)
  dur: number; // seconds
  type?: OscillatorType;
  gain?: number;
}

const SFX_TONES: Record<Exclude<SfxName, 'explode'>, Tone[]> = {
  correct: [
    { freq: 660, at: 0, dur: 0.12, type: 'sine' },
    { freq: 880, at: 0.1, dur: 0.18, type: 'sine' },
  ],
  wrong: [{ freq: 300, end: 220, at: 0, dur: 0.25, type: 'triangle', gain: 0.7 }],
  bump: [{ freq: 140, end: 90, at: 0, dur: 0.08, type: 'sine' }],
  tick: [{ freq: 1200, at: 0, dur: 0.04, type: 'square', gain: 0.25 }],
  bossHit: [
    { freq: 200, end: 100, at: 0, dur: 0.2, type: 'sawtooth', gain: 0.5 },
    { freq: 120, end: 70, at: 0.05, dur: 0.25, type: 'triangle' },
  ],
  item: [
    { freq: 523, at: 0, dur: 0.1, type: 'sine' },
    { freq: 659, at: 0.08, dur: 0.1, type: 'sine' },
    { freq: 784, at: 0.16, dur: 0.18, type: 'sine' },
  ],
};

function playTone(ctx: AudioContext, t: Tone, volume: number, base: number): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const start = base + t.at;
  const peak = volume * (t.gain ?? 1) * 0.3;
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.end) osc.frequency.exponentialRampToValueAtTime(t.end, start + t.dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + t.dur + 0.02);
}

function playNoise(ctx: AudioContext, volume: number, base: number): void {
  const dur = 0.35;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, base);
  filter.frequency.exponentialRampToValueAtTime(200, base + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(volume * 0.3, 0.0002), base);
  g.gain.exponentialRampToValueAtTime(0.0001, base + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(base);
}

/** Short (<= 400 ms) soft synthesized effect. */
export function playSfx(ctx: AudioContext, name: SfxName, volume: number): void {
  const now = ctx.currentTime;
  if (name === 'explode') {
    playNoise(ctx, volume, now);
    return;
  }
  for (const t of SFX_TONES[name]) playTone(ctx, t, volume, now);
}

const BGM_GAIN = 0.12;
// C major pentatonic (C4 D4 E4 G4 A4 C5)
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const MELODY = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 3, 2, 1, 0, 0];
const NOTE_SEC = 0.5;

/** Gentle looping pentatonic melody. */
export function startBgm(ctx: AudioContext): { stop(): void } {
  const master = ctx.createGain();
  master.gain.value = BGM_GAIN;
  master.connect(ctx.destination);
  let step = 0;
  let nextTime = ctx.currentTime + 0.05;

  const schedule = (): void => {
    while (nextTime < ctx.currentTime + 1.5) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = SCALE[MELODY[step % MELODY.length]];
      g.gain.setValueAtTime(0.0001, nextTime);
      g.gain.exponentialRampToValueAtTime(0.8, nextTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, nextTime + NOTE_SEC * 0.95);
      osc.connect(g).connect(master);
      osc.start(nextTime);
      osc.stop(nextTime + NOTE_SEC);
      nextTime += NOTE_SEC;
      step++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 500);

  return {
    stop() {
      clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      setTimeout(() => master.disconnect(), 200);
    },
  };
}
