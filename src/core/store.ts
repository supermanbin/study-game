import { defaultProgress, parseProgress, type ProgressData } from './progress';

/** Swap point: a future server-backed store implements the same interface. */
export interface ProgressStore {
  load(): Promise<ProgressData>;
  save(d: ProgressData): Promise<void>;
}

export class LocalStorageProgressStore implements ProgressStore {
  private readonly key: string;

  constructor(
    private readonly storage: Storage | null,
    private readonly profileId = 'default',
  ) {
    this.key = `funy-app:progress:${profileId}`;
  }

  async load(): Promise<ProgressData> {
    const now = Date.now();
    if (!this.storage) return defaultProgress(now, this.profileId);
    try {
      const text = this.storage.getItem(this.key);
      if (text === null) return defaultProgress(now, this.profileId);
      const d = parseProgress(JSON.parse(text), now);
      return d.profileId === this.profileId ? d : defaultProgress(now, this.profileId);
    } catch (e) {
      console.warn('progress load failed, using defaults', e);
      return defaultProgress(now, this.profileId);
    }
  }

  async save(d: ProgressData): Promise<void> {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(d));
    } catch (e) {
      console.warn('progress save failed', e);
    }
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
