import { describe, expect, it } from 'vitest';
import { filterBarsLastCalendarDays } from './metrics';
import type { Bar } from './types';

function bar(time: number, close: number): Bar {
  return { time, open: close, high: close, low: close, close };
}

describe('filterBarsLastCalendarDays', () => {
  const day = 86_400;

  it('keeps only bars within lookback from the last bar', () => {
    const bars = [
      bar(0, 100),
      bar(day * 100, 110),
      bar(day * 800, 120),
      bar(day * 900, 130),
    ];

    const sliced = filterBarsLastCalendarDays(bars, 730);
    expect(sliced.length).toBe(2);
    expect(sliced[0].time).toBe(day * 800);
    expect(sliced[1].time).toBe(day * 900);
  });

  it('returns all bars when history is shorter than lookback', () => {
    const bars = [bar(day * 10, 100), bar(day * 30, 105)];
    expect(filterBarsLastCalendarDays(bars, 730)).toHaveLength(2);
  });
});
