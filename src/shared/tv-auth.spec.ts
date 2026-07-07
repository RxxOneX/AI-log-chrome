import { describe, expect, it } from 'vitest';
import { buildCookieHeader, mergeSessions, sessionFromCookieMap } from './tv-auth';
import { buildHistoryUrl } from './tv-history-fetch';

describe('tv auth', () => {
  it('builds cookie header', () => {
    expect(
      buildCookieHeader({ sessionid: 'abc', sessionid_sign: 'sign' })
    ).toBe('sessionid=abc; sessionid_sign=sign');
  });

  it('merges sessions with sign from extension cookies', () => {
    const merged = mergeSessions(
      { sessionid: 'from-page' },
      { sessionid: 'from-page', sessionid_sign: 'sign' }
    );
    expect(merged?.sessionid_sign).toBe('sign');
  });

  it('reads session from cookie map', () => {
    expect(sessionFromCookieMap({ sessionid: 'abc' })?.sessionid).toBe('abc');
  });
});

describe('tv history fetch', () => {
  it('builds history url', () => {
    const url = buildHistoryUrl('https://tvc4.tradingview.com', 'NASDAQ:AAPL');
    expect(url).toContain('symbol=NASDAQ%3AAAPL');
    expect(url).toContain('resolution=1D');
  });
});
