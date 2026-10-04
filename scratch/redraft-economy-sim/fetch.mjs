// Pulls 2025-26 Gaffa points, players and club history into ./data.json.
// Run from the repo root: node scratch/redraft-economy-sim/fetch.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function all(q) { let out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000) break; } return out; }
const stats = await all(() => sb.from('player_stats').select('id,player_id,gameweek,fantasy_points').eq('season', '2025-26').order('id'));
const players = await all(() => sb.from('players').select('id,name,primary_position,market_value').order('id'));
const psc = await all(() => sb.from('player_season_clubs').select('player_id,club_slug').eq('season', '2025-26').order('player_id'));
const slim = stats.map(s => ({ p: s.player_id, gw: s.gameweek, pts: Number(s.fantasy_points) || 0 }));
fs.writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify({ stats: slim, players, psc }));
console.log(stats.length, 'stat rows,', players.length, 'players,', psc.length, 'club rows');
