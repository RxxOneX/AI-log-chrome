import type { Bar } from './types';
import { isValidBar, sanitizeBars } from './bar-sanitize';

const MAX_SINGLE_BAR_JUMP = 8;

export function areBarsCoherent(bars: Bar[]): boolean {
  const valid = sanitizeBars(bars).sort((a, b) => a.time - b.time);
  if (valid.length < 2) return false;

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1].close;
    const next = valid[i].close;
    if (prev <= 0 || next <= 0) return false;
    const ratio = next / prev;
    if (ratio > MAX_SINGLE_BAR_JUMP || ratio < 1 / MAX_SINGLE_BAR_JUMP) {
      return false;
    }
  }

  return true;
}
