import { describe, it, expect, vi, afterEach } from 'vitest';
import { LocalStorageProgressStore, safeLocalStorage } from './store';
import { defaultProgress } from './progress';

function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('LocalStorageProgressStore', () => {
  it('round-trips under the profile key', async () => {
    const s = fakeStorage();
    const store = new LocalStorageProgressStore(s, 'kid');
    const d = { ...defaultProgress(5, 'kid'), unlockedLevel: 3 as const };
    await store.save(d);
    expect(s.map.has('funy-app:progress:kid')).toBe(true);
    expect(await store.load()).toEqual(d);
  });
  it('load with nothing stored returns default', async () => {
    const d = await new LocalStorageProgressStore(fakeStorage()).load();
    expect(d.unlockedLevel).toBe(1);
    expect(d.profileId).toBe('default');
  });
  it('invalid JSON -> default', async () => {
    const s = fakeStorage();
    s.setItem('funy-app:progress:default', '{not json');
    expect((await new LocalStorageProgressStore(s).load()).unlockedLevel).toBe(1);
  });
  it('wrong version -> default', async () => {
    const s = fakeStorage();
    s.setItem('funy-app:progress:default', JSON.stringify({ ...defaultProgress(0), version: 99, unlockedLevel: 4 }));
    expect((await new LocalStorageProgressStore(s).load()).unlockedLevel).toBe(1);
  });
  it('null storage: load default, save resolves', async () => {
    const store = new LocalStorageProgressStore(null);
    expect((await store.load()).unlockedLevel).toBe(1);
    await expect(store.save(defaultProgress(0))).resolves.toBeUndefined();
  });
  it('quota error on save is swallowed with one warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = fakeStorage();
    s.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    await expect(new LocalStorageProgressStore(s).save(defaultProgress(0))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('getItem throwing on load -> default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = fakeStorage();
    s.getItem = () => { throw new Error('denied'); };
    expect((await new LocalStorageProgressStore(s).load()).unlockedLevel).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('safeLocalStorage', () => {
  it('returns null when window.localStorage getter throws', () => {
    vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('SecurityError'); } });
    expect(safeLocalStorage()).toBeNull();
  });
  it('returns null when window is undefined', () => {
    expect(safeLocalStorage()).toBeNull();
  });
  it('returns the storage when available', () => {
    const s = fakeStorage();
    vi.stubGlobal('window', { localStorage: s });
    expect(safeLocalStorage()).toBe(s);
  });
});
