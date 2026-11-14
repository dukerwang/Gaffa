import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The trades page module reaches for Supabase and the router at import; neither matters here.
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

const { TradeCard } = await import('@/app/(dashboard)/league/[leagueId]/trades/TradesClient');

describe('TradeCard outside the dashboard', () => {
  it('renders without a PlayerCardProvider, as on the sign-in showcase', () => {
    const html = renderToStaticMarkup(
      createElement(TradeCard, {
        trade: {
          id: 'demo-trade',
          team_a_id: 'a',
          team_b_id: 'b',
          offered_players: ['p-saka'],
          requested_players: ['p-palmer'],
          offered_faab: 0,
          requested_faab: 14,
          status: 'pending',
          message: null,
          created_at: '2026-11-13T10:00:00Z',
          team_a: { id: 'a', team_name: 'Vardy Party' },
          team_b: { id: 'b', team_name: 'Half-Court FC' },
        },
        myTeamId: 'b',
        playerMap: {
          'p-saka': { id: 'p-saka', name: 'Bukayo Saka', web_name: 'Saka', full_name: null, pl_team: 'Arsenal', primary_position: 'RW' },
          'p-palmer': { id: 'p-palmer', name: 'Cole Palmer', web_name: 'Palmer', full_name: null, pl_team: 'Chelsea', primary_position: 'AM' },
        },
        onAction: async () => {},
        onCounter: () => {},
        onViewPlayer: () => {},
        error: '',
        loading: false,
      } as never),
    );
    expect(html).toContain('Vardy Party');
  });
});
