import { describe, expect, it } from 'vitest';
import { barsFromSeriesData, isChartUnavailablePage, normalizeTvSymbol, pickDisplaySymbol, symbolKey, symbolsEquivalent, type ChartProbeWindow } from './tv-chart-probe';
import { isHistoryUrl, parseHistoryResponse } from './tv-history';

describe('tv history', () => {
  it('detects history urls', () => {
    expect(isHistoryUrl('https://tvc4.tradingview.com/history?symbol=SP:SPX')).toBe(true);
    expect(isHistoryUrl('https://www.tradingview.com/chart/')).toBe(false);
  });

  it('parses udf history response', () => {
    const bars = parseHistoryResponse({
      s: 'ok',
      t: [1704067200, 1704153600],
      o: [100, 101],
      h: [102, 103],
      l: [99, 100],
      c: [101, 102],
    });

    expect(bars).toHaveLength(2);
    expect(bars?.[0].close).toBe(101);
  });
});

describe('tv chart probe', () => {
  it('normalizes internal auth symbol suffix', () => {
    expect(normalizeTvSymbol('SP_NAUTH:SPX')).toBe('SP:SPX');
  });

  it('treats exchange aliases as the same symbol', () => {
    expect(symbolsEquivalent('NASDAQ:AAPL', 'BATS:AAPL')).toBe(true);
    expect(symbolsEquivalent('SP:SPX', 'NASDAQ:AAPL')).toBe(false);
    expect(symbolKey('BATS:MSFT')).toBe('MSFT');
  });

  it('prefers live chart symbol over url symbol', () => {
    expect(pickDisplaySymbol('SP_NAUTH:SPX', 'NASDAQ:AAPL')).toBe('SP:SPX');
    expect(pickDisplaySymbol('NASDAQ:AAPL', 'SP:SPX')).toBe('NASDAQ:AAPL');
  });

  it('detects unavailable chart page', () => {
    const view = {
      document: { title: 'Chart Not Found — TradingView' },
    } as ChartProbeWindow;
    expect(isChartUnavailablePage(view)).toBe(true);
  });

  it('reads bars from series data', () => {
    const bars = barsFromSeriesData({
      size: () => 2,
      valueAt: (index) =>
        index === 0
          ? [1704067200, 100, 102, 99, 101, 1000]
          : [1704153600, 101, 103, 100, 102, 1100],
    });

    expect(bars).toHaveLength(2);
    expect(bars[1].close).toBe(102);
  });
});
