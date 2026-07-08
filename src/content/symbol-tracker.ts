import { normalizeTvSymbol, symbolsEquivalent, type SymbolSource } from '../shared/tv-chart-probe';
import { isValidTvSymbolFormat } from '../shared/tv-protocol';

type SourceMap = Record<SymbolSource, string | null>;

export class SymbolTracker {
  private sources: SourceMap = {
    chart: null,
    ws: null,
    dom: null,
    url: null,
  };

  private activeSource: SymbolSource | null = null;

  constructor(initialUrl: string | null) {
    this.sources.url = initialUrl;
  }

  set(source: SymbolSource, symbol: string | null) {
    const normalized = symbol ? normalizeTvSymbol(symbol) : null;
    if (normalized && !isValidTvSymbolFormat(normalized)) {
      this.sources[source] = null;
      return;
    }
    this.sources[source] = normalized;
  }

  get(): string | null {
    const order: SymbolSource[] = ['chart', 'dom', 'url'];
    for (const source of order) {
      const symbol = this.sources[source];
      if (symbol) {
        this.activeSource = source;
        return symbol;
      }
    }
    this.activeSource = null;
    return null;
  }

  getSource(): SymbolSource | null {
    this.get();
    return this.activeSource;
  }

  getSources(): Record<SymbolSource, string | null> {
    return { ...this.sources };
  }

  commit(source: SymbolSource, symbol: string | null): string | null {
    this.set(source, symbol);
    return this.get();
  }

  invalidateExcept(source: SymbolSource) {
    const keys = Object.keys(this.sources) as SymbolSource[];
    for (const key of keys) {
      if (key !== source) {
        this.sources[key] = null;
      }
    }
  }

  invalidateStaleSources(nextSymbol: string, preferredSource: SymbolSource) {
    const keys = Object.keys(this.sources) as SymbolSource[];
    for (const key of keys) {
      if (key === preferredSource) continue;
      const current = this.sources[key];
      if (current && !symbolsEquivalent(current, nextSymbol)) {
        this.sources[key] = null;
      }
    }
  }

  hasChanged(source: SymbolSource, symbol: string | null): boolean {
    const normalized = symbol ? normalizeTvSymbol(symbol) : null;
    return this.sources[source] !== normalized;
  }
}
