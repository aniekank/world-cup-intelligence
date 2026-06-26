import { describe, it, expect, beforeEach } from 'vitest';
import { generateDataset } from '@/data/generate';
import { setDataset, getPlayerView, getPlayers, getTeam, getPlayer } from '@/data/store';

describe('store indexes never go null (WC-044)', () => {
  it('lookups survive re-setting the active snapshot (which invalidates the indexes)', () => {
    const snap = generateDataset();
    setDataset(snap, 'test', 'simulation');
    const teamId = snap.teams[0]!.id;
    const playerId = snap.players[0]!.id;
    expect(getTeam(teamId)).toBeDefined(); // builds the indexes
    // Re-set the SAME snapshot object — nulls the indexes while the snapshot
    // identity is unchanged: the exact state that used to leave teamIndex() = null!
    setDataset(snap, 'test', 'simulation');
    expect(() => getTeam(teamId)).not.toThrow();
    expect(() => getPlayer(playerId)).not.toThrow();
    expect(getTeam(teamId)).toBeDefined();
    expect(getPlayer(playerId)).toBeDefined();
  });
});

describe('getPlayerView', () => {
  beforeEach(() => setDataset(generateDataset(), 'simulation', 'simulation'));

  it('returns a populated view for every player in the store', () => {
    for (const p of getPlayers().slice(0, 60)) {
      const v = getPlayerView(p.id);
      expect(v).toBeDefined();
      expect(v!.team.code).toBeTruthy();
      expect(v!.name).toBe(p.name);
    }
  });

  it('returns undefined for an unknown player id', () => {
    expect(getPlayerView('no-such-player-xyz')).toBeUndefined();
  });

  // WC-025 regression: a real player whose team is momentarily unresolved (a
  // snapshot mid-swap, or a cross-index gap) must still return a view with a
  // fallback team — NOT undefined, which on /players/[id] became notFound() and
  // rendered an empty page. Reproduced here by dropping the player's team from
  // the snapshot while keeping the player.
  it('still returns a view when the player exists but its team is unresolved', () => {
    const ds = generateDataset();
    const victimTeam = ds.teams[0]!.id;
    const orphan = ds.players.find((p) => p.teamId === victimTeam)!;
    setDataset({ ...ds, teams: ds.teams.filter((t) => t.id !== victimTeam) }, 'simulation', 'simulation');

    const v = getPlayerView(orphan.id);
    expect(v).toBeDefined();
    expect(v!.name).toBe(orphan.name);
    expect(v!.team.id).toBe(victimTeam); // fallback team derived from the player's teamId
    expect(v!.team.code).toBeTruthy();
  });
});
