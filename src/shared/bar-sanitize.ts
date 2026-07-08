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
    open > 0 &&
    typeof high === 'number' &&
    Number.isFinite(high) &&
    high > 0 &&
    typeof low === 'number' &&
    Number.isFinite(low) &&
    low > 0 &&
    typeof close === 'number' &&
    Number.isFinite(close) &&
    close > 0 &&
    high >= low &&
    high >= open &&
    high >= close &&
    low <= open &&
    low <= close
  );
}

export function sanitizeBars(bars: Bar[]): Bar[] {
  return bars.filter(isValidBar);
}
