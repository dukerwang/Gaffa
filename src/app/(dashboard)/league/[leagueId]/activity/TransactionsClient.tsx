'use client';

import { useMemo, useState } from 'react';

import { getPlayerDisplayName } from '@/lib/players/displayName';
import { playerHoverProps, usePlayerCard } from '@/components/players/PlayerCardProvider';
import PositionBadge from '@/components/players/PositionBadge';
import { useIsClient } from '@/lib/fixtures/formatKickoff';
import {
  registerCounts,
  registerTotals,
  type RegisterEntry,
  type RegisterKind,
  type RegisterPlayer,
  type RegisterTeam,
} from '@/lib/transactions/buildRegister';
import type { GranularPosition } from '@/types';
import styles from './transactions.module.css';

/**
 * A season as a window in time. `transactions` carries no season column, so the
 * page slices by date instead; see the derivation in `page.tsx`.
 */
export interface SeasonWindow {
  season: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface Props {
  leagueName: string;
  myTeamId: string | null;
  entries: RegisterEntry[];
  teams: RegisterTeam[];
  seasons: SeasonWindow[];
}

type Filter = 'all' | RegisterKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'signing', label: 'Signings' },
  { key: 'departure', label: 'Departures' },
  { key: 'trade', label: 'Trades' },
  { key: 'loan', label: 'Loans' },
];

const money = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(1)}m`;

// ─── Day grouping ─────────────────────────────────────────────────────────────

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);

  const long = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  if (days === 0) return `Today · ${long}`;
  if (days === 1) return `Yesterday · ${long}`;
  if (days < 7) return long;
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

function clockLabel(iso: string) {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/ /g, ' ');
}

// ─── Player name, clickable ───────────────────────────────────────────────────

function PlayerName({
  player,
  className,
}: {
  player: RegisterPlayer;
  className?: string;
}) {
  const { openPlayerById, prefetchPlayer } = usePlayerCard();
  return (
    <button
      type="button"
      className={className ?? 'playercard-clickable-btn'}
      onClick={() => openPlayerById(player.id)}
      {...playerHoverProps(prefetchPlayer, player)}
    >
      {getPlayerDisplayName(player, 'full')}
    </button>
  );
}

/**
 * The position, inside the sentence rather than beside it. It sits on the text
 * baseline so it reads as part of the player's name — the same badge the squad
 * and auction surfaces use, including the clipped corner that separates LB from
 * RB without relying on hue.
 */
function InlinePosition({ position }: { position: string }) {
  return (
    <span className={styles.posMark}>
      <PositionBadge position={position as GranularPosition} size="sm" />
    </span>
  );
}

// ─── One row ──────────────────────────────────────────────────────────────────

function Row({ entry, mine }: { entry: RegisterEntry; mine: boolean }) {
  const { money: m } = entry;

  return (
    <article className={`${styles.row} ${mine ? styles.rowMine : ''}`}>
      <div className={styles.body}>
        <div className={styles.line}>
          <span className={styles.club}>{entry.club}</span>{' '}
          {entry.club2 && (
            <>
              <span className={styles.verb}>and</span>{' '}
              <span className={styles.club}>{entry.club2}</span>{' '}
            </>
          )}
          <span className={styles.verb}>{entry.verb}</span>
          {entry.player && (
            <>
              {' '}
              <InlinePosition position={entry.player.primary_position} />
              <PlayerName player={entry.player} className={styles.player} />
            </>
          )}
          {entry.tail && (
            <>
              {' '}
              <span className={styles.verb}>{entry.tail}</span>
            </>
          )}
        </div>

        {entry.meta && <div className={styles.meta}>{entry.meta}</div>}

        {entry.subs.map((sub, i) => (
          <div key={i} className={styles.sub}>
            {sub.player ? (
              <PlayerName player={sub.player} className={styles.subPlayer} />
            ) : (
              <span className={styles.subPlayer}>A player</span>
            )}
            {sub.text && <span> · {sub.text}</span>}
          </div>
        ))}
      </div>

      <div className={styles.fee}>
        {m.text ? (
          <>
            <div
              className={`${styles.feeV} ${
                m.tone === 'in' ? styles.feeIn : m.tone === 'out' ? styles.feeOut : ''
              }`}
            >
              {m.text}
            </div>
            {m.label && <div className={styles.feeS}>{m.label}</div>}
          </>
        ) : (
          <div className={styles.feeNone}>{m.none}</div>
        )}
      </div>

      <div className={styles.when} suppressHydrationWarning>
        {clockLabel(entry.at)}
      </div>
    </article>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function TransactionsClient({
  leagueName,
  myTeamId,
  entries,
  teams,
  seasons,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [club, setClub] = useState<string>('all');
  const [season, setSeason] = useState<string>(seasons[0]?.season ?? '');
  const [query, setQuery] = useState('');

  // Grouping boundaries depend on the reader's timezone, so the pre-mount pass
  // groups in UTC and the subtree is remounted once the real zone is known
  // rather than reconciled against a different shape.
  const isClient = useIsClient();

  const window = seasons.find((s) => s.season === season) ?? null;

  /** Everything the season and club filters allow — the counts are read off this. */
  const inScope = useMemo(() => {
    return entries.filter((e) => {
      if (window) {
        const t = Date.parse(e.at);
        if (window.startsAt && t < Date.parse(window.startsAt)) return false;
        if (window.endsAt && t >= Date.parse(window.endsAt)) return false;
      }
      if (club !== 'all' && !e.clubIds.includes(club)) return false;
      return true;
    });
  }, [entries, window, club]);

  const counts = useMemo(() => registerCounts(inScope), [inScope]);
  const totals = useMemo(() => registerTotals(inScope), [inScope]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inScope.filter((e) => {
      if (filter !== 'all' && e.kind !== filter) return false;
      if (q && !e.haystack.includes(q)) return false;
      return true;
    });
  }, [inScope, filter, query]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: RegisterEntry[] }[] = [];
    for (const e of visible) {
      const key = dayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, label: dayLabel(e.at), items: [e] });
    }
    return out;
  }, [visible]);

  return (
    <div className={styles.page}>
      {/* ── The bar ──────────────────────────────────────────────
          The page names itself at control scale rather than as a display
          heading restating the nav above it, and the season's counts ride on
          the filters so a number is something to press, not just to read. */}
      <div className={styles.bar}>
        <div className={styles.barTop}>
          <h1 className={styles.barName}>Transactions</h1>
          <span className={styles.barDiv} />

          <div className={styles.segs} role="group" aria-label="Filter by kind">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={filter === key ? styles.segOn : styles.seg}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
              >
                {label} <span className={styles.segN}>{counts[key === 'all' ? 'all' : key]}</span>
              </button>
            ))}
          </div>

          <span className={styles.spacer} />

          <label className={styles.search}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.6-3.6" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              value={query}
              placeholder="Search players or clubs"
              aria-label="Search players or clubs"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className={styles.selWrap}>
            <select
              className={styles.sel}
              value={club}
              aria-label="Filter by club"
              onChange={(e) => setClub(e.target.value)}
            >
              <option value="all">All clubs</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team_name}
                </option>
              ))}
            </select>
            <Caret />
          </div>

          {seasons.length > 1 ? (
            <div className={styles.selWrap}>
              <select
                className={`${styles.sel} ${styles.selStrong}`}
                value={season}
                aria-label="Season"
                onChange={(e) => setSeason(e.target.value)}
              >
                {seasons.map((s) => (
                  <option key={s.season} value={s.season}>
                    {s.season}
                  </option>
                ))}
              </select>
              <Caret />
            </div>
          ) : (
            <span className={styles.seasonLabel}>{season}</span>
          )}
        </div>

        <div className={styles.barRead}>
          <span className={styles.readV}>{money(totals.spent)}</span> spent on fees
          {totals.biggestFee > 0 && (
            <>
              <span className={styles.readDot}>·</span>
              biggest <span className={styles.readV}>{money(totals.biggestFee)}</span>
              {totals.biggestFeePlayer ? ` for ${totals.biggestFeePlayer}` : ''}
            </>
          )}
          <span className={styles.readDot}>·</span>
          <span className={styles.readV}>{totals.departures}</span>{' '}
          {totals.departures === 1 ? 'departure' : 'departures'}
          {totals.returned > 0 && (
            <>
              {' returned '}
              <span className={styles.readV}>{money(totals.returned)}</span>
            </>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>
          {entries.length === 0
            ? `No player has changed hands in ${leagueName} yet.`
            : 'Nothing matches these filters.'}
        </p>
      ) : (
        <div key={isClient ? 'local' : 'utc'} className={styles.feed}>
          {groups.map((g) => (
            <section key={g.key}>
              <div className={styles.day}>
                <span className={styles.dayL} suppressHydrationWarning>
                  {g.label}
                </span>
                <span className={styles.dayRule} />
                <span className={styles.dayN}>
                  {g.items.length} {g.items.length === 1 ? 'transaction' : 'transactions'}
                </span>
              </div>
              {g.items.map((e) => (
                <Row
                  key={e.id}
                  entry={e}
                  mine={!!myTeamId && e.clubIds.includes(myTeamId)}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Caret() {
  return (
    <svg
      className={styles.caret}
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
