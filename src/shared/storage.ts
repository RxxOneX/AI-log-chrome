import type { AppSettings, MetricsCacheEntry, WatchlistItem } from './types';
import { DEFAULT_SETTINGS } from './types';

const STORAGE_KEYS = {
  settings: 'settings',
  watchlist: 'watchlist',
  metricsCache: 'metricsCache',
  peakTTRBySymbol: 'peakTTRBySymbol',
} as const;

export async function loadSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.settings] as AppSettings | undefined) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export async function loadWatchlist(): Promise<WatchlistItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.watchlist);
  return (result[STORAGE_KEYS.watchlist] as WatchlistItem[] | undefined) ?? [];
}

export async function saveWatchlist(watchlist: WatchlistItem[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.watchlist]: watchlist });
}

export async function loadMetricsCache(): Promise<Record<string, MetricsCacheEntry>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.metricsCache);
  return (result[STORAGE_KEYS.metricsCache] as Record<string, MetricsCacheEntry> | undefined) ?? {};
}

export async function saveMetricsCache(cache: Record<string, MetricsCacheEntry>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.metricsCache]: cache });
}

export async function loadPeakTTRBySymbol(): Promise<Record<string, number>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.peakTTRBySymbol);
  return (result[STORAGE_KEYS.peakTTRBySymbol] as Record<string, number> | undefined) ?? {};
}

export async function savePeakTTRBySymbol(peaks: Record<string, number>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.peakTTRBySymbol]: peaks });
}
