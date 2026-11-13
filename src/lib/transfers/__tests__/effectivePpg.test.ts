import { describe, expect, it } from 'vitest';
import { buildEffectivePpgMap, calculateEffectivePpg } from '../effectivePpg';

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function adminWith(rpc: Rpc) {
  return { rpc } as never;
}

describe('buildEffectivePpgMap', () => {
  it('turns the database samples into the same figure calculateEffectivePpg gives', async () => {
    const curr = Array.from({ length: 12 }, (_, i) => [12 - i, 90] as [number, number]);
    const prev = Array.from({ length: 20 }, () => [5, 90] as [number, number]);
    const calls: Record<string, unknown>[] = [];
    const map = await buildEffectivePpgMap(
      adminWith(async (_name, args) => {
        calls.push(args);
        return { data: [{ player_id: 'a', curr, prev }], error: null };
      }),
      ['a', 'b'],
      '2026-27',
      '2025-26',
      { a: 20, b: 5 },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ p_season: '2026-27', p_prev_season: '2025-26' });
    expect(map.a).toBeCloseTo(
      calculateEffectivePpg(
        curr.map(([points, minutes]) => ({ points, minutes })),
        prev.map(([points, minutes]) => ({ points, minutes })),
        20,
      ),
      10,
    );
    // No row back means no appearances, so the market-value proxy (floor 3.0).
    expect(map.b).toBe(calculateEffectivePpg([], [], 5));
  });

  it('throws when the read fails, rather than pricing everyone off the proxy', async () => {
    await expect(
      buildEffectivePpgMap(
        adminWith(async () => ({ data: null, error: { message: 'boom' } })),
        ['c'],
        '2026-27',
        '2025-26',
        { c: 50 },
      ),
    ).rejects.toThrow('effective_ppg_samples failed: boom');
  });
});
