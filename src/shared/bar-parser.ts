export type TvSeriesItem = { v?: number[]; i?: number };

export function extractSeriesFromTvPayload(p: unknown): TvSeriesItem[] {
  const result: TvSeriesItem[] = [];
  if (!Array.isArray(p) || p.length < 2) return result;

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;

    const record = node as Record<string, unknown>;
    if (Array.isArray(record.s)) {
      for (const item of record.s) {
        if (item && typeof item === 'object') {
          result.push(item as TvSeriesItem);
        }
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value);
      }
    }
  }

  walk(p[1]);
  return result;
}
