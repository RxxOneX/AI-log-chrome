import type { Bar } from './types';
import { buildCookieHeader, type TvSession } from './tv-auth';
import { parseHistoryResponse } from './tv-history';

const HISTORY_HOSTS = [
  'https://tvc4.tradingview.com',
  'https://prodata.tradingview.com',
];

export function buildHistoryUrl(
  host: string,
  symbol: string,
  resolution = '1D',
  countback = 500
): string {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 400 * 86_400;
  const params = new URLSearchParams({
    symbol,
    resolution,
    from: String(from),
    to: String(now),
    countback: String(countback),
  });

  return `${host}/history?${params.toString()}`;
}

export async function fetchHistoryBars(
  symbol: string,
  session: TvSession | null,
  referer: string
): Promise<Bar[] | null> {
  const headers: Record<string, string> = {
    Referer: referer,
  };

  if (session) {
    headers.Cookie = buildCookieHeader(session);
  }

  for (const host of HISTORY_HOSTS) {
    const url = buildHistoryUrl(host, symbol);
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers,
      });

      if (!response.ok) continue;

      const json: unknown = await response.json();
      const bars = parseHistoryResponse(json);
      if (bars && bars.length >= 2) {
        return bars;
      }
    } catch {
      // try next host
    }
  }

  return null;
}
