import { describe, expect, it } from 'vitest';
import { SymbolTracker } from './symbol-tracker';

describe('symbol tracker', () => {
  it('prefers chart symbol over url symbol', () => {
    const tracker = new SymbolTracker('SP:SPX');
    tracker.commit('url', 'SP:SPX');
    tracker.commit('chart', 'NASDAQ:AAPL');

    expect(tracker.get()).toBe('NASDAQ:AAPL');
    expect(tracker.getSource()).toBe('chart');
  });

  it('falls back to url when chart is unavailable', () => {
    const tracker = new SymbolTracker('SP:SPX');
    expect(tracker.get()).toBe('SP:SPX');
  });

  it('detects source changes', () => {
    const tracker = new SymbolTracker(null);
    tracker.commit('chart', 'SP:SPX');
    expect(tracker.hasChanged('chart', 'NASDAQ:AAPL')).toBe(true);
    expect(tracker.hasChanged('chart', 'SP:SPX')).toBe(false);
  });
});
