import { describe, it, expect } from 'vitest';
import { runningMinute } from './matchClock';

const T = 1_000_000_000_000; // fixed anchor

describe('runningMinute', () => {
  it('shows the sampled minute with no elapsed time (matches SSR)', () => {
    expect(runningMinute(42, 'LIVE', T, T)).toBe('42′');
  });
  it('advances locally between feed samples', () => {
    expect(runningMinute(42, 'LIVE', T, T + 125_000)).toBe('44′'); // +2 min
  });
  it('caps drift at +5 when refreshes stall', () => {
    expect(runningMinute(42, 'LIVE', T, T + 30 * 60_000)).toBe('47′');
  });
  it('freezes at the break', () => {
    expect(runningMinute(45, 'HALFTIME', T, T + 99_999)).toBe('HT');
  });
  it('shows the static minute when the match is not in play', () => {
    expect(runningMinute(90, 'FINISHED', T, T + 5 * 60_000)).toBe('90′');
  });
  it('falls back to the sampled minute on an unparseable anchor', () => {
    expect(runningMinute(12, 'LIVE', NaN, T)).toBe('12′');
  });
});
