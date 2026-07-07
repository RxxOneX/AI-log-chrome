export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatNumber(
  value: unknown,
  digits: number,
  fallback = '--'
): string {
  if (!isValidNumber(value)) return fallback;
  return value.toFixed(digits);
}

export function formatPercent(value: unknown, digits: number, fallback = '--'): string {
  if (!isValidNumber(value)) return fallback;
  return `${(value * 100).toFixed(digits)}%`;
}

export function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
