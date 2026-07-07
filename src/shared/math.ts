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

export function calculateMaxTTR(prices: number[]) {
  if (prices.length === 0) return 0;

  let maxTTR = 0;
  let peak = prices[0];
  let peakIndex = 0;
  let inDrawdown = false;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      if (inDrawdown) {
        const ttr = i - peakIndex;
        if (ttr > maxTTR) maxTTR = ttr;
        inDrawdown = false;
      }
      peak = prices[i];
      peakIndex = i;
    } else {
      inDrawdown = true;
    }
  }
  return maxTTR;
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
