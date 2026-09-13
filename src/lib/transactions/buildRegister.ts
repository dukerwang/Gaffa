/**
 * The register — every time a player changed hands, newest first.
 *
 * WHY THIS IS NOT A QUERY. The old Activity page read `transactions` and
 * nothing else, which had two consequences nobody noticed because the page
 * never showed a count. Its "Trades" filter could never match: there has never
 * been a `trade` row in that table, because a settled trade lives in
 * `trade_proposals` and a loan in `player_loans`. And more than half of what IS
 * in `transactions` is money with no roster consequence — solidarity, prizes,
 * merit revenue, scout's fees — which is Finance's ledger, not a transfer
 * record. So the register is a union of three tables, minus every row that
 * moves only money.
 *
 * The dividing line, stated once: a row belongs here when the answer to "who
 * plays for whom" changed. A fee is a PROPERTY of that change, never a row of
 * its own. `/finance` keeps the full ledger and is where the excluded rows go.
 *
 * PAIRING. A signing that forces a release writes two `transactions` rows with
 * the same team and the same `processed_at` — "Won auction for X (+ €5m drop
 * severance)" and "Dropped Y to make room for auction winner: X". They are one
 * event, and the old feed printed both as separate cards. `pairReleases` folds
 * the drop into the signing as a sub-line.
 */

import { getPlayerDisplayName } from '@/lib/players/displayName';
import { describeDeal } from '@/lib/transfers/describeDeal';

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface RegisterPlayer {
  id: string;
  name: string;
  web_name: string | null;
  primary_position: string;
  pl_team: string | null;
}

export interface RegisterTeam {
  id: string;
  team_name: string;
}

export interface RawTransaction {
  id: string;
  type: string;
  team_id: string | null;
  player_id: string | null;
  faab_bid: number | null;
  compensation_amount: string | number | null;
  notes: string | null;
  processed_at: string;
}

export interface RawTrade {
  id: string;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
  offered_players: string[] | null;
  requested_players: string[] | null;
  offered_rights: string[] | null;
  requested_rights: string[] | null;
  offered_faab: number;
  requested_faab: number;
  created_at: string;
  updated_at: string | null;
}

export interface RawLoan {
  id: string;
  status: string;
  lender_team_id: string | null;
  borrower_team_id: string | null;
  player_id: string | null;
  loan_fee: number | null;
  end_gameweek: number | null;
  recall_penalty: number | null;
  recall_activated: boolean | null;
  created_at: string;
  updated_at: string | null;
}

/** One bid, from `auction_bid_events`. Used only to describe how a signing was won. */
export interface RawBidEvent {
  player_id: string;
  team_id: string | null;
  amount: number;
  created_at: string;
}

export interface RegisterInput {
  transactions: RawTransaction[];
  trades: RawTrade[];
  loans: RawLoan[];
  bidEvents: RawBidEvent[];
  teams: RegisterTeam[];
  players: Record<string, RegisterPlayer>;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type RegisterKind = 'signing' | 'departure' | 'trade' | 'loan';

export interface RegisterMoney {
  /** Rendered figure, or null when no money moved. */
  text: string | null;
  /** What kind of money it is — "Fee", "Severance", "Compensation". */
  label: string | null;
  /** Plain words for a row with no figure — "Free", "Draft". */
  none: string | null;
  tone: 'in' | 'out' | 'neutral';
}

export interface RegisterSubLine {
  player: RegisterPlayer | null;
  /** Follows the player's name. */
  text: string;
}

export interface RegisterEntry {
  id: string;
  at: string;
  kind: RegisterKind;
  /** Every club involved, for the club filter. */
  clubIds: string[];
  /** The sentence: club — verb — player — tail. */
  club: string;
  /** A second club named before the verb, on a trade. */
  club2: string | null;
  verb: string;
  player: RegisterPlayer | null;
  tail: string | null;
  meta: string;
  subs: RegisterSubLine[];
  money: RegisterMoney;
  /** Lowercased haystack for the search field. */
  haystack: string;
}

export interface RegisterTotals {
  signings: number;
  spent: number;
  biggestFee: number;
  biggestFeePlayer: string | null;
  departures: number;
  returned: number;
}

export interface RegisterCounts {
  all: number;
  signing: number;
  departure: number;
  trade: number;
  loan: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(1)}m`;
const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const bidderPhrase = (n: number) =>
  n <= 1 ? 'Won at auction, unopposed'
  : n <= 10 ? `Won at auction, ${COUNT_WORD[n]} bidders`
  : `Won at auction, ${n} bidders`;

/**
 * Money rows with no roster consequence. Finance owns these. Facility purchases
 * are here too: they stay on the buyer's ledger, not the league feed (Duke,
 * 2026-09-15).
 */
export const LEDGER_ONLY_TYPES = [
  'rebate',
  'prize_payout',
  'merit_payment',
  'solidarity_payment',
  'loan_fee',
  'loan_bonus',
  'loan_recall_penalty',
  'loan_slot_buyback',
  'facility_upgrade',
] as const;
const LEDGER_ONLY = new Set<string>(LEDGER_ONLY_TYPES);

/**
 * A drop written to make room for a signing names the winner it made room for.
 * The wording has been stable since the auction resolver started writing it;
 * the fallback if it ever changes is that the release simply shows as its own
 * row, which is the old behaviour rather than a break.
 */
const MADE_ROOM = /to make room for auction winner:/i;

/**
 * `describeDeal` names a deal for a headline — "A part-exchange" — so mid-line,
 * where the row is already a sentence, the article reads as a typo.
 */
function dropArticle(text: string): string {
  const bare = text.replace(/^an?\s+/i, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

// ─── The builder ──────────────────────────────────────────────────────────────

export function buildRegister(input: RegisterInput): RegisterEntry[] {
  const { transactions, trades, loans, bidEvents, teams, players } = input;

  const teamName = (id: string | null | undefined) =>
    (id && teams.find((t) => t.id === id)?.team_name) || 'A club';
  const playerOf = (id: string | null | undefined) => (id ? players[id] ?? null : null);
  const label = (p: RegisterPlayer | null) => (p ? getPlayerDisplayName(p, 'full') : 'a player');

  const entries: RegisterEntry[] = [];

  // ── Auctions: who else bid, and how high ──────────────────────────────────
  //
  // `auction_state` holds one row per player per league and is overwritten each
  // time that player goes back under the hammer, so it cannot describe an older
  // signing. The event log can: for a signing at time t, the bidders are the
  // clubs who bid on that player after the previous signing of him and at or
  // before t. Leagues predating the event log simply have no events, and those
  // rows fall back to "Won at auction" with no count rather than a wrong one.
  const eventsByPlayer = new Map<string, RawBidEvent[]>();
  for (const e of bidEvents) {
    const list = eventsByPlayer.get(e.player_id);
    if (list) list.push(e);
    else eventsByPlayer.set(e.player_id, [e]);
  }
  for (const list of eventsByPlayer.values()) {
    list.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }

  const signingTimesByPlayer = new Map<string, number[]>();
  for (const tx of transactions) {
    if (tx.type !== 'waiver_claim' || !tx.player_id) continue;
    const list = signingTimesByPlayer.get(tx.player_id);
    if (list) list.push(Date.parse(tx.processed_at));
    else signingTimesByPlayer.set(tx.player_id, [Date.parse(tx.processed_at)]);
  }
  for (const list of signingTimesByPlayer.values()) list.sort((a, b) => a - b);

  function auctionShape(playerId: string, winnerTeamId: string | null, at: string) {
    const events = eventsByPlayer.get(playerId);
    if (!events?.length) return { phrase: 'Won at auction', underbid: null as string | null };

    const t = Date.parse(at);
    const priorSignings = (signingTimesByPlayer.get(playerId) ?? []).filter((s) => s < t);
    const windowStart = priorSignings.length ? priorSignings[priorSignings.length - 1] : -Infinity;
    const inWindow = events.filter((e) => {
      const c = Date.parse(e.created_at);
      return c > windowStart && c <= t;
    });
    if (!inWindow.length) return { phrase: 'Won at auction', underbid: null };

    const bidders = new Set(inWindow.map((e) => e.team_id).filter(Boolean) as string[]);
    const rivals = inWindow.filter((e) => e.team_id && e.team_id !== winnerTeamId);
    const best = rivals.reduce<RawBidEvent | null>(
      (top, e) => (!top || e.amount > top.amount ? e : top),
      null,
    );
    return {
      phrase: bidderPhrase(bidders.size),
      underbid: best ? `${teamName(best.team_id)} bid ${money(best.amount)}` : null,
    };
  }

  // ── Pair a release with the signing it made room for ──────────────────────
  const paired = new Set<string>();
  const releaseFor = new Map<string, RawTransaction>();
  for (const drop of transactions) {
    if (drop.type !== 'drop' || !drop.notes || !MADE_ROOM.test(drop.notes)) continue;
    const partner = transactions.find(
      (t) =>
        t.type === 'waiver_claim' &&
        t.team_id === drop.team_id &&
        t.processed_at === drop.processed_at,
    );
    if (!partner) continue;
    releaseFor.set(partner.id, drop);
    paired.add(drop.id);
  }

  // ── transactions ──────────────────────────────────────────────────────────
  for (const tx of transactions) {
    if (LEDGER_ONLY.has(tx.type) || paired.has(tx.id)) continue;
    // A settled trade is read off `trade_proposals`, which knows both sides;
    // the `trade` transaction type has never been written.
    if (tx.type === 'trade') continue;

    const club = teamName(tx.team_id);
    const player = playerOf(tx.player_id);
    const parts: string[] = [];
    if (player?.pl_team) parts.push(player.pl_team);

    const clubIds = tx.team_id ? [tx.team_id] : [];
    const subs: RegisterSubLine[] = [];
    let kind: RegisterKind = 'signing';
    let verb = 'signed';
    let tail: string | null = null;
    let moneyOut: RegisterMoney = { text: null, label: null, none: null, tone: 'neutral' };

    switch (tx.type) {
      case 'waiver_claim': {
        const fee = tx.faab_bid ?? 0;
        const shape = tx.player_id ? auctionShape(tx.player_id, tx.team_id, tx.processed_at) : null;
        if (shape) parts.push(shape.phrase);
        if (shape?.underbid) parts.push(shape.underbid);
        if (tx.notes?.includes('-> academy')) {
          tail = 'into the academy';
          parts.push('Aged 21 or under, outside the senior squad');
        }
        moneyOut = fee > 0
          ? { text: money(fee), label: 'Fee', none: null, tone: 'neutral' }
          : { text: null, label: null, none: 'Free', tone: 'neutral' };

        const release = releaseFor.get(tx.id);
        if (release) {
          const gone = playerOf(release.player_id);
          const severance = num(release.compensation_amount);
          subs.push({
            player: gone,
            text: [
              gone?.primary_position,
              gone?.pl_team,
              severance > 0
                ? `released to make room, ${money(severance)} severance`
                : 'released to make room',
            ]
              .filter(Boolean)
              .join(' · '),
          });
        }
        break;
      }

      case 'free_agent_pickup':
        parts.push('Unclaimed at the close of the auction');
        moneyOut = { text: null, label: null, none: 'Free', tone: 'neutral' };
        break;

      case 'draft_pick':
        verb = 'drafted';
        moneyOut = { text: null, label: null, none: 'Draft', tone: 'neutral' };
        break;

      case 'drop': {
        kind = 'departure';
        verb = 'released';
        const severance = num(tx.compensation_amount);
        moneyOut = severance > 0
          ? { text: `−${money(severance)}`, label: 'Severance', none: null, tone: 'out' }
          : { text: null, label: null, none: 'No severance', tone: 'neutral' };
        break;
      }

      case 'transfer_compensation':
      case 'transfer_out': {
        kind = 'departure';
        verb = 'lost';
        const comp = num(tx.compensation_amount);
        parts.push('Left the Premier League');
        if (comp > 0) {
          parts.push('Took compensation, so cannot bid if he returns');
          moneyOut = { text: `+${money(comp)}`, label: 'Compensation', none: null, tone: 'in' };
        } else {
          verb = 'retained the rights to';
          parts.push('Took no compensation, so keeps first refusal if he returns');
          moneyOut = { text: null, label: null, none: 'No fee', tone: 'neutral' };
        }
        break;
      }

      case 'sale_proceeds': {
        kind = 'departure';
        verb = 'sold';
        const price = num(tx.compensation_amount) || (tx.faab_bid ?? 0);
        moneyOut = price > 0
          ? { text: `+${money(price)}`, label: 'Sale price', none: null, tone: 'in' }
          : { text: null, label: null, none: 'No fee', tone: 'neutral' };
        break;
      }

      default:
        // An unmapped type is a roster event nobody has described yet. Show it
        // rather than swallow it, and let the note speak.
        if (tx.notes) parts.push(tx.notes);
        break;
    }

    entries.push({
      id: `tx:${tx.id}`,
      at: tx.processed_at,
      kind,
      clubIds,
      club,
      club2: null,
      verb,
      player,
      tail,
      meta: parts.filter(Boolean).join(' · '),
      subs,
      money: moneyOut,
      haystack: [club, label(player), player?.pl_team, verb, ...parts]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    });
  }

  // ── settled trades ────────────────────────────────────────────────────────
  for (const t of trades) {
    if (t.status !== 'accepted' && t.status !== 'accepted_deferred') continue;

    const a = teamName(t.team_a_id);
    const b = teamName(t.team_b_id);
    const names = (ids: string[] | null | undefined) =>
      (ids ?? []).map((id) => playerOf(id)).filter(Boolean) as RegisterPlayer[];
    const rightNames = (ids: string[] | null | undefined) =>
      (ids ?? []).map((id) => playerOf(id)).filter(Boolean) as RegisterPlayer[];

    const offered = names(t.offered_players);
    const requested = names(t.requested_players);
    const offeredRights = rightNames(t.offered_rights);
    const requestedRights = rightNames(t.requested_rights);

    const deal = describeDeal({
      offered: [...offered.map((p) => label(p)), ...offeredRights.map((p) => `${label(p)}'s rights`)],
      requested: [
        ...requested.map((p) => label(p)),
        ...requestedRights.map((p) => `${label(p)}'s rights`),
      ],
      offeredFaab: t.offered_faab,
      requestedFaab: t.requested_faab,
    });

    const cash = Math.abs(t.offered_faab - t.requested_faab);
    const subs: RegisterSubLine[] = [
      ...offered.map((p) => ({
        player: p,
        text: [p.primary_position, p.pl_team, `to ${b}`].filter(Boolean).join(' · '),
      })),
      ...requested.map((p) => ({
        player: p,
        text: [p.primary_position, p.pl_team, `to ${a}`].filter(Boolean).join(' · '),
      })),
    ];

    entries.push({
      id: `trade:${t.id}`,
      at: t.updated_at ?? t.created_at,
      kind: 'trade',
      clubIds: [t.team_a_id, t.team_b_id].filter(Boolean) as string[],
      club: a,
      club2: b,
      verb: 'agreed a trade',
      player: null,
      tail: null,
      meta: dropArticle(deal.headline),
      subs,
      money: cash > 0
        ? { text: money(cash), label: 'Cash in the deal', none: null, tone: 'neutral' }
        : { text: null, label: null, none: 'Players only', tone: 'neutral' },
      haystack: [a, b, deal.headline, ...subs.map((s) => label(s.player))]
        .join(' ')
        .toLowerCase(),
    });
  }

  // ── loans ─────────────────────────────────────────────────────────────────
  //
  // `player_loans` keeps ONE row whose status mutates, so a recalled loan holds
  // only its ending. A register has to carry both: the agreement was news when
  // it happened and stays part of the record after the player goes back. So a
  // recalled loan emits two entries, at its two timestamps.
  for (const l of loans) {
    // A loan enters the record once it is agreed. Pending and rejected offers
    // are negotiation, and negotiation lives on Transfers.
    if (!['active', 'accepted_deferred', 'recalled', 'expired'].includes(l.status)) continue;

    const lender = teamName(l.lender_team_id);
    const borrower = teamName(l.borrower_team_id);
    const player = playerOf(l.player_id);
    const clubIds = [l.lender_team_id, l.borrower_team_id].filter(Boolean) as string[];
    const haystack = [lender, borrower, label(player), player?.pl_team]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const agreed: string[] = [];
    if (player?.pl_team) agreed.push(player.pl_team);
    agreed.push(
      l.end_gameweek ? `Until gameweek ${l.end_gameweek}` : 'Until the end of the season',
    );
    if (l.recall_penalty) agreed.push(`${money(l.recall_penalty)} to recall him early`);

    entries.push({
      id: `loan:${l.id}`,
      at: l.created_at,
      kind: 'loan',
      clubIds,
      club: lender,
      club2: null,
      verb: 'loaned',
      player,
      tail: `to ${borrower}`,
      meta: agreed.filter(Boolean).join(' · '),
      subs: [],
      money: l.loan_fee
        ? { text: money(l.loan_fee), label: 'Loan fee', none: null, tone: 'neutral' }
        : { text: null, label: null, none: 'No fee', tone: 'neutral' },
      haystack,
    });

    if (l.status === 'recalled') {
      const back: string[] = [];
      if (player?.pl_team) back.push(player.pl_team);
      back.push('Recalled before the loan ran its term');

      entries.push({
        id: `loan:${l.id}:recall`,
        at: l.updated_at ?? l.created_at,
        kind: 'loan',
        clubIds,
        club: lender,
        club2: null,
        verb: 'recalled',
        player,
        tail: `from ${borrower}`,
        meta: back.filter(Boolean).join(' · '),
        subs: [],
        money: l.recall_penalty
          ? { text: `\u2212${money(l.recall_penalty)}`, label: 'Recall penalty', none: null, tone: 'out' }
          : { text: null, label: null, none: 'No fee', tone: 'neutral' },
        haystack,
      });
    }
  }

  return entries.sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
}

// ─── Derived readouts ─────────────────────────────────────────────────────────

export function registerTotals(entries: RegisterEntry[]): RegisterTotals {
  let signings = 0;
  let spent = 0;
  let biggestFee = 0;
  let biggestFeePlayer: string | null = null;
  let departures = 0;
  let returned = 0;

  for (const e of entries) {
    if (e.kind === 'signing') {
      signings++;
      if (e.money.label === 'Fee') {
        const v = feeValue(e.money.text);
        spent += v;
        if (v > biggestFee) {
          biggestFee = v;
          biggestFeePlayer = e.player ? getPlayerDisplayName(e.player, 'initial_last') : null;
        }
      }
    } else if (e.kind === 'departure') {
      departures++;
      if (e.money.tone === 'in') returned += feeValue(e.money.text);
    }
  }

  return { signings, spent, biggestFee, biggestFeePlayer, departures, returned };
}

export function registerCounts(entries: RegisterEntry[]): RegisterCounts {
  return {
    all: entries.length,
    signing: entries.filter((e) => e.kind === 'signing').length,
    departure: entries.filter((e) => e.kind === 'departure').length,
    trade: entries.filter((e) => e.kind === 'trade').length,
    loan: entries.filter((e) => e.kind === 'loan').length,
  };
}

/** "€164m" / "+€33m" / "−€4m" → 164 / 33 / 4. */
function feeValue(text: string | null): number {
  if (!text) return 0;
  const m = text.match(/([\d.]+)/);
  return m ? Number(m[1]) : 0;
}
