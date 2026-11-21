import { CustomShowTiming, LayoutMode } from '../types';

const SAVED_KEY = 'strings_archive_saved_v1';
const RECENT_KEY = 'strings_archive_recent_v1';
const LAYOUT_MODE_KEY = 'strings_archive_layout_mode_v1';
const SYNC_OFFSETS_KEY = 'strings_archive_sync_offsets_v1';
const CUSTOM_STREAMS_KEY = 'strings_archive_custom_streams_v1';
const CUSTOM_TIMINGS_KEY = 'strings_archive_custom_timings_v1';
const AUTO_ADVANCE_KEY = 'strings_archive_auto_advance_v1';
const MAX_RECENT = 24;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getSafeStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return null;
}

export function loadSavedIds(storage?: StorageLike): string[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function persistSavedIds(ids: string[], storage?: StorageLike): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    // Ignore quota or privacy mode errors
  }
}

export function toggleSavedId(current: string[], id: string): string[] {
  if (current.includes(id)) {
    return current.filter((item) => item !== id);
  }
  return [id, ...current];
}

export function loadRecentIds(storage?: StorageLike): string[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function persistRecentIds(ids: string[], storage?: StorageLike): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // Ignore quota or privacy mode errors
  }
}

export function recordRecentId(current: string[], id: string): string[] {
  const deduped = current.filter((item) => item !== id);
  return [id, ...deduped].slice(0, MAX_RECENT);
}

export function loadLayoutMode(storage?: StorageLike): LayoutMode | null {
  const store = getSafeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(LAYOUT_MODE_KEY);
    if (raw === 'tv' || raw === 'desktop' || raw === 'mobile') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistLayoutMode(mode: LayoutMode, storage?: StorageLike): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(LAYOUT_MODE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function loadSyncOffsets(storage?: StorageLike): Record<string, number> {
  const store = getSafeStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(SYNC_OFFSETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        clean[k] = Math.round(v);
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function persistSyncOffset(
  showId: string,
  offsetSeconds: number,
  storage?: StorageLike
): Record<string, number> {
  const current = loadSyncOffsets(storage);
  const next = { ...current, [showId]: Math.round(offsetSeconds) };
  if (next[showId] === 0) {
    delete next[showId];
  }
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.setItem(SYNC_OFFSETS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function loadCustomStreams(storage?: StorageLike): Record<string, string> {
  const store = getSafeStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(CUSTOM_STREAMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) {
        clean[k] = v.trim();
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function persistCustomStream(
  showId: string,
  streamUrl: string | null,
  storage?: StorageLike
): Record<string, string> {
  const current = loadCustomStreams(storage);
  const next = { ...current };
  if (streamUrl && streamUrl.trim()) {
    next[showId] = streamUrl.trim();
  } else {
    delete next[showId];
  }
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.setItem(CUSTOM_STREAMS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function loadCustomTimings(storage?: StorageLike): Record<string, CustomShowTiming> {
  const store = getSafeStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(CUSTOM_TIMINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, CustomShowTiming>;
  } catch {
    return {};
  }
}

export function persistCustomTiming(
  showId: string,
  timing: CustomShowTiming | null,
  storage?: StorageLike
): Record<string, CustomShowTiming> {
  const current = loadCustomTimings(storage);
  const next = { ...current };
  if (timing && timing.durations.length > 0) {
    next[showId] = timing;
  } else {
    delete next[showId];
  }
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.setItem(CUSTOM_TIMINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function loadAutoAdvanceParts(storage?: StorageLike): boolean {
  const store = getSafeStorage(storage);
  if (!store) return true;
  try {
    const raw = store.getItem(AUTO_ADVANCE_KEY);
    if (raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

export function persistAutoAdvanceParts(enabled: boolean, storage?: StorageLike): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(AUTO_ADVANCE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}
