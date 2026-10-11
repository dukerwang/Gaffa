// Read-only: what the Caretaker would pick for every club in a league, on live data.
// Usage: node node_modules/.bin/tsx scratch/caretaker_dry_run.mts "<league name>"
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { pickCaretakerLineup, planSquadMoves, caretakerScore, type CaretakerEntry } from '../src/lib/caretaker/plan.ts';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
  }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const leagueName = process.argv[2] ?? 'E2E 10-Man Test (6:12:36 PM)';

const { data: league } = await admin.from('leagues').select('id, ir_size').eq('name', leagueName).single();
const { data: teams } = await admin.from('teams').select('id, team_name, ir_slots').eq('league_id', league!.id);
const { data: proj } = await admin.from('players').select('projected_season, projected_gameweek').not('projected_gameweek', 'is', null).order('projected_gameweek', { ascending: false }).limit(1).single();
const season = proj?.projected_season ?? null;
const gw = proj?.projected_gameweek ?? 1;
console.log(`league ${leagueName}, projections stamped ${season} GW${gw}`);

for (const t of teams ?? []) {
  const { data: rows } = await admin
    .from('roster_entries')
    .select('id, status, player:players(id, web_name, primary_position, secondary_positions, pl_team_id, ppg, fpl_status, fpl_chance_next_round, projected_points, projected_season, projected_gameweek)')
    .eq('team_id', t.id);
  const entries = (rows ?? []).map((r: any) => ({ id: r.id, status: r.status, player: r.player })) as CaretakerEntry[];
  const lineup = pickCaretakerLineup(entries, season, gw);
  const moves = planSquadMoves({ entries, irSlots: t.ir_slots ?? league!.ir_size ?? 2, rosterLimit: 20, isIrLocked: () => false });
  const name = (id: string) => (entries.find((e) => e.player.id === id)?.player as any)?.web_name ?? id;
  const total = lineup ? lineup.starters.reduce((s, x) => s + caretakerScore(entries.find((e) => e.player.id === x.player_id)!.player, season, gw), 0) : 0;
  console.log(
    `${t.team_name.padEnd(22)} ${lineup ? lineup.formation.padEnd(8) : 'NO LINEUP'} proj ${total.toFixed(1).padStart(5)}  bench ${lineup?.bench.map((b) => `${b.slot}:${name(b.player_id)}`).join(' ') ?? ''}  moves ${moves.map((m) => `${m.kind}:${name(m.playerId)}`).join(' ') || '-'}`,
  );
}
