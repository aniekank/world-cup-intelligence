import { describe, it, expect } from 'vitest';
import { mapStage } from './sportmonks';

// Locks the stage mapping to SportMonks' real WC2026 stage names (verified
// against the live feed: "Group Stage", "Round of 32", "Round of 16",
// "Quarter-finals", "Semi-finals", "3rd Place Final", "Final"). The bare-"final"
// fallback must not swallow the quarter/semi/third rounds. (WC-032)
describe('mapStage — SportMonks stage name → MatchStage', () => {
  it('maps every real WC2026 stage name', () => {
    expect(mapStage('Group Stage')).toBe('GROUP');
    expect(mapStage('Round of 32')).toBe('R32');
    expect(mapStage('Round of 16')).toBe('R16');
    expect(mapStage('Quarter-finals')).toBe('QF');
    expect(mapStage('Semi-finals')).toBe('SF');
    expect(mapStage('3rd Place Final')).toBe('THIRD_PLACE');
    expect(mapStage('Final')).toBe('FINAL');
  });

  it('does not let "Quarter/Semi/3rd Place Final" fall through to FINAL', () => {
    // All three contain "final" — order of checks matters.
    expect(mapStage('Quarter-finals')).not.toBe('FINAL');
    expect(mapStage('Semi-finals')).not.toBe('FINAL');
    expect(mapStage('3rd Place Final')).not.toBe('FINAL');
  });

  it('defaults unknown / missing names to GROUP', () => {
    expect(mapStage(undefined)).toBe('GROUP');
    expect(mapStage('')).toBe('GROUP');
    expect(mapStage('Some New Phase')).toBe('GROUP');
  });
});
