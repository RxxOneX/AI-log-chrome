import {
  mergeSessions,
  sessionFromCookieMap,
  type TvSession,
  TV_AUTH_COOKIE_NAMES,
} from '../shared/tv-auth';

export async function readTvSessionFromCookies(): Promise<TvSession | null> {
  const cookies = await chrome.cookies.getAll({ domain: '.tradingview.com' });
  const map: Record<string, string | undefined> = {};

  for (const name of TV_AUTH_COOKIE_NAMES) {
    const match = cookies.find((cookie) => cookie.name === name);
    if (match?.value) {
      map[name] = match.value;
    }
  }

  return sessionFromCookieMap(map);
}

export async function readTvSessionForUrl(pageUrl?: string): Promise<TvSession | null> {
  const fromDomain = await readTvSessionFromCookies();
  if (fromDomain) return fromDomain;

  if (!pageUrl) return null;

  try {
    const host = new URL(pageUrl).hostname;
    const cookies = await chrome.cookies.getAll({ url: `https://${host}/` });
    const map: Record<string, string | undefined> = {};

    for (const name of TV_AUTH_COOKIE_NAMES) {
      const match = cookies.find((cookie) => cookie.name === name);
      if (match?.value) {
        map[name] = match.value;
      }
    }

    return sessionFromCookieMap(map);
  } catch {
    return null;
  }
}

export async function isTvLoggedIn(pageUrl?: string): Promise<boolean> {
  const session = await readTvSessionForUrl(pageUrl);
  return Boolean(session?.sessionid);
}
