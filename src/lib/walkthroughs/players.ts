/**
 * The famous faces the walkthroughs use, with everything <Portrait> needs to
 * crop them the way the rest of the app does. Copied from `players`, because a
 * walkthrough makes no requests.
 */

export interface PinnedPlayer {
  name: string;
  club: string;
  photoUrl: string;
  photoVersion: string | null;
  headTopPct: number | null;
  headWidthPct: number | null;
}

const pin = (name: string, club: string, code: number, photoVersion: string | null, headTopPct: number | null, headWidthPct: number | null): PinnedPlayer => ({
  name,
  club,
  photoUrl: `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`,
  photoVersion,
  headTopPct,
  headWidthPct,
});

export const PINNED = {
  saliba: pin('William Saliba', 'Arsenal', 462424, '1758016023000', 0.01, 0.28),
  gabriel: pin('Gabriel Magalhães', 'Arsenal', 226597, '1789487092000', 0.014, 0.274),
  odegaard: pin('Martin Ødegaard', 'Arsenal', 184029, '1789487090000', 0.02, 0.322),
  saka: pin('Bukayo Saka', 'Arsenal', 223340, '1789487092000', 0.016, 0.282),
  barcola: pin('Bradley Barcola', 'Liverpool', 482616, null, null, null),
  eze: pin('Eberechi Eze', 'Arsenal', 232413, '1789487092000', 0.014, 0.304),
  rogers: pin('Morgan Rogers', 'Chelsea', 244850, '1789485536000', 0.012, 0.284),
  joaoPedro: pin('João Pedro', 'Chelsea', 475168, '1789485538000', 0.01, 0.254),
  palmer: pin('Cole Palmer', 'Chelsea', 244851, '1789485536000', 0.008, 0.266),
  haaland: pin('Erling Haaland', 'Man City', 223094, '1789725304000', 0.036, 0.27),
  rodri: pin('Rodri', 'Man City', 220566, '1758015875000', 0.012, 0.268),
} as const;

export type PinnedKey = keyof typeof PINNED;
