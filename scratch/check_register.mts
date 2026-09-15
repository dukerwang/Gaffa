/** One-off: run buildRegister against real league rows and print what it makes. */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { buildRegister, registerCounts, registerTotals } from '../src/lib/transactions/buildRegister';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const { data: league } = await db.from('leagues').select('id, name').eq('name', 'Dynasty Dragoon').single();
const leagueId = league!.id;

const [tx, teams, trades, loans, bids] = await Promise.all([
  db.from('transactions').select('id, type, team_id, player_id, faab_bid, compensation_amount, notes, processed_at').eq('league_id', leagueId).order('processed_at', { ascending: false }),
  db.from('teams').select('id, team_name').eq('league_id', leagueId),
  db.from('trade_proposals').select('id, status, team_a_id, team_b_id, offered_players, requested_players, offered_rights, requested_rights, offered_faab, requested_faab, created_at, updated_at').eq('league_id', leagueId).in('status', ['accepted', 'accepted_deferred']),
  db.from('player_loans').select('id, status, lender_team_id, borrower_team_id, player_id, loan_fee, end_gameweek, recall_penalty, recall_activated, created_at, updated_at').eq('league_id', leagueId),
  db.from('auction_bid_events').select('player_id, team_id, amount, created_at').eq('league_id', leagueId),
]);

const ids = new Set<string>();
for (const t of tx.data ?? []) if (t.player_id) ids.add(t.player_id);
for (const l of loans.data ?? []) if (l.player_id) ids.add(l.player_id);
const { data: pl } = await db.from('players').select('id, name, web_name, primary_position, pl_team').in('id', [...ids]);
const players = Object.fromEntries((pl ?? []).map((p) => [p.id, p]));

const entries = buildRegister({
  transactions: tx.data as any, trades: trades.data as any, loans: loans.data as any,
  bidEvents: bids.data as any, teams: teams.data as any, players: players as any,
});

console.log('raw transactions:', tx.data?.length, '→ register entries:', entries.length);
console.log('counts:', registerCounts(entries));
console.log('totals:', registerTotals(entries));
console.log('\n--- first 12 ---');
for (const e of entries.slice(0, 12)) {
  const p = e.player ? `[${e.player.primary_position}] ${e.player.web_name ?? e.player.name}` : '';
  const club2 = e.club2 ? ` and ${e.club2}` : '';
  const fee = e.money.text ?? e.money.none;
  console.log(`${e.at.slice(5, 16)}  ${e.club}${club2} ${e.verb} ${p}${e.tail ? ' ' + e.tail : ''}`);
  console.log(`            ${e.meta}`);
  for (const s of e.subs) console.log(`            └ ${s.player?.web_name ?? '?'} · ${s.text}`);
  console.log(`            ${fee}${e.money.label ? ' (' + e.money.label + ')' : ''}\n`);
}

console.log('\n--- non-signing rows ---');
for (const e of entries.filter((x) => x.kind !== 'signing')) {
  const p = e.player ? `[${e.player.primary_position}] ${e.player.web_name ?? e.player.name}` : '';
  console.log(`${e.at.slice(0,16)} ${e.kind.padEnd(10)} ${e.club}${e.club2 ? ' and ' + e.club2 : ''} ${e.verb} ${p}${e.tail ? ' ' + e.tail : ''}`);
  console.log(`   ${e.meta}   →  ${e.money.text ?? e.money.none}${e.money.label ? ' (' + e.money.label + ')' : ''}`);
}
