import { describe, expect, it } from 'vitest';
import { seriesSignature } from './series-signature';
import type { Bar } from './types';

function bar(time: number, close: number): Bar {
  return { time, open: close, high: close, low: close, close };
}

describe('seriesSignature', () => {
  it('changes when bar series updates', () => {
    const before = [bar(1, 100), bar(2, 101)];
    const after = [bar(1, 100), bar(2, 150)];
    expect(seriesSignature(before)).not.toBe(seriesSignature(after));
  });
});
