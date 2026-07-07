import type { TvPayload } from './tv-protocol';
import { parseTvFrames } from './tv-protocol';
import { extractSeriesFromTvPayload } from './bar-parser';

export const BAR_MESSAGE_TYPES = new Set([
  'du',
  'timescale_update',
]);

export function hasBarSeries(p: unknown): boolean {
  return extractSeriesFromTvPayload(p).length > 0;
}

export function isBarPayload(payload: TvPayload): boolean {
  if (!payload.m || !payload.p) return false;
  if (BAR_MESSAGE_TYPES.has(payload.m)) return true;
  return hasBarSeries(payload.p);
}

export function extractBarPayloadsFromFrames(data: string): TvPayload[] {
  return parseTvFrames(data).filter((payload) => isBarPayload(payload));
}

export function countMessageTypes(data: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const payload of parseTvFrames(data)) {
    if (!payload.m) continue;
    counts[payload.m] = (counts[payload.m] ?? 0) + 1;
  }
  return counts;
}
