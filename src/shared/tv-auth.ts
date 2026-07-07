export type TvSession = {
  sessionid: string;
  sessionid_sign?: string;
};

export const TV_AUTH_COOKIE_NAMES = ['sessionid', 'sessionid_sign'] as const;

export function buildCookieHeader(session: TvSession): string {
  const parts = [`sessionid=${session.sessionid}`];
  if (session.sessionid_sign) {
    parts.push(`sessionid_sign=${session.sessionid_sign}`);
  }
  return parts.join('; ');
}

export function sessionFromCookieMap(
  cookies: Record<string, string | undefined>
): TvSession | null {
  const sessionid = cookies.sessionid;
  if (!sessionid) return null;

  return {
    sessionid,
    sessionid_sign: cookies.sessionid_sign,
  };
}

export function sessionFromDocumentCookie(): TvSession | null {
  if (typeof document === 'undefined') return null;

  const map: Record<string, string> = {};
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    map[rawKey] = decodeURIComponent(rest.join('='));
  }

  return sessionFromCookieMap(map);
}

type ChartApiWindow = Window & {
  ChartApiInstance?: {
    sessionid?: string;
    connected?: () => boolean;
  };
};

export function readPageChartSession(view: ChartApiWindow): TvSession | null {
  try {
    const raw = view.ChartApiInstance?.sessionid;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { session_id?: string };
    if (!parsed.session_id) return null;

    return { sessionid: parsed.session_id };
  } catch {
    return null;
  }
}

export function mergeSessions(
  ...sessions: Array<TvSession | null | undefined>
): TvSession | null {
  let sessionid = '';
  let sessionid_sign: string | undefined;

  for (const session of sessions) {
    if (!session?.sessionid) continue;
    sessionid = session.sessionid;
    if (session.sessionid_sign) {
      sessionid_sign = session.sessionid_sign;
    }
  }

  return sessionid ? { sessionid, sessionid_sign } : null;
}
