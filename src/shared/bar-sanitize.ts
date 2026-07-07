import type { Bar } from './types';

export function isValidBar(bar: Partial<Bar> | null | undefined): bar is Bar {
  if (!bar) return false;
  const { time, open, high, low, close } = bar;
  return (
    typeof time === 'number' &&
    Number.isFinite(time) &&
    time > 0 &&
    typeof open === 'number' &&
    Number.isFinite(open) &&
    typeof high === 'number' &&
    Number.isFinite(high) &&
    typeof low === 'number' &&
    Number.isFinite(low) &&
    typeof close === 'number' &&
    Number.isFinite(close)
  );
}

export function sanitizeBars(bars: Bar[]): Bar[] {
  return bars.filter(isValidBar);
}
