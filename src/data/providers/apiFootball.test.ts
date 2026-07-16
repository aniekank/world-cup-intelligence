import { describe, it, expect } from 'vitest';
import { mapStage } from './apiFootball';

describe('mapStage (WC-088)', () => {
  it('classifies "3rd Place Final" as THIRD_PLACE, never FINAL', () => {
    // The production incident: the consolation game classified as a second FINAL,
    // which would crown its winner world champion in the forecast reconciler.
    expect(mapStage('3rd Place Final')).toBe('THIRD_PLACE');
    expect(mapStage('Third place play-off')).toBe('THIRD_PLACE');
  });

  it('keeps every other round correct', () => {
    expect(mapStage('Final')).toBe('FINAL');
    expect(mapStage('Semi-finals')).toBe('SF');
    expect(mapStage('Quarter-finals')).toBe('QF');
    expect(mapStage('Round of 16')).toBe('R16');
    expect(mapStage('Round of 32')).toBe('R32');
    expect(mapStage('Group Stage - 1')).toBe('GROUP');
  });
});
