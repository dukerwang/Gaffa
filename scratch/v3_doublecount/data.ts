// Builds the audit dataset: every 2025-26 appearance (real FPL ICT, not
// imputed) joined to its FotMob match stats and FPL element type. Cached to
// scratch/v3_doublecount/data.json; delete it to rebuild.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fetchAll } from '../../scripts/lib/fetchAll';

export interface App {
  player_id: string; name: string; pos: string; et: 1 | 2 | 3 | 4;
  s: Record<string, any>;          // player_stats.stats
  f: Record<string, { value: number; total?: number }>; // FotMob stats
  penalty_goals: number;
}
const OUT = 'scratch/v3_doublecount/data.json';

export async function loadApps(): Promise<App[]> {
  if (existsSync(OUT)) return JSON.parse(readFileSync(OUT, 'utf8'));
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const fm = new Map<string, any>(JSON.parse(readFileSync('.fotmob-cache/2025-26/matched.json', 'utf8')).rows.map((r: any) => [`${r.player_id}:${r.match_id}`, r]));
  const et = new Map<number, number>();
  const csv = readFileSync('scratch/v3_eval/players_raw_2025-26.csv', 'utf8').split('\n');
  const head = csv[0].split(','), ci = head.indexOf('code'), ei = head.indexOf('element_type');
  for (const line of csv.slice(1)) { const c = line.split(','); if (c[ci]) et.set(Number(c[ci]), Number(c[ei])); }
  const rows = await fetchAll<any>((f, t) => sb.from('player_stats')
    .select('player_id, match_id, stats, players!inner(web_name, primary_position)').eq('season', '2025-26').order('id').range(f, t));
  const out: App[] = [];
  for (const r of rows) {
    const s = r.stats; if (!(s?.minutes_played > 0) || s.ict_imputed) continue;
    const f = fm.get(`${r.player_id}:${r.match_id}`); if (!f) continue;
    const num = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'string' ? Number(v) : v]));
    out.push({ player_id: r.player_id, name: r.players.web_name, pos: r.players.primary_position,
      et: (et.get(f.opta_id) ?? 3) as any, s: num, f: f.stats, penalty_goals: Math.min(f.penalty_goals ?? 0, num.goals ?? 0) });
  }
  writeFileSync(OUT, JSON.stringify(out));
  return out;
}
