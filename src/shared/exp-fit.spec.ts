import { describe, expect, it } from 'vitest';
import { evaluateExponentialFit, buildExponentialFitLine } from './exp-fit';

describe('evaluateExponentialFit', () => {
  it('marks divergent end fit as unreliable', () => {
    const prices = [100, 105, 110, 115, 120, 500];
    const fit = evaluateExponentialFit(prices);
    expect(fit).not.toBeNull();
    expect(fit?.reliable).toBe(false);
    expect(fit?.rSquared).toBeLessThan(0.5);
  });

  it('accepts steady exponential growth', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 * Math.exp(0.01 * i));
    const fit = evaluateExponentialFit(prices);
    expect(fit?.reliable).toBe(true);
    expect(fit?.rSquared).toBeGreaterThan(0.9);
  });

  it('still returns fit line when unreliable', () => {
    const prices = [100, 105, 110, 115, 120, 500];
    const line = buildExponentialFitLine(prices);
    expect(line).not.toBeNull();
    expect(line?.fit.reliable).toBe(false);
    expect(line?.values.length).toBe(prices.length);
  });
});
