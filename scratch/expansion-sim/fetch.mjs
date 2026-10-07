// Pulls the alpha leagues' squads and every active player's projection into ./data.json.
// Usage: node scratch/expansion-sim/fetch.mjs [repo-root]
// The repo root is where .env.local and node_modules live (defaults to the current directory).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const root = process.argv[2] || process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function all(q) { let out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000) break; } return out; }
const { data: leagues, error } = await sb.from('leagues').select('id,name,roster_size,taxi_size,faab_budget').in('name', ['Matchday Militia', 'Dynasty Dragoon']);
if (error) throw error;
const ids = leagues.map(l => l.id);
const teams = await all(() => sb.from('teams').select('id,league_id,team_name,faab_budget').in('league_id', ids).order('id'));
const roster = await all(() => sb.from('roster_entries').select('id,team_id,league_id,player_id,status').in('league_id', ids).order('id'));
const players = await all(() => sb.from('players').select('id,name,primary_position,market_value,projected_points,ppg,date_of_birth,pl_team').eq('is_active', true).order('id'));
fs.writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify({ leagues, teams, roster, players }));
console.log(leagues.length, 'leagues,', teams.length, 'teams,', roster.length, 'roster rows,', players.length, 'players');
console.log('statuses:', [...new Set(roster.map(r => r.status))].join(', '));
