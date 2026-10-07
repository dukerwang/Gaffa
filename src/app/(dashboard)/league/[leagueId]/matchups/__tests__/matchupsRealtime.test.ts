import { describe, it, expect } from 'vitest';
import type { Matchup } from '@/types';

// Helper simulating MatchupsClient's live score overlay logic
function applyLiveScores(
  matchups: Matchup[],
  liveScores: Record<string, { score_a: number; score_b: number; status?: string }>,
): Matchup[] {
  return matchups.map((m) => {
    const live = liveScores[m.id];
    if (!live) return m;
    return {
      ...m,
      score_a: live.score_a,
      score_b: live.score_b,
      ...(live.status ? { status: live.status as Matchup['status'] } : {}),
    };
  });
}

describe('Matchups Realtime Score Overlay', () => {
  const mockMatchups: Matchup[] = [
    {
      id: 'm1',
      league_id: 'league-1',
      gameweek: 5,
      team_a_id: 'team-a',
      team_b_id: 'team-b',
      score_a: 10.5,
      score_b: 14.2,
      status: 'live',
      lineup_a: null,
      lineup_b: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'm2',
      league_id: 'league-1',
      gameweek: 5,
      team_a_id: 'team-c',
      team_b_id: 'team-d',
      score_a: 0.0,
      score_b: 0.0,
      status: 'scheduled',
      lineup_a: null,
      lineup_b: null,
      created_at: new Date().toISOString(),
    },
  ];

  it('overlays updated score on target matchup while leaving unaffected matchups intact', () => {
    const liveScores = {
      m1: { score_a: 18.0, score_b: 14.2 },
    };

    const updated = applyLiveScores(mockMatchups, liveScores);
    expect(updated[0].score_a).toBe(18.0);
    expect(updated[0].score_b).toBe(14.2);
    expect(updated[0].status).toBe('live');

    // m2 remains completely unchanged
    expect(updated[1].score_a).toBe(0.0);
    expect(updated[1].score_b).toBe(0.0);
    expect(updated[1].status).toBe('scheduled');
  });

  it('updates status when a matchup transitions to completed', () => {
    const liveScores = {
      m1: { score_a: 32.5, score_b: 28.0, status: 'completed' },
    };

    const updated = applyLiveScores(mockMatchups, liveScores);
    expect(updated[0].status).toBe('completed');
    expect(updated[0].score_a).toBe(32.5);
    expect(updated[0].score_b).toBe(28.0);
  });

  it('handles empty or non-matching realtime updates safely', () => {
    const liveScores = {
      'non-existent-id': { score_a: 99, score_b: 99 },
    };

    const updated = applyLiveScores(mockMatchups, liveScores);
    expect(updated[0].score_a).toBe(10.5);
    expect(updated[1].score_a).toBe(0.0);
  });
});
