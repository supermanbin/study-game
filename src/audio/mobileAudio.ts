export type AudioPath = 'audioSession' | 'silentLoop' | 'none';

/** iPhone, iPad or iPod in the UA, or iPadOS posing as a Mac (MacIntel with several touch points). */
export function isIOS(ua: string, platform: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function chooseAudioPath(env: { hasAudioSession: boolean; ios: boolean }): AudioPath {
  if (env.hasAudioSession) return 'audioSession';
  return env.ios ? 'silentLoop' : 'none';
}

/** A mono 8-bit PCM WAV of silence (every sample 0x80) as a data URI. */
export function silentWavDataUri(ms: number, sampleRate = 8000): string {
  const n = Math.round((sampleRate * ms) / 1000);
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const tag = (o: number, s: string): void => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate, true); // byte rate: 1 byte per sample
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  tag(36, 'data');
  v.setUint32(40, n, true);
  b.fill(0x80, 44);
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + btoa(bin);
}

type SilentDoc = Pick<Document, 'addEventListener' | 'removeEventListener' | 'createElement'>;

/**
 * iOS without audioSession: on the first touch, loop a short silent <audio> so iOS switches to the playback
 * audio mode and Web Audio is heard with the mute switch on. Keeps listening until play() succeeds.
 */
export function installSilentLoop(doc: SilentDoc): void {
  let el: HTMLAudioElement | undefined;
  const events = ['touchend', 'pointerup'] as const;
  const onGesture = (): void => {
    try {
      if (!el) {
        el = doc.createElement('audio');
        el.loop = true;
        el.setAttribute('playsinline', '');
        el.src = silentWavDataUri(500);
      }
      const done = (): void => events.forEach(e => doc.removeEventListener(e, onGesture, true));
      void Promise.resolve(el.play()).then(done, () => {});
    } catch {
      // keep listening for the next gesture
    }
  };
  events.forEach(e => doc.addEventListener(e, onGesture, true));
}

let path: AudioPath = 'none';

export function currentAudioPath(): AudioPath {
  return path;
}

/** Call before the Phaser game (and so any audio) is created. */
export function setupMobileAudio(): AudioPath {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  const ios = isIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  path = chooseAudioPath({ hasAudioSession: !!nav.audioSession, ios });
  if (path === 'audioSession' && nav.audioSession) nav.audioSession.type = 'playback';
  else if (path === 'silentLoop') installSilentLoop(document);
  return path;
}
