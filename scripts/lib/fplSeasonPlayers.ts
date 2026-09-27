/**
 * Resolves each Gaffa player to FPL's identity for a past or current season:
 * the stable per-player `code` (which is also the player's Opta id, the key
 * FotMob exposes as `optaId`), the season's element type, and club code.
 *
 * FPL reassigns player ids every season and `players.fpl_id` holds only the
 * current one, so a season's own data comes from
 * vaastav/Fantasy-Premier-League's players_raw.csv. A player still in FPL is
 * joined on `code` through the current bootstrap. One who has left has no
 * current id (or a stale one), so he is matched by name in the season's list,
 * with his club that season breaking ties.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CLUB_BY_SLUG } from '../../src/lib/clubs/registry';

export type ElementType = 1 | 2 | 3 | 4;
export interface SeasonIdentity { code: number; et: ElementType; teamCode: number }

export interface PlayerRef {
  player_id: string;
  web_name: string;
  fpl_id: number | null;
  /** The player's club slug that season, from player_season_clubs. */
  club_slug?: string;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export async function resolveSeasonPlayers(
  season: string,
  players: PlayerRef[],
  cacheDir: string,
): Promise<{ byPlayer: Map<string, SeasonIdentity>; unresolved: string[]; viaCode: number; viaName: number }> {
  mkdirSync(cacheDir, { recursive: true });
  const cache = `${cacheDir}/players_raw_${season}.csv`;
  if (!existsSync(cache)) {
    const url = `https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/${season}/players_raw.csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`players_raw.csv for ${season}: HTTP ${res.status}`);
    writeFileSync(cache, await res.text());
  }
  const byCode = new Map<number, SeasonIdentity>();
  const byName = new Map<string, SeasonIdentity[]>();
  for (const r of parseCsv(readFileSync(cache, 'utf8'))) {
    const v: SeasonIdentity = { code: Number(r.code), et: Number(r.element_type) as ElementType, teamCode: Number(r.team_code) };
    byCode.set(v.code, v);
    byName.set(norm(r.web_name), [...(byName.get(norm(r.web_name)) ?? []), v]);
  }

  const boot = await (await fetch('https://fantasy.premierleague.com/api/bootstrap-static/')).json();
  const currentCode = new Map<number, number>(boot.elements.map((e: any) => [e.id, e.code]));

  const byPlayer = new Map<string, SeasonIdentity>();
  const unresolved: string[] = [];
  let viaCode = 0, viaName = 0;
  for (const p of players) {
    if (byPlayer.has(p.player_id)) continue;
    const code = p.fpl_id != null ? currentCode.get(p.fpl_id) : undefined;
    const hit = code != null ? byCode.get(code) : undefined;
    if (hit) { byPlayer.set(p.player_id, hit); viaCode++; continue; }
    const clubCode = CLUB_BY_SLUG.get(p.club_slug ?? '')?.fplCode;
    const named = byName.get(norm(p.web_name)) ?? [];
    const pick = named.length === 1 ? named[0] : named.find((v) => v.teamCode === clubCode);
    if (pick) { byPlayer.set(p.player_id, pick); viaName++; continue; }
    unresolved.push(p.web_name);
  }
  return { byPlayer, unresolved, viaCode, viaName };
}
