import type { Bar } from './types';
import { isValidBar } from './bar-sanitize';

export type TvHistoryResponse = {
  s: string;
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
};

export function isHistoryUrl(url: string): boolean {
  try {
    const path = new URL(url, 'https://tradingview.com').pathname;
    return path.includes('/history');
  } catch {
    return url.includes('/history');
  }
}

export function parseHistoryResponse(json: unknown): Bar[] | null {
  if (!json || typeof json !== 'object') return null;

  const data = json as TvHistoryResponse;
  if (data.s !== 'ok' || !Array.isArray(data.t) || !Array.isArray(data.c)) {
    return null;
  }

  const bars: Bar[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const time = data.t[i];
    const close = data.c[i];
    const open = data.o?.[i] ?? close;
    const high = data.h?.[i] ?? close;
    const low = data.l?.[i] ?? close;

    if (
      typeof time !== 'number' ||
      typeof open !== 'number' ||
      typeof high !== 'number' ||
      typeof low !== 'number' ||
      typeof close !== 'number'
    ) {
      continue;
    }

    const bar = { time, open, high, low, close };
    if (!isValidBar(bar)) continue;

    bars.push(bar);
  }

  return bars.length > 0 ? bars : null;
}
