/**
 * Gaffa — the Club Ledger
 *
 * Pure arithmetic on a club's money movements, shared by the finance page and
 * its tests. No database access: `loadFinance.ts` reads the rows, this module
 * turns them into a ledger with running balances.
 *
 * Two sources, because `transactions` alone does not account for every euro:
 *
 *   transactions      every movement the app writes a row for
 *   trade_proposals   cash in an accepted trade, which never reaches
 *                     `transactions` (the trade row it writes carries no amount)
 *
 * With both, every club in the live leagues reconciles to its league's opening
 * balance exactly (checked 2026-10-27, once migration 186 recorded the
 * 2026-09-01 grant).
 */

export type Direction = 'in' | 'out';

export type Category =
  | 'Signings'
  | 'Severance'
  | 'Trades'
  | 'Sales'
  | 'Departures'
  | 'Match Revenue'
  | 'Prizes'
  | "Scout's Fees"
  | 'Solidarity'
  | 'Loans'
  | 'Facilities'
  | 'Grants';

/**
 * Whether a movement changes the league's total money supply or moves money
 * between clubs. `created` is money the league pays in; everything else that
 * leaves a balance is either destroyed or recirculated, and the League view
 * derives destroyed from the change in total supply rather than summing it,
 * because a free-agent bid is partly destroyed and partly recirculated as
 * Solidarity and Scout's Fees.
 */
type Supply = 'created' | 'moved';

interface TypeMeta {
  direction: Direction;
  label: string;
  category: Category;
  supply: Supply;
}

/**
 * Every transaction type that moves money. Types absent here (free-agent
 * pickups, draft picks, the trade row itself) carry no amount and stay off the
 * ledger; the activity feed covers them.
 */
export const TX_META: Record<string, TypeMeta> = {
  waiver_claim:          { direction: 'out', label: 'Auction Win',      category: 'Signings',      supply: 'moved' },
  drop:                  { direction: 'out', label: 'Severance',        category: 'Severance',     supply: 'moved' },
  transfer_out:          { direction: 'in',  label: 'Transfer Out',     category: 'Departures',    supply: 'created' },
  transfer_compensation: { direction: 'in',  label: 'Compensation',     category: 'Departures',    supply: 'created' },
  rebate:                { direction: 'in',  label: "Scout's Fee",      category: "Scout's Fees",  supply: 'moved' },
  prize_payout:          { direction: 'in',  label: 'Prize',            category: 'Prizes',        supply: 'created' },
  merit_payment:         { direction: 'in',  label: 'Match Revenue',    category: 'Match Revenue', supply: 'created' },
  solidarity_payment:    { direction: 'in',  label: 'Solidarity',       category: 'Solidarity',    supply: 'moved' },
  sale_proceeds:         { direction: 'in',  label: 'Sale',             category: 'Sales',         supply: 'moved' },
  loan_fee:              { direction: 'in',  label: 'Loan Fee',         category: 'Loans',         supply: 'moved' },
  loan_bonus:            { direction: 'out', label: 'Loan Bonus',       category: 'Loans',         supply: 'moved' },
  loan_recall_penalty:   { direction: 'out', label: 'Recall Penalty',   category: 'Loans',         supply: 'moved' },
  loan_slot_buyback:     { direction: 'out', label: 'Slot Buyback',     category: 'Loans',         supply: 'moved' },
  facility_upgrade:      { direction: 'out', label: 'Facility Upgrade', category: 'Facilities',    supply: 'moved' },
  grant:                 { direction: 'in',  label: 'League Grant',     category: 'Grants',        supply: 'created' },
};

export interface LedgerPlayer {
  id: string;
  name: string;
  web_name: string | null;
  primary_position: string | null;
  pl_team: string | null;
  photo_url: string | null;
  photo_version: string | null;
  portrait_head_top_pct: number | null;
  portrait_head_width_pct: number | null;
}

export interface TransactionRow {
  id: string;
  type: string;
  faab_bid: number | null;
  compensation_amount: number | string | null;
  notes: string | null;
  processed_at: string;
  player: LedgerPlayer | null;
}

export interface TradeCashRow {
  id: string;
  team_a_id: string;
  team_b_id: string;
  offered_faab: number | null;
  requested_faab: number | null;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  at: string;
  type: string;
  label: string;
  category: Category;
  direction: Direction;
  /** Always positive; `direction` carries the sign. */
  amount: number;
  player: LedgerPlayer | null;
  /** A short second line: the period for Match Revenue, the club for a trade. */
  detail: string | null;
  /** Club Balance once this movement landed. */
  balanceAfter: number;
}

/**
 * A row's money, signed as it was written (only loan fees are ever negative).
 * The auction resolver writes the winning bid to `faab_bid` and
 * any severance to `compensation_amount` on the signing row, and writes the
 * same severance again on its own `drop` row, so reading `faab_bid` first and
 * falling back to `compensation_amount` counts each euro once.
 */
export function rowAmount(row: Pick<TransactionRow, 'faab_bid' | 'compensation_amount'>): number {
  if (row.faab_bid != null && row.faab_bid !== 0) return row.faab_bid;
  return Number(row.compensation_amount ?? 0);
}

/** The ledger's second line for a row with no player. */
function detailFor(row: TransactionRow): string | null {
  const notes = row.notes?.trim();
  if (!notes) return null;
  if (row.type === 'merit_payment') {
    // "Match Revenue — GW5–8 (3W 0D 1L)" → "GW5–8 · 3W 0D 1L"
    const m = /(GW[\d–-]+)\s*\(([^)]+)\)/.exec(notes);
    return m ? `${m[1]} · ${m[2]}` : null;
  }
  if (row.type === 'grant' || row.type === 'prize_payout' || row.type === 'facility_upgrade') return notes;
  return null;
}

/** A signing from another club's listing reads differently from a free-agent win. */
function labelFor(row: TransactionRow, meta: TypeMeta): string {
  if (row.type === 'waiver_claim' && row.notes?.startsWith('Signed ')) return 'Transfer In';
  return meta.label;
}

export interface Ledger {
  /** Oldest first. */
  entries: LedgerEntry[];
  /** The balance before the first entry: what the club started with. */
  opening: number;
  totalIn: number;
  totalOut: number;
  /** Money the league paid this club, as opposed to money from other clubs. */
  created: number;
  byCategory: { category: Category; in: number; out: number }[];
}

export function buildLedger({
  teamId,
  currentBalance,
  transactions,
  trades,
  clubName,
}: {
  teamId: string;
  currentBalance: number;
  transactions: TransactionRow[];
  trades: TradeCashRow[];
  clubName: (teamId: string) => string;
}): Ledger {
  const raw: Omit<LedgerEntry, 'balanceAfter'>[] = [];
  let created = 0;

  for (const row of transactions) {
    const meta = TX_META[row.type];
    if (!meta) continue;
    const value = rowAmount(row);
    if (value === 0) continue;
    // A loan fee is written once per side with the payer's amount negative,
    // so a negative amount runs against the type's usual direction.
    const amount = Math.abs(value);
    const direction: Direction = value > 0 ? meta.direction : meta.direction === 'in' ? 'out' : 'in';
    if (meta.supply === 'created') created += value;
    raw.push({
      id: row.id,
      at: row.processed_at,
      type: row.type,
      label: labelFor(row, meta),
      category: meta.category,
      direction,
      amount,
      player: row.player,
      detail: row.player ? null : detailFor(row),
    });
  }

  for (const t of trades) {
    const offered = Number(t.offered_faab ?? 0);
    const requested = Number(t.requested_faab ?? 0);
    // Team A offered `offered_faab` and asked for `requested_faab`.
    const net = t.team_a_id === teamId ? requested - offered : t.team_b_id === teamId ? offered - requested : 0;
    if (net === 0) continue;
    const other = t.team_a_id === teamId ? t.team_b_id : t.team_a_id;
    raw.push({
      id: `trade-${t.id}`,
      at: t.updated_at,
      type: 'trade_cash',
      label: 'Trade',
      category: 'Trades',
      direction: net > 0 ? 'in' : 'out',
      amount: Math.abs(net),
      player: null,
      detail: `With ${clubName(other)}`,
    });
  }

  raw.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  let totalIn = 0;
  let totalOut = 0;
  const cats = new Map<Category, { in: number; out: number }>();
  for (const e of raw) {
    if (e.direction === 'in') totalIn += e.amount;
    else totalOut += e.amount;
    const c = cats.get(e.category) ?? { in: 0, out: 0 };
    c[e.direction] += e.amount;
    cats.set(e.category, c);
  }

  const opening = currentBalance - totalIn + totalOut;
  let running = opening;
  const entries: LedgerEntry[] = raw.map((e) => {
    running += e.direction === 'in' ? e.amount : -e.amount;
    return { ...e, balanceAfter: running };
  });

  const byCategory = [...cats.entries()]
    .map(([category, v]) => ({ category, in: v.in, out: v.out }))
    .sort((a, b) => b.in + b.out - (a.in + a.out));

  return { entries, opening, totalIn, totalOut, created, byCategory };
}
