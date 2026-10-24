import type { Formation } from '@/types';

export interface SerializedLineup {
  formation: Formation;
  title: string;
  clubFilter?: string | null;
  /** The Premier League match the XI is for. FPL fixture ids restart every season, so the season travels with it. */
  fixture?: { season: string; id: number } | null;
  /** Array of 11 player IDs, where empty string or null means unfilled. The home side's, for a match. */
  playerIds: (string | null)[];
  /** A match's away side. Null when the link carries none, so the builder starts from the match's own. */
  away?: { formation: Formation; playerIds: (string | null)[] } | null;
  /** Which side of a match is showing. */
  side?: 'home' | 'away';
}

export const VALID_FORMATIONS = [
  '4-3-3',
  '4-2-1-3',
  '4-2-2-2',
  '3-4-1-2',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '3-4-2-1',
  '4-3-1-2',
  '4-3-2-1',
  '4-2-4',
  '5-2-3',
] as const;

const FORMATION_SET = new Set<string>(VALID_FORMATIONS);
const DEFAULT_FORMATION: Formation = '4-3-3';

export function isFormation(value: string | undefined | null): value is Formation {
  if (!value) return false;
  return FORMATION_SET.has(value);
}

export function serializeLineup(lineup: SerializedLineup): string {
  const params = new URLSearchParams();
  // A match's home side with no players in the link is rebuilt from the match, shape and all.
  if (!lineup.fixture || lineup.playerIds.some(Boolean)) params.set('f', lineup.formation);
  if (lineup.title.trim()) {
    params.set('t', lineup.title.trim());
  }
  if (lineup.clubFilter) {
    params.set('c', lineup.clubFilter);
  }
  if (lineup.fixture) {
    params.set('m', String(lineup.fixture.id));
    params.set('s', lineup.fixture.season);
  }

  // Comma-separated list of player IDs (or empty string for unfilled slots)
  const ids = lineup.playerIds.map((id) => id ?? '').join(',');
  if (ids.replace(/,/g, '').length > 0) {
    params.set('p', ids);
  }

  if (lineup.fixture && lineup.away) {
    params.set('fa', lineup.away.formation);
    const awayIds = lineup.away.playerIds.map((id) => id ?? '').join(',');
    if (awayIds.replace(/,/g, '').length > 0) params.set('pa', awayIds);
  }
  if (lineup.fixture && lineup.side === 'away') params.set('v', 'a');

  return params.toString();
}

function parseIds(raw: string | undefined): (string | null)[] {
  const ids: (string | null)[] = Array(11).fill(null);
  if (!raw) return ids;
  const parts = raw.split(',');
  for (let i = 0; i < 11; i++) {
    if (parts[i] && parts[i].trim().length > 0) ids[i] = parts[i].trim();
  }
  return ids;
}

export function deserializeLineup(searchParams: URLSearchParams | Record<string, string | undefined>): SerializedLineup {
  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    return searchParams[key];
  };

  const rawFormation = get('f');
  const formation: Formation = isFormation(rawFormation) ? rawFormation : DEFAULT_FORMATION;
  const title = get('t') ?? '';
  const clubFilter = get('c') ?? null;
  const matchId = Number(get('m'));
  const matchSeason = get('s');
  const fixture =
    Number.isInteger(matchId) && matchId > 0 && matchSeason && /^\d{4}-\d{2}$/.test(matchSeason)
      ? { season: matchSeason, id: matchId }
      : null;

  const playerIds = parseIds(get('p'));
  const rawAwayFormation = get('fa');
  const away =
    fixture && (rawAwayFormation || get('pa'))
      ? {
          formation: isFormation(rawAwayFormation) ? rawAwayFormation : DEFAULT_FORMATION,
          playerIds: parseIds(get('pa')),
        }
      : null;
  const side: 'home' | 'away' = fixture && get('v') === 'a' ? 'away' : 'home';

  return {
    formation,
    title,
    clubFilter,
    fixture,
    playerIds,
    away,
    side,
  };
}
