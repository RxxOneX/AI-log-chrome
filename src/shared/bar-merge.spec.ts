import { describe, expect, it } from 'vitest';
import {
  mergeBars,
  shouldAcceptBarReplace,
  shouldSendIncrementalUpdate,
} from './bar-merge';
import type { Bar } from './types';

function bar(time: number, close: number): Bar {
  return { time, open: close, high: close, low: close, close };
}

describe('bar merge', () => {
  it('merges bars by timestamp', () => {
    const merged = mergeBars([bar(1, 10), bar(2, 11)], [bar(2, 12), bar(3, 13)]);
    expect(merged).toHaveLength(3);
    expect(merged[1].close).toBe(12);
  });

  it('rejects replacing full history with a tiny snapshot', () => {
    const existing = Array.from({ length: 100 }, (_, i) => bar(i + 1, i));
    const incoming = [bar(1, 1), bar(2, 2)];

    expect(shouldAcceptBarReplace(existing, incoming, false)).toBe(false);
    expect(shouldAcceptBarReplace(existing, incoming, true)).toBe(true);
  });

  it('blocks incremental send until enough bars exist', () => {
    expect(shouldSendIncrementalUpdate(1)).toBe(false);
    expect(shouldSendIncrementalUpdate(2)).toBe(true);
    expect(shouldSendIncrementalUpdate(20)).toBe(true);
  });
});
