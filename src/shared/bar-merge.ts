import type { Bar } from './types';
import { isValidBar } from './bar-sanitize';

export const MIN_USABLE_BARS = 20;

export function mergeBars(existing: Bar[], incoming: Bar[]): Bar[] {
  const map = new Map<number, Bar>();
  for (const bar of existing) {
    if (isValidBar(bar)) map.set(bar.time, bar);
  }
  for (const bar of incoming) {
    if (isValidBar(bar)) map.set(bar.time, bar);
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export function shouldAcceptBarReplace(
  existing: Bar[],
  incoming: Bar[],
  symbolChanged: boolean
): boolean {
  if (incoming.length < 2) return false;
  if (symbolChanged) return true;
  if (existing.length < 2) return true;
  if (incoming.length >= existing.length) return true;

  const existingLast = existing[existing.length - 1]?.time ?? 0;
  const incomingLast = incoming[incoming.length - 1]?.time ?? 0;

  return incomingLast > existingLast && incoming.length >= existing.length * 0.5;
}

export function shouldSendIncrementalUpdate(existingCount: number): boolean {
  return existingCount >= 2;
}
