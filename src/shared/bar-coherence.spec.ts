import { describe, expect, it } from 'vitest';
import { areBarsCoherent } from './bar-coherence';
import type { Bar } from './types';

function bar(time: number, close: number): Bar {
  return { time, open: close, high: close, low: close, close };
}

describe('areBarsCoherent', () => {
  it('accepts smooth price series', () => {
    const bars = Array.from({ length: 10 }, (_, i) => bar(1_700_000_000 + i * 86_400, 100 + i));
    expect(areBarsCoherent(bars)).toBe(true);
  });

  it('rejects mixed-scale jumps', () => {
    const bars = [
      bar(1, 100),
      bar(2, 105),
      bar(3, 10_000),
      bar(4, 10_500),
    ];
    expect(areBarsCoherent(bars)).toBe(false);
  });

  it('allows gradual long-term growth', () => {
    const bars = [bar(1, 10), bar(2, 12), bar(3, 15), bar(4, 18)];
    expect(areBarsCoherent(bars)).toBe(true);
  });
});
