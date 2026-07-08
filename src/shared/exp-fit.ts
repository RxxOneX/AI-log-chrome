import { calculateExponentialFit } from './math';

export type ExponentialFitResult = {
  a: number;
  k: number;
  rSquared: number;
  reliable: boolean;
  endRelativeError: number;
};

const MAX_DAILY_GROWTH = 0.08;
const MAX_END_RELATIVE_ERROR = 0.15;

export function evaluateExponentialFit(prices: number[]): ExponentialFitResult | null {
  if (prices.length < 2) return null;

  const fitData = prices.map((y, x) => ({ x, y }));
  const fit = calculateExponentialFit(fitData);
  if (!fit) return null;

  const lastIndex = prices.length - 1;
  const predicted = fit.a * Math.exp(fit.k * lastIndex);
  const actual = prices[lastIndex];
  const endRelativeError =
    actual > 0 ? Math.abs(predicted - actual) / actual : Number.POSITIVE_INFINITY;

  let adjustedR2 = fit.rSquared;
  if (endRelativeError > MAX_END_RELATIVE_ERROR) {
    adjustedR2 *= Math.max(0, 1 - endRelativeError);
  }
  if (fit.k > MAX_DAILY_GROWTH) {
    adjustedR2 *= 0.5;
  }

  const reliable =
    endRelativeError <= MAX_END_RELATIVE_ERROR && fit.k <= MAX_DAILY_GROWTH && adjustedR2 >= 0;

  return {
    a: fit.a,
    k: fit.k,
    rSquared: Math.max(0, Math.min(1, adjustedR2)),
    reliable,
    endRelativeError,
  };
}

export function buildExponentialFitLine(
  prices: number[]
): { values: number[]; fit: ExponentialFitResult } | null {
  const fit = evaluateExponentialFit(prices);
  if (!fit) return null;

  const values = prices.map((_, i) => fit.a * Math.exp(fit.k * i));
  return { values, fit };
}
