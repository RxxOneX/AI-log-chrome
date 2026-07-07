import { describe, expect, it } from 'vitest';
import { isValidBar, sanitizeBars } from './bar-sanitize';
import { barsToChartData } from './metrics';
import type { Bar } from './types';

describe('bar-sanitize', () => {
  it('rejects null and non-finite values', () => {
    expect(isValidBar(null)).toBe(false);
    expect(isValidBar({ time: 1, open: 1, high: 2, low: 1, close: NaN })).toBe(false);
    expect(isValidBar({ time: 1, open: 1, high: 2, low: 1, close: 10 })).toBe(true);
  });

  it('filters invalid bars', () => {
    const bars: Bar[] = [
      { time: 1, open: 1, high: 2, low: 1, close: 10 },
      { time: 2, open: 1, high: 2, low: 1, close: NaN },
    ];
    expect(sanitizeBars(bars)).toHaveLength(1);
  });
});

describe('barsToChartData', () => {
  it('drops invalid points and dedupes dates', () => {
    const bars: Bar[] = [
      { time: 1_700_000_000, open: 1, high: 2, low: 1, close: 10 },
      { time: 1_700_086_400, open: 1, high: 2, low: 1, close: NaN },
      { time: 1_700_172_800, open: 1, high: 2, low: 1, close: 12 },
    ];
    const data = barsToChartData(bars);
    expect(data.every((point) => Number.isFinite(point.value))).toBe(true);
    expect(data.length).toBe(2);
  });
});
