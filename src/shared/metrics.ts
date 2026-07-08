import { areBarsCoherent } from './bar-coherence';
import { evaluateExponentialFit } from './exp-fit';
import {
  calculateMaxDrawdown,
  calculateMaxTTR,
  calculateReturns,
  calculateSharpeRatio,
  calculateSortinoRatio,
  evaluateDrawdownStatus,
} from './math';
import { finiteOrZero, isValidNumber } from './format-number';
import { isValidBar, sanitizeBars } from './bar-sanitize';
import type { AlertResult, AlertSettings, Bar, DateRange, Metrics } from './types';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function barToDateString(time: number): string {
  const date = new Date(time * 1000);
  return date.toISOString().slice(0, 10);
}

export function filterBarsByDateRange(bars: Bar[], start: string, end: string): Bar[] {
  if (!start || !end) return bars;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime() + 86_400_000 - 1;

  return bars.filter((bar) => {
    const t = bar.time * 1000;
    return t >= startMs && t <= endMs;
  });
}

export function filterBarsLastCalendarDays(bars: Bar[], lookbackDays: number): Bar[] {
  const valid = sanitizeBars(bars).sort((a, b) => a.time - b.time);
  if (valid.length === 0) return [];

  const endTime = valid[valid.length - 1].time;
  const startTime = endTime - lookbackDays * 86_400;
  return valid.filter((bar) => bar.time >= startTime);
}

export function defaultDateRange(bars: Bar[], windowDays = 180): DateRange {
  if (bars.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today };
  }

  const end = barToDateString(bars[bars.length - 1].time);
  const endIndex = Math.max(0, bars.length - 1);
  const startIndex = Math.max(0, endIndex - windowDays + 1);
  const start = barToDateString(bars[startIndex].time);

  return { start, end };
}

export function calculateCompositeScore(
  r2: number,
  sharpe: number,
  sortino: number,
  maxDrawdown: number
): number {
  const normSharpe = clamp(sharpe / 3, 0, 1);
  const normSortino = clamp(sortino / 3, 0, 1);
  const drawdownPenalty = clamp(1 - maxDrawdown, 0, 1);
  return (r2 * 0.4 + normSharpe * 0.25 + normSortino * 0.25 + drawdownPenalty * 0.1) * 100;
}

export function computeMetrics(bars: Bar[]): Metrics | null {
  const validBars = sanitizeBars(bars).sort((a, b) => a.time - b.time);
  if (validBars.length < 2 || !areBarsCoherent(validBars)) return null;

  const prices = validBars.map((b) => b.close);
  const returns = calculateReturns(prices);
  const sharpe = calculateSharpeRatio(returns);
  const sortino = calculateSortinoRatio(returns);
  const emptyDrawdown = {
    inDrawdown: false,
    currentDrawdownDays: 0,
    daysToMaxTTR: 0,
    exceededMaxTTRDays: 0,
    progressToMaxTTR: 0,
    recoveringStreak: 0,
  };

  const maxTTR = calculateMaxTTR(validBars);
  const drawdown = evaluateDrawdownStatus(validBars) ?? emptyDrawdown;
  const maxDrawdown = calculateMaxDrawdown(prices);

  const fit = evaluateExponentialFit(prices);
  const rSquared = fit?.rSquared ?? 0;
  const k = fit?.k ?? 0;
  const compositeScore = calculateCompositeScore(rSquared, sharpe, sortino, maxDrawdown);

  return {
    sharpe: finiteOrZero(sharpe),
    sortino: finiteOrZero(sortino),
    maxTTR: finiteOrZero(maxTTR),
    maxDrawdown: finiteOrZero(maxDrawdown),
    rSquared: finiteOrZero(rSquared),
    k: finiteOrZero(k),
    compositeScore: finiteOrZero(compositeScore),
    drawdown,
  };
}

export function calculateChangePct(bars: Bar[]): number {
  if (bars.length < 2) return 0;
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (first === 0) return 0;
  return (last - first) / first;
}

export function evaluateAlert(
  symbol: string,
  metrics: Metrics,
  peakTTR: number,
  settings: AlertSettings,
  isEligible: boolean
): AlertResult | null {
  if (!isEligible) return null;

  const compositeBreached = metrics.compositeScore < settings.compositeThreshold;
  const ttrBreached =
    settings.ttrNewExtremeEnabled && metrics.maxTTR > peakTTR && peakTTR > 0;

  if (!compositeBreached) return null;
  if (settings.ttrNewExtremeEnabled && !ttrBreached && peakTTR > 0) return null;

  return {
    symbol,
    compositeScore: metrics.compositeScore,
    maxTTR: metrics.maxTTR,
    peakTTR,
  };
}

export function barsToChartData(bars: Bar[]): { time: string; value: number }[] {
  return sanitizeBars(bars)
    .sort((a, b) => a.time - b.time)
    .map((bar) => ({
      time: barToDateString(bar.time),
      value: bar.close,
    }))
    .filter((point) => isValidNumber(point.value));
}
