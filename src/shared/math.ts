import type { Bar, DrawdownGaugeState } from './types';

export function calculateReturns(prices: number[]) {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

export function calculateSharpeRatio(returns: number[], riskFreeRate = 0) {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return ((mean - riskFreeRate) / stdDev) * Math.sqrt(252);
}

export function calculateSortinoRatio(returns: number[], riskFreeRate = 0) {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  const negativeReturns = returns.filter((r) => r < riskFreeRate);
  const downsideVariance =
    negativeReturns.length > 0
      ? negativeReturns.reduce((a, b) => a + Math.pow(b - riskFreeRate, 2), 0) / returns.length
      : 0;

  const downsideStdDev = Math.sqrt(downsideVariance);

  if (downsideStdDev === 0) return 0;
  return ((mean - riskFreeRate) / downsideStdDev) * Math.sqrt(252);
}

const SECONDS_PER_DAY = 86_400;
export const TTR_RECOVERY_CONFIRM_BARS = 3;
export const DCA_LOOKBACK_DAYS = 730;

function daysBetween(startTime: number, endTime: number): number {
  if (endTime <= startTime) return 0;
  return Math.round((endTime - startTime) / SECONDS_PER_DAY);
}

type DcaState = {
  shares: number;
  invested: number;
  avgCost: number;
};

function dcaStateAt(bars: Bar[], index: number): DcaState | null {
  let shares = 0;
  let invested = 0;

  for (let i = 0; i <= index; i++) {
    const close = bars[i].close;
    if (close <= 0) return null;
    shares += 1 / close;
    invested += 1;
  }

  return {
    shares,
    invested,
    avgCost: invested / shares,
  };
}

function isFloatingLoss(state: DcaState, close: number): boolean {
  return close < state.avgCost;
}

function isFloatingProfit(state: DcaState, close: number): boolean {
  return close > state.avgCost;
}

type DcaDrawdownScan = {
  maxTTR: number;
  inDrawdown: boolean;
  currentDrawdownDays: number;
  recoveringStreak: number;
};

function scanDcaDrawdown(bars: Bar[]): DcaDrawdownScan | null {
  if (bars.length < 2) return null;

  const sorted = [...bars].sort((a, b) => a.time - b.time);
  let maxTTR = 0;
  let inEpisode = false;
  let episodeStart = -1;
  let consecutiveProfit = 0;

  for (let i = 0; i < sorted.length; i++) {
    const state = dcaStateAt(sorted, i);
    if (!state) return null;

    const close = sorted[i].close;
    const loss = isFloatingLoss(state, close);
    const profit = isFloatingProfit(state, close);

    if (inEpisode) {
      if (profit) {
        consecutiveProfit += 1;
        if (consecutiveProfit >= TTR_RECOVERY_CONFIRM_BARS) {
          const ttr = daysBetween(sorted[episodeStart].time, sorted[i].time);
          if (ttr > maxTTR) maxTTR = ttr;
          inEpisode = false;
          episodeStart = -1;
          consecutiveProfit = 0;
        }
      } else {
        consecutiveProfit = 0;
      }
    }

    if (!inEpisode && loss) {
      inEpisode = true;
      episodeStart = i;
      consecutiveProfit = 0;
    }
  }

  if (inEpisode && episodeStart >= 0) {
    const last = sorted.length - 1;
    const ttr = daysBetween(sorted[episodeStart].time, sorted[last].time);
    if (ttr > maxTTR) maxTTR = ttr;
  }

  const last = sorted.length - 1;
  const currentDrawdownDays =
    inEpisode && episodeStart >= 0
      ? daysBetween(sorted[episodeStart].time, sorted[last].time)
      : 0;

  return {
    maxTTR,
    inDrawdown: inEpisode,
    currentDrawdownDays,
    recoveringStreak: inEpisode ? consecutiveProfit : 0,
  };
}

export function evaluateDrawdownStatus(bars: Bar[]): DrawdownGaugeState | null {
  const scan = scanDcaDrawdown(bars);
  if (!scan) return null;

  const progressToMaxTTR =
    scan.maxTTR > 0 ? Math.min(1, scan.currentDrawdownDays / scan.maxTTR) : 0;

  return {
    inDrawdown: scan.inDrawdown,
    currentDrawdownDays: scan.currentDrawdownDays,
    daysToMaxTTR: scan.inDrawdown ? Math.max(0, scan.maxTTR - scan.currentDrawdownDays) : 0,
    exceededMaxTTRDays:
      scan.inDrawdown ? Math.max(0, scan.currentDrawdownDays - scan.maxTTR) : 0,
    progressToMaxTTR,
    recoveringStreak: scan.recoveringStreak,
  };
}

export function calculateMaxTTR(bars: Bar[]): number {
  return scanDcaDrawdown(bars)?.maxTTR ?? 0;
}

export function calculateMaxDrawdown(prices: number[]) {
  if (prices.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = prices[0];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    } else {
      const drawdown = (peak - prices[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  return maxDrawdown;
}

export function calculateExponentialFit(data: { x: number; y: number }[]) {
  if (data.length < 2) return null;

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = data[i].x;
    const y = Math.log(data[i].y);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const k = (n * sumXY - sumX * sumY) / denominator;
  const lnA = (sumY - k * sumX) / n;
  const a = Math.exp(lnA);

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const actualY = Math.log(data[i].y);
    const predictedY = lnA + k * data[i].x;
    ssTot += Math.pow(actualY - meanY, 2);
    ssRes += Math.pow(actualY - predictedY, 2);
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { a, k, rSquared };
}
