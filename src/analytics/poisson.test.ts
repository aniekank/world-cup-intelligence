import { describe, it, expect } from 'vitest';
import { predictMatch, expectedGoals, hostAdvantageFor } from './poisson';
import type { Team } from '@/domain/types';

const team = (id: string, name: string, code: string, atk: number, dfn: number): Team =>
  ({ id, name, code, attackRating: atk, defenseRating: dfn }) as Team;

const eng = team('eng', 'England', 'ENG', 87, 84);
const arg = team('arg', 'Argentina', 'ARG', 90, 86);
const usa = team('usa', 'United States', 'USA', 82, 80);

describe('neutral-venue match model (WC-087)', () => {
  it('fixture listing order carries no information — swapping home/away mirrors the prediction', () => {
    const ab = predictMatch(eng, arg);
    const ba = predictMatch(arg, eng);
    expect(ab.homeWin).toBeCloseTo(ba.awayWin, 10);
    expect(ab.awayWin).toBeCloseTo(ba.homeWin, 10);
    expect(ab.draw).toBeCloseTo(ba.draw, 10);
    expect(ab.expectedGoals.home).toBeCloseTo(ba.expectedGoals.away, 10);
  });

  it('the stronger side is favoured on a neutral pitch regardless of listing (the ENG-ARG incident)', () => {
    // As shipped pre-fix, England read 55/45 purely for being the nominal home
    // side; neutral maths favours Argentina from the same ratings.
    const p = predictMatch(eng, arg);
    expect(p.awayWin).toBeGreaterThan(p.homeWin);
  });

  it('a genuine host still gets the home bump and its opponent the travel penalty', () => {
    const neutral = expectedGoals(usa, arg, 'neutral');
    expect(expectedGoals(usa, arg, 'home')).toBeCloseTo(neutral * 1.12 / 1.0, 10);
    expect(expectedGoals(usa, arg, 'away')).toBeCloseTo(neutral * 0.94 / 1.0, 10);
    const hosted = predictMatch(usa, arg, 'home');
    const unhosted = predictMatch(usa, arg);
    expect(hosted.homeWin).toBeGreaterThan(unhosted.homeWin);
  });
});

describe('hostAdvantageFor (WC-087)', () => {
  const hosts = ['USA', 'Canada', 'Mexico'];
  const can = team('can', 'Canada', 'CAN', 80, 78);

  it('matches a host by code or name, on either side', () => {
    expect(hostAdvantageFor(usa, arg, hosts)).toBe('home');
    expect(hostAdvantageFor(arg, usa, hosts)).toBe('away');
    expect(hostAdvantageFor(can, eng, hosts)).toBe('home'); // by name
  });

  it('co-hosts facing each other cancel to neutral', () => {
    expect(hostAdvantageFor(usa, can, hosts)).toBe('none');
  });

  it('no hosts configured (historical editions) → always neutral', () => {
    expect(hostAdvantageFor(usa, arg, undefined)).toBe('none');
    expect(hostAdvantageFor(usa, arg, [])).toBe('none');
  });
});
