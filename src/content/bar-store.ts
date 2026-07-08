import type { Bar } from '../shared/types';
import { isValidBar } from '../shared/bar-sanitize';
import { symbolsEquivalent } from '../shared/tv-chart-probe';
import { mergeBars, MIN_USABLE_BARS, shouldAcceptBarReplace } from '../shared/bar-merge';
import { isSameSeriesSignature, seriesSignature } from '../shared/series-signature';

export class BarStore {
  private bars = new Map<number, Bar>();
  private symbol: string | null = null;
  private snapshotLoaded = false;
  private staleSeriesSignature: string | null = null;

  setSymbol(symbol: string | null) {
    const normalized = symbol?.trim() || null;
    if (symbolsEquivalent(normalized, this.symbol)) {
      this.symbol = normalized;
      return;
    }

    const existing = this.getBars();
    if (existing.length >= 2) {
      this.staleSeriesSignature = seriesSignature(existing);
    } else {
      this.staleSeriesSignature = null;
    }

    this.symbol = normalized;
    this.bars.clear();
    this.snapshotLoaded = false;
  }

  isStaleSeries(bars: Bar[]): boolean {
    if (!this.staleSeriesSignature || bars.length < 2) return false;
    return isSameSeriesSignature(seriesSignature(bars), this.staleSeriesSignature);
  }

  clearStaleSeriesSignature() {
    this.staleSeriesSignature = null;
  }

  getSymbol(): string | null {
    return this.symbol;
  }

  hasSnapshot(): boolean {
    return this.snapshotLoaded;
  }

  count(): number {
    return this.bars.size;
  }

  ingestSeries(series: Array<{ v?: number[] }>) {
    if (this.snapshotLoaded) return false;

    let changed = false;
    for (const item of series) {
      if (!item.v || item.v.length < 5) continue;
      const [time, open, high, low, close] = item.v;
      if (
        typeof time !== 'number' ||
        typeof open !== 'number' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof close !== 'number'
      ) {
        continue;
      }

      const bar = { time, open, high, low, close };
      if (!isValidBar(bar)) continue;
      this.bars.set(time, bar);
      changed = true;
    }
    return changed;
  }

  replaceBars(bars: Bar[], symbolChanged = false) {
    const existing = this.getBars();
    if (!shouldAcceptBarReplace(existing, bars, symbolChanged)) return false;

    this.bars.clear();
    for (const bar of bars) {
      if (!isValidBar(bar)) continue;
      this.bars.set(bar.time, bar);
    }
    this.snapshotLoaded = bars.length >= MIN_USABLE_BARS;
    this.staleSeriesSignature = null;
    return true;
  }

  mergeBars(bars: Bar[]) {
    if (bars.length === 0) return false;

    const merged = mergeBars(this.getBars(), bars);
    if (merged.length < this.bars.size) return false;

    this.bars.clear();
    for (const bar of merged) {
      this.bars.set(bar.time, bar);
    }

    if (merged.length >= MIN_USABLE_BARS) {
      this.snapshotLoaded = true;
    }
    return true;
  }

  getBars(): Bar[] {
    return Array.from(this.bars.values()).sort((a, b) => a.time - b.time);
  }

  clear() {
    this.bars.clear();
    this.snapshotLoaded = false;
    this.staleSeriesSignature = null;
  }
}
