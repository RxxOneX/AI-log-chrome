import { describe, expect, it } from 'vitest';
import { extractBarPayloadsFromFrames, countMessageTypes, isBarPayload } from './bar-messages';
import { extractSeriesFromTvPayload } from './bar-parser';
import { extractSymbolFromFrames, extractChartSymbolFromFrames, isValidTvSymbolFormat, parseTvFrames } from './tv-protocol';

const DU_FRAME = String.raw`~m~140~m~{"m":"du","p":["cs_test",{"sds_1":{"s":[{"i":0,"v":[1720000000,192.5,193,191.8,192.75,54320000]}]}}]}`;

const TIMESCALE_FRAME = String.raw`~m~180~m~{"m":"timescale_update","p":["cs_test",{"btc_1":{"s":[{"i":0,"v":[1643468400,37620.04,37735.67,37268.44,37566.82,1881.67]}]}}]}`;

const SYMBOL_FRAME = String.raw`~m~90~m~{"m":"symbol_resolved","p":["cs_test","s1",{"name":"SP:SPX","pro_name":"SP:SPX"}]}`;

const HEARTBEAT_FRAME = '~m~5~m~~h~42';
const MULTI_FRAME = `${HEARTBEAT_FRAME}${DU_FRAME}`;

describe('tv frame parsing', () => {
  it('parses du frame', () => {
    const payloads = parseTvFrames(DU_FRAME);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].m).toBe('du');
  });

  it('skips heartbeat in multi frame', () => {
    const payloads = parseTvFrames(MULTI_FRAME);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].m).toBe('du');
  });
});

describe('bar extraction', () => {
  it('extracts OHLCV from du', () => {
    const bars = extractSeriesFromTvPayload(parseTvFrames(DU_FRAME)[0].p);
    expect(bars).toHaveLength(1);
    expect(bars[0].v?.[4]).toBe(192.75);
  });

  it('extracts OHLCV from timescale_update', () => {
    const bars = extractSeriesFromTvPayload(parseTvFrames(TIMESCALE_FRAME)[0].p);
    expect(bars).toHaveLength(1);
    expect(bars[0].v?.[1]).toBe(37620.04);
  });

  it('flags bar payloads by series content', () => {
    expect(isBarPayload(parseTvFrames(DU_FRAME)[0])).toBe(true);
    expect(isBarPayload(parseTvFrames(SYMBOL_FRAME)[0])).toBe(false);
  });

  it('collects bar payloads from mixed frame', () => {
    const payloads = extractBarPayloadsFromFrames(MULTI_FRAME);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].m).toBe('du');
  });
});

describe('symbol extraction', () => {
  it('reads symbol_resolved', () => {
    expect(extractSymbolFromFrames(SYMBOL_FRAME)).toBe('SP:SPX');
    expect(extractChartSymbolFromFrames(SYMBOL_FRAME)).toBe('SP:SPX');
  });

  it('ignores quote_add_symbols for chart symbol extraction', () => {
    const quoteFrame = String.raw`~m~80~m~{"m":"quote_add_symbols","p":["qs_test","BITSTAMP:BTCUSD"]}`;
    expect(extractSymbolFromFrames(quoteFrame)).toBe('BITSTAMP:BTCUSD');
    expect(extractChartSymbolFromFrames(quoteFrame)).toBeNull();
  });

  it('rejects price labels as symbols', () => {
    expect(isValidTvSymbolFormat('BATS:AU')).toBe(true);
    expect(isValidTvSymbolFormat('AU 82.08 ▼ −2.34% 超级趋势')).toBe(false);
    expect(isValidTvSymbolFormat('BITSTAMP:BTCUSD')).toBe(true);
  });
});

describe('message type counting', () => {
  it('counts du only once in multi frame', () => {
    expect(countMessageTypes(MULTI_FRAME)).toEqual({ du: 1 });
  });
});
