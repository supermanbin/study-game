import { describe, expect, it, vi } from 'vitest';
import { chooseAudioPath, installSilentLoop, isIOS, silentWavDataUri } from './mobileAudio';

describe('isIOS', () => {
  it('detects iPhone, iPad and iPadOS desktop UA, not Android or Mac', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 'iPad', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv81', 5)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
  });
});

describe('chooseAudioPath', () => {
  it('prefers audioSession, then the iOS silent loop, else none', () => {
    expect(chooseAudioPath({ hasAudioSession: true, ios: true })).toBe('audioSession');
    expect(chooseAudioPath({ hasAudioSession: true, ios: false })).toBe('audioSession');
    expect(chooseAudioPath({ hasAudioSession: false, ios: true })).toBe('silentLoop');
    expect(chooseAudioPath({ hasAudioSession: false, ios: false })).toBe('none');
  });
});

describe('silentWavDataUri', () => {
  it('is a mono 8-bit PCM WAV of silence (0x80)', () => {
    const uri = silentWavDataUri(500);
    const prefix = 'data:audio/wav;base64,';
    expect(uri.startsWith(prefix)).toBe(true);
    const b = Buffer.from(uri.slice(prefix.length), 'base64');
    expect(b.toString('ascii', 0, 4)).toBe('RIFF');
    expect(b.toString('ascii', 8, 12)).toBe('WAVE');
    expect(b.toString('ascii', 12, 16)).toBe('fmt ');
    expect(b.readUInt16LE(20)).toBe(1);
    expect(b.readUInt16LE(22)).toBe(1);
    expect(b.readUInt16LE(34)).toBe(8);
    expect(b.toString('ascii', 36, 40)).toBe('data');
    expect(b.readUInt32LE(40)).toBe(4000);
    const data = b.subarray(44);
    expect(data.length).toBe(4000);
    expect(data.every(x => x === 0x80)).toBe(true);
  });
});

describe('installSilentLoop', () => {
  it('creates one element and retries after a rejection', async () => {
    const listeners: Record<string, () => void> = {};
    const play = vi.fn().mockRejectedValueOnce(new Error('blocked')).mockResolvedValue(undefined);
    const el = { loop: false, src: '', play, setAttribute: vi.fn() };
    const doc = {
      addEventListener: vi.fn((t: string, fn: () => void) => void (listeners[t] = fn)),
      removeEventListener: vi.fn(),
      createElement: vi.fn(() => el),
    };
    installSilentLoop(doc as never);
    expect(Object.keys(listeners).sort()).toEqual(['pointerup', 'touchend']);
    listeners.touchend();
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.removeEventListener).not.toHaveBeenCalled();
    listeners.pointerup();
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.createElement).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
    expect(doc.removeEventListener.mock.calls.map(c => c[0]).sort()).toEqual(['pointerup', 'touchend']);
    expect(el.loop).toBe(true);
    expect(el.src).toBe(silentWavDataUri(500));
  });
});
