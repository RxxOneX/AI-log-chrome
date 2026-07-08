import type { Bar } from './types';

export function seriesSignature(bars: Bar[]): string {
  if (bars.length < 2) return '';
  const last = bars[bars.length - 1];
  return `${bars.length}:${last.time}:${Math.round(last.close * 1000)}`;
}

export function isSameSeriesSignature(a: string, b: string): boolean {
  return Boolean(a && b && a === b);
}
