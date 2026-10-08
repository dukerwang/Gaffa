import type { Formation } from '@/types';

export interface SerializedLineup {
  formation: Formation;
  title: string;
  clubFilter?: string | null;
  /** Array of 11 player IDs, where empty string or null means unfilled */
  playerIds: (string | null)[];
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
  params.set('f', lineup.formation);
  if (lineup.title.trim()) {
    params.set('t', lineup.title.trim());
  }
  if (lineup.clubFilter) {
    params.set('c', lineup.clubFilter);
  }

  // Comma-separated list of player IDs (or empty string for unfilled slots)
  const ids = lineup.playerIds.map((id) => id ?? '').join(',');
  if (ids.replace(/,/g, '').length > 0) {
    params.set('p', ids);
  }

  return params.toString();
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

  const rawPlayers = get('p');
  const playerIds: (string | null)[] = Array(11).fill(null);

  if (rawPlayers) {
    const parts = rawPlayers.split(',');
    for (let i = 0; i < 11; i++) {
      if (parts[i] && parts[i].trim().length > 0) {
        playerIds[i] = parts[i].trim();
      }
    }
  }

  return {
    formation,
    title,
    clubFilter,
    playerIds,
  };
}
