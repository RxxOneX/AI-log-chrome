export type TvPayload = {
  m?: string;
  p?: unknown[];
};

export function parseTvFrames(data: string): TvPayload[] {
  const payloads: TvPayload[] = [];
  const parts = data.split('~m~');

  for (let i = 1; i < parts.length; i += 2) {
    const jsonStr = parts[i + 1];
    if (!jsonStr || jsonStr.startsWith('~h~')) continue;

    try {
      payloads.push(JSON.parse(jsonStr) as TvPayload);
    } catch {
      // ignore non-JSON frames
    }
  }

  return payloads;
}

function parseSymbolDescriptor(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('=')) return null;

  try {
    const parsed = JSON.parse(value.slice(1)) as { symbol?: string };
    return typeof parsed.symbol === 'string' && parsed.symbol.length > 0
      ? parsed.symbol
      : null;
  } catch {
    return null;
  }
}

function parseSymbolInfo(info: unknown): string | null {
  if (!info || typeof info !== 'object') return null;

  const record = info as Record<string, unknown>;
  const candidates = [record.pro_name, record.name, record.full_name, record.symbol];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

export function extractSymbolFromPayload(payload: TvPayload): string | null {
  const method = payload.m;
  const params = payload.p;
  if (!method || !Array.isArray(params)) return null;

  switch (method) {
    case 'symbol_resolved':
      return parseSymbolInfo(params[2]);

    case 'resolve_symbol':
      return parseSymbolDescriptor(params[2]);

    case 'quote_add_symbols': {
      const symbol = params[1];
      if (typeof symbol === 'string' && isLikelySymbol(symbol)) {
        return parseSymbolDescriptor(symbol) ?? symbol;
      }
      return null;
    }

    case 'qsd': {
      const data = params[1];
      if (!data || typeof data !== 'object') return null;
      const record = data as Record<string, unknown>;
      const nested = record.n;
      if (typeof nested === 'string' && isLikelySymbol(nested)) return nested;
      return parseSymbolInfo(record);
    }

    default:
      return null;
  }
}

export function extractSymbolFromUrl(url: string): string | null {
  try {
    const value = new URL(url).searchParams.get('symbol');
    if (!value) return null;

    const decoded = decodeURIComponent(value).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export function extractSymbolFromTitle(title: string): string | null {
  const match = title.match(/^(.+?)\s+[·•\-–—|]/);
  if (match?.[1]) {
    const value = match[1].trim();
    if (value && !value.toLowerCase().includes('tradingview')) return value;
  }

  const beforeDash = title.split(/\s+[-—]\s+/)[0]?.trim();
  if (beforeDash && !beforeDash.toLowerCase().includes('tradingview')) {
    return beforeDash;
  }

  const first = title.split(' ')[0]?.trim();
  if (first && !first.toLowerCase().includes('tradingview')) {
    return first;
  }

  return null;
}

function isLikelySymbol(value: string): boolean {
  if (!value || value.startsWith('=') || value.length > 64) return false;
  if (value.toLowerCase().includes('tradingview')) return false;
  return true;
}

export function extractSymbolFromFrames(data: string): string | null {
  for (const payload of parseTvFrames(data)) {
    const symbol = extractSymbolFromPayload(payload);
    if (symbol) return symbol;
  }
  return null;
}
