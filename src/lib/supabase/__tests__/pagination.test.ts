/**
 * The pagination helpers.
 *
 * PostgREST truncates a read at 1,000 rows and reports success. These helpers
 * are what stand between that and a caller that scores, pays or syncs from the
 * result, so the tests run them against the fake with the same cap.
 */

import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';
import { ID_CHUNK_SIZE, fetchAllPagesIn, fetchAllPagesOrThrow } from '../pagination';

describe('fetchAllPagesOrThrow', () => {
  it('reads every row past the cap, once each', async () => {
    const db = createFakeSupabase({
      rows: Array.from({ length: 2_345 }, (_, i) => ({ id: i, season: '2026-27' })),
    });

    const rows = await fetchAllPagesOrThrow<{ id: number }>((from, to) =>
      db.from('rows').select('id').eq('season', '2026-27').order('id').range(from, to),
    );

    expect(rows).toHaveLength(2_345);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2_345);
  });

  it('throws on a failed page instead of returning what it had', async () => {
    let calls = 0;
    const run = async (_from: number, _to: number) => {
      calls++;
      if (calls === 1) {
        return { data: Array.from({ length: 1_000 }, (_, i) => ({ id: i })), error: null };
      }
      return { data: null, error: { message: 'canceling statement due to statement timeout' } };
    };

    await expect(fetchAllPagesOrThrow(run)).rejects.toThrow('statement timeout');
  });

  it('parallel batches remaining pages when count is returned and preserves order', async () => {
    const totalRows = 3_250;
    const all = Array.from({ length: totalRows }, (_, i) => ({ id: i }));
    const requestedRanges: [number, number][] = [];

    const run = async (from: number, to: number) => {
      requestedRanges.push([from, to]);
      return {
        data: all.slice(from, to + 1),
        error: null,
        count: totalRows,
      };
    };

    const rows = await fetchAllPagesOrThrow<{ id: number }>(run);
    expect(rows).toHaveLength(totalRows);
    expect(rows.map((r) => r.id)).toEqual(all.map((r) => r.id));
    // Verify first page was requested, followed by parallel pages
    expect(requestedRanges[0]).toEqual([0, 999]);
    expect(requestedRanges).toHaveLength(4);
  });
});

describe('fetchAllPagesIn', () => {
  it('chunks the id list and pages each chunk', async () => {
    // 400 ids x 8 rows: every full chunk holds 1,200 rows, over the cap on its own.
    const ids = Array.from({ length: 400 }, (_, i) => `player-${i}`);
    const stats = ids.flatMap((playerId, p) =>
      Array.from({ length: 8 }, (_, g) => ({ id: p * 8 + g, player_id: playerId, gameweek: g + 1 })),
    );
    const db = createFakeSupabase({ player_stats: stats });

    const chunkSizes: number[] = [];
    const rows = await fetchAllPagesIn<{ player_id: string }>(ids, (chunk, from, to) => {
      if (from === 0) chunkSizes.push(chunk.length);
      return db.from('player_stats').select('player_id').in('player_id', chunk).order('id').range(from, to);
    });

    expect(rows).toHaveLength(3_200);
    expect(chunkSizes).toEqual([ID_CHUNK_SIZE, ID_CHUNK_SIZE, 400 - 2 * ID_CHUNK_SIZE]);
  });

  it('makes no request for an empty id list', async () => {
    let calls = 0;
    const rows = await fetchAllPagesIn([], async () => {
      calls++;
      return { data: [], error: null };
    });
    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });
});
