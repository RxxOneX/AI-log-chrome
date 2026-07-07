import type { Bar } from '../shared/types';

export class BarStore {
  private bars = new Map<number, Bar>();
  private symbol: string | null = null;

  setSymbol(symbol: string | null) {
    if (symbol !== this.symbol) {
      this.symbol = symbol;
      this.bars.clear();
    }
  }

  getSymbol(): string | null {
    return this.symbol;
  }

  ingestSeries(series: Array<{ v?: number[] }>) {
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
      this.bars.set(time, { time, open, high, low, close });
    }
  }

  getBars(): Bar[] {
    return Array.from(this.bars.values()).sort((a, b) => a.time - b.time);
  }

  clear() {
    this.bars.clear();
  }
}
