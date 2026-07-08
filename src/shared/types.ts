export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SymbolBars = {
  symbol: string;
  bars: Bar[];
  lastUpdatedAt: number;
};

export type DrawdownGaugeState = {
  inDrawdown: boolean;
  currentDrawdownDays: number;
  daysToMaxTTR: number;
  exceededMaxTTRDays: number;
  progressToMaxTTR: number;
  recoveringStreak: number;
};

export type Metrics = {
  sharpe: number;
  sortino: number;
  maxTTR: number;
  maxDrawdown: number;
  rSquared: number;
  k: number;
  compositeScore: number;
  drawdown: DrawdownGaugeState;
};

export type WatchlistItem = {
  symbol: string;
  monitoring: boolean;
  cachedMetrics?: Metrics;
  changePct?: number;
  updatedAt?: number;
};

export type AlertSettings = {
  compositeThreshold: number;
  ttrNewExtremeEnabled: boolean;
  alertScope: 'current_symbol' | 'monitored_only';
};

export type AppSettings = {
  language: 'zh' | 'en';
  defaultWindowDays: number;
  showExpFit: boolean;
  alert: AlertSettings;
};

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'stale'
  | 'no_data'
  | 'symbol_unknown';

export type AlertResult = {
  symbol: string;
  compositeScore: number;
  maxTTR: number;
  peakTTR: number;
};

export type MetricsCacheEntry = {
  metrics: Metrics;
  changePct: number;
  updatedAt: number;
};

export type DateRange = {
  start: string;
  end: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh',
  defaultWindowDays: 180,
  showExpFit: true,
  alert: {
    compositeThreshold: 72,
    ttrNewExtremeEnabled: true,
    alertScope: 'current_symbol',
  },
};

export const STALE_THRESHOLD_MS = 30_000;
