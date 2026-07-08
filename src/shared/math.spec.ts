import { describe, expect, it } from 'vitest';
import { calculateMaxTTR, evaluateDrawdownStatus, TTR_RECOVERY_CONFIRM_BARS } from './math';
import type { Bar } from './types';

function bar(time: number, close: number): Bar {
  return { time, open: close, high: close, low: close, close };
}

describe('calculateMaxTTR', () => {
  const day = 86_400;

  it('starts DCA from the first bar of the window', () => {
    const bars = [
      bar(0, 100),
      bar(day, 80),
      bar(day * 2, 70),
    ];

    expect(calculateMaxTTR(bars)).toBeGreaterThan(0);
  });

  it('requires three consecutive bars above average cost to end drawdown', () => {
    const bars = [
      bar(0, 100),
      bar(day, 70),
      bar(day * 2, 120),
      bar(day * 3, 125),
      bar(day * 4, 130),
    ];

    const ttr = calculateMaxTTR(bars);
    expect(ttr).toBe(3);
    expect(TTR_RECOVERY_CONFIRM_BARS).toBe(3);
  });

  it('does not end drawdown after a brief one-bar recovery', () => {
    const bars = [
      bar(0, 100),
      bar(day, 70),
      bar(day * 2, 120),
      bar(day * 3, 60),
      bar(day * 10, 130),
      bar(day * 11, 135),
      bar(day * 12, 140),
    ];

    expect(calculateMaxTTR(bars)).toBe(11);
  });

  it('counts ongoing drawdown through the last bar', () => {
    const bars = [
      bar(0, 100),
      bar(day, 70),
      bar(day * 50, 65),
    ];

    expect(calculateMaxTTR(bars)).toBe(49);
  });

  it('reports current drawdown episode for gauge', () => {
    const day = 86_400;
    const bars = [
      bar(0, 100),
      bar(day, 70),
      bar(day * 20, 65),
    ];

    const status = evaluateDrawdownStatus(bars);
    expect(status?.inDrawdown).toBe(true);
    expect(status?.currentDrawdownDays).toBe(19);
    expect(status?.daysToMaxTTR).toBeGreaterThanOrEqual(0);
  });
});
