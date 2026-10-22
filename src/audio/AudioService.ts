import Phaser from 'phaser';
import type { Settings } from '../core/progress';
import type { Rng } from '../core/rng';
import { VOICE_LINES, type VoiceCategory } from './voiceLines';
import { pickLine, Throttle } from './pickLine';
import { playSfx, startBgm, type SfxName } from './synth';

export class AudioService {
  private current: Phaser.Sound.BaseSound | undefined;
  private lastVoiceId: string | undefined;
  private readonly bumpThrottle = new Throttle(80);
  private readonly pegThrottle = new Throttle(35);
  private bgm: { stop(): void } | undefined;
  private musicOn = false;

  constructor(
    private readonly sound: Phaser.Sound.BaseSoundManager,
    private readonly settings: () => Settings,
    private readonly rng: Rng,
  ) {}

  /** Running AudioContext, or undefined (unsupported or still locked before a user gesture). */
  private ctx(): AudioContext | undefined {
    const ctx = (this.sound as unknown as { context?: AudioContext }).context;
    if (!ctx || ctx.state !== 'running') return undefined;
    return ctx;
  }

  voice(cat: VoiceCategory): void {
    try {
      // An interrupted line never fires 'complete', so destroy it here or it leaks in the sound manager.
      const prev = this.current;
      this.current = undefined;
      prev?.stop();
      prev?.destroy();
      if (!this.settings().voice || this.sound.locked || !this.ctx()) return;
      const lines = VOICE_LINES[cat];
      if (!lines || lines.length === 0) return;
      const line = pickLine(lines, this.lastVoiceId, this.rng);
      if (!this.sound.game.cache.audio.exists(line.id)) return;
      this.lastVoiceId = line.id;
      const s = this.sound.add(line.id);
      this.current = s;
      s.once('complete', () => {
        if (this.current === s) this.current = undefined;
        s.destroy();
      });
      s.play();
    } catch {
      /* audio must never break gameplay */
    }
  }

  /** `intensity` 0..1 scales volume, and pitch for 'peg' / 'bump'. */
  sfx(name: SfxName, intensity = 1): void {
    try {
      const s = this.settings();
      if (!s.sfx) return;
      const ctx = this.ctx();
      if (!ctx) return;
      if (name === 'bump' && !this.bumpThrottle.allow(performance.now())) return;
      if (name === 'peg' && !this.pegThrottle.allow(performance.now())) return;
      playSfx(ctx, name, 1, intensity);
    } catch {
      /* ignore */
    }
  }

  setMusic(on: boolean): void {
    if (on && this.musicOn && this.bgm) return; // already playing
    this.musicOn = on;
    try {
      this.bgm?.stop();
      this.bgm = undefined;
      if (!on) return;
      const ctx = this.ctx();
      if (!ctx) {
        // Locked: start once the first gesture unlocks audio.
        this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
          if (this.musicOn && !this.bgm) this.setMusic(true);
        });
        return;
      }
      this.bgm = startBgm(ctx);
    } catch {
      /* ignore */
    }
  }
}
