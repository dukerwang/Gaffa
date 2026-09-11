'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  TransfersModel,
  TransfersTarget,
  TransfersListing,
  TransfersAuction,
} from '@/lib/transfers/buildTransfersModel';
import type { Player } from '@/types';
import { usePlayerCard } from '@/components/players/PlayerCardProvider';
import TransfersSubNav from '@/components/transfers/TransfersSubNav';
import TargetRow from '@/components/transfers/TargetRow';
import TargetEditor from '@/components/transfers/TargetEditor';
import BidDialog from '@/components/transfers/BidDialog';
import ProposeBuilder from '@/components/transfers/ProposeBuilder';
import ListingEditor from '@/components/transfers/ListingEditor';
import { setServerClock } from '@/components/transfers/useTick';
import { useLiveTransfers } from '@/components/transfers/useLiveTransfers';
import { playersAnswering } from '@/lib/transfers/answerTarget';
import { MAX_ACTIVE_TARGETS } from '@/lib/transfers/targetLimits';
import styles from './targets.module.css';
import { fold } from '@/lib/text/fold';

/**
 * The Targets Board — demand from clubs, on its own page.
 *
 * THREE SECTIONS, NOT A GRID. The board's job is to tell you why a row is in
 * front of you before you read it, and the only question that reorders this
 * page usefully is "is any of this about me?". So: what you could answer from
 * your own squad, what everybody else is after, and what you're chasing.
 *
 * The section rule and the row's buttons are the SAME call — `canAnswerTarget`,
 * used once per row and passed to both. An earlier draft applied it by hand in
 * two places and immediately disagreed with itself, putting rows under "Wanted
 * From You" with nothing to press.
 *
 * The facets are properties of demand — who's asking, what they'd give, what
 * they'd spend — where Listings' are properties of supply. That asymmetry is
 * the reason these are two boards and not one with a mode toggle.
 */

type Facet = 'all' | 'wanted' | 'named' | 'roles' | 'cash' | 'players' | 'loan' | 'mine';
type Sort = 'newest' | 'budget' | 'position';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'budget', label: 'Biggest budget' },
  { key: 'position', label: 'Position' },
];

export default function TargetsClient({
  leagueId,
  initial,
}: {
  leagueId: string;
  initial: TransfersModel;
}) {
  const router = useRouter();
  const model = useLiveTransfers(leagueId, initial);
  const { openPlayer, primePlayers } = usePlayerCard();

  const [editing, setEditing] = useState<TransfersTarget | null | 'new'>(null);
  const [offer, setOffer] = useState<{ teamId: string; giveIds: string[] } | null>(null);
  const [listing, setListing] = useState<string | null>(null);
  const [bid, setBid] = useState<TransfersListing | null>(null);
  const refresh = () => router.refresh();

  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('');
  const [club, setClub] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [facet, setFacet] = useState<Facet>('all');

  useEffect(() => { setServerClock(model.serverNow); }, [model.serverNow]);

  // Seed the player-card cache so opening a card costs no request.
  useEffect(() => {
    const rows = model.targets.map((t) => t.player).filter(Boolean) as unknown as Player[];
    if (rows.length) primePlayers(rows);
  }, [model.targets, primePlayers]);

  const myTeamId = model.myTeam.id;

  // Who holds each rostered player, for the "whose he is" line on a named
  // target and for deciding whether a direct target was aimed at me.
  const ownerByPlayer = useMemo(() => {
    const m = new Map<string, { teamId: string; teamName: string | null }>();
    for (const [teamId, roster] of Object.entries(model.allRosters)) {
      const teamName = model.allTeams.find((t) => t.id === teamId)?.team_name ?? null;
      for (const p of roster) {
        // A loaned player sits on two rosters. The lender is the club that can
        // actually sell him, so a borrower's entry never overwrites one already
        // recorded — allRosters lists the holding club first either way.
        if (!m.has(p.id)) m.set(p.id, { teamId, teamName });
      }
    }
    return m;
  }, [model.allRosters, model.allTeams]);

  const listingByPlayer = useMemo(
    () => new Map(model.listings.map((l) => [l.player_id, l])),
    [model.listings],
  );

  const auctionByListing = useMemo(() => {
    const m = new Map<string, TransfersAuction>();
    for (const a of model.auctions) if (a.sale_listing_id) m.set(a.sale_listing_id, a);
    return m;
  }, [model.auctions]);

  /**
   * Everything the board needs to know about one target, computed once.
   *
   * `canAnswer` in particular: it decides the section AND the buttons, and
   * deriving it twice is how those two came apart last time.
   */
  const rows = useMemo(() => {
    return model.targets.map((t) => {
      const isMine = t.team_id === myTeamId;
      const answerers = playersAnswering(
        { team_id: t.team_id, target_kind: t.target_kind, player_id: t.player_id, position: t.position },
        myTeamId,
        model.myRoster,
      );
      const owner = t.player_id ? ownerByPlayer.get(t.player_id) ?? null : null;
      const matched = isMine && t.player_id ? listingByPlayer.get(t.player_id) ?? null : null;

      return {
        target: t,
        isMine,
        canAnswer: answerers.length > 0,
        answerers,
        ownerName: owner?.teamName ?? null,
        ownerTeamId: owner?.teamId ?? null,
        // A direct target reaches me only because I hold the player, which the
        // server already enforced — this is how the row knows to say so.
        sentToMe: !isMine && t.visibility === 'direct',
        matchedListing: matched,
        matchedAuction: matched ? auctionByListing.get(matched.id) ?? null : null,
      };
    });
  }, [model.targets, model.myRoster, myTeamId, ownerByPlayer, listingByPlayer, auctionByListing]);

  type Row = (typeof rows)[number];

  const matches = (r: Row, f: Facet) => {
    switch (f) {
      case 'all': return true;
      case 'wanted': return !r.isMine && r.canAnswer;
      case 'named': return r.target.target_kind === 'player';
      case 'roles': return r.target.target_kind === 'profile';
      case 'cash': return r.target.open_to_sale;
      case 'players': return r.target.open_to_trade;
      case 'loan': return r.target.open_to_loan;
      case 'mine': return r.isMine;
    }
  };

  const positions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const p = r.target.target_kind === 'player'
        ? r.target.player?.primary_position
        : r.target.position;
      if (p) s.add(p);
    }
    return Array.from(s).sort();
  }, [rows]);

  const clubs = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.target.team_name) s.add(r.target.team_name);
    return Array.from(s).sort();
  }, [rows]);

  const visible = useMemo(() => {
    const q = fold(query);

    const filtered = rows.filter((r) => {
      const t = r.target;
      const pos = t.target_kind === 'player' ? t.player?.primary_position : t.position;
      if (position && pos !== position) return false;
      if (club && t.team_name !== club) return false;
      if (!matches(r, facet)) return false;
      if (q) {
        const hay = fold([
          t.player?.name ?? '',
          t.player?.web_name ?? '',
          t.player?.pl_team ?? '',
          t.team_name ?? '',
          t.position ?? '',
          t.role ?? '',
          t.note ?? '',
        ].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const far = Number.MAX_SAFE_INTEGER;
    return filtered.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.target.created_at).getTime() - new Date(a.target.created_at).getTime();
        // A target with no stated budget has no budget at all, not the lowest
        // one — it sorts last in either direction, the way an unpriced listing
        // does next door.
        case 'budget':
          return (b.target.budget ?? -1) - (a.target.budget ?? -1);
        case 'position': {
          const pa = (a.target.target_kind === 'player' ? a.target.player?.primary_position : a.target.position) ?? '';
          const pb = (b.target.target_kind === 'player' ? b.target.player?.primary_position : b.target.position) ?? '';
          return pa.localeCompare(pb) || (far - far);
        }
      }
    });
    // `matches` closes over the same inputs already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, position, club, facet, sort]);

  // The three sections, cut from the same filtered list so the facets and the
  // search apply inside them rather than around them.
  const wanted = visible.filter((r) => !r.isMine && r.canAnswer);
  const board = visible.filter((r) => !r.isMine && !r.canAnswer);
  const mine = visible.filter((r) => r.isMine);

  const count = (f: Facet) => rows.filter((r) => matches(r, f)).length;
  const myLive = rows.filter((r) => r.isMine).length;
  const atCap = myLive >= MAX_ACTIVE_TARGETS;

  const facets: { key: Facet; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--color-text-primary)' },
    // The one facet worth a colour: it is the answer to "is any of this about
    // me". --color-warning-text, not --color-warning — the fill measures 2.09
    // as an ink and has no dark value.
    { key: 'wanted', label: 'Wanted from you', color: 'var(--color-warning-text)' },
    { key: 'named', label: 'Named', color: 'var(--color-text-secondary)' },
    { key: 'roles', label: 'Roles', color: 'var(--color-text-secondary)' },
    { key: 'cash', label: 'Will pay cash', color: 'var(--color-accent-ink)' },
    { key: 'players', label: 'Offering players', color: 'var(--color-text-secondary)' },
    { key: 'loan', label: 'Takes loans', color: 'var(--color-text-secondary)' },
    { key: 'mine', label: 'Yours', color: 'var(--color-text-muted)' },
  ];

  const section = (
    title: string,
    hint: string,
    list: Row[],
    emptyLine: string,
  ) => (
    <>
      <div className={styles.sect}>
        <h2 className={styles.sectTitle}>{title}</h2>
        <span className={styles.sectHint}>{hint}</span>
      </div>
      {list.length === 0 ? (
        <p className={styles.sectEmpty}>{emptyLine}</p>
      ) : (
        list.map((r, i) => (
          <TargetRow
            key={r.target.id}
            target={r.target}
            isMine={r.isMine}
            canAnswer={r.canAnswer}
            matchedListing={r.matchedListing}
            matchedAuction={r.matchedAuction}
            sentToMe={r.sentToMe}
            ownerName={r.ownerName}
            last={i === list.length - 1}
            onOpenPlayer={r.target.player ? () => openPlayer(r.target.player as unknown as Player) : undefined}
            onOffer={() => setOffer({ teamId: r.target.team_id, giveIds: r.answerers.slice(0, 1).map((p) => p.id) })}
            onList={() => setListing(r.answerers[0]?.id ?? null)}
            onMessage={() => {
              window.dispatchEvent(new Event('navigation-start'));
              router.push(`/league/${leagueId}/chat?dm=${r.target.team_id}`);
            }}
            onBid={() => r.matchedListing && setBid(r.matchedListing)}
            onEdit={() => setEditing(r.target)}
            onWithdraw={() => setEditing(r.target)}
          />
        ))
      )}
    </>
  );

  return (
    <div className={styles.page}>
      <TransfersSubNav leagueId={leagueId} counts={model.counts} />

      <header className={styles.header}>
        <div>
          <div className={`g-label ${styles.kicker}`}>Transfer Market → Targets</div>
          <h1 className={styles.title}>The Targets Board</h1>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={`${styles.statValue} ${styles.statAccent}`}>€{model.myTeam.faab_budget}m</div>
            <div className={`g-label-quiet ${styles.statLabel}`}>Club Balance</div>
          </div>
          <div className={styles.stat}>
            <div className={`${styles.statValue} ${styles.statWarn}`}>{count('wanted')}</div>
            <div className={`g-label-quiet ${styles.statLabel}`}>Wanted from you</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{rows.filter((r) => !r.isMine).length}</div>
            <div className={`g-label-quiet ${styles.statLabel}`}>On the board</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{myLive}</div>
            <div className={`g-label-quiet ${styles.statLabel}`}>Yours</div>
          </div>
        </div>
      </header>

      <div className={styles.tools}>
        <div className={styles.searchRow}>
          <input
            className={styles.input}
            placeholder="Search targets by player, position or club…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search targets"
          />
          <select className={styles.select} value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Filter by position">
            <option value="">Any position</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={styles.select} value={club} onChange={(e) => setClub(e.target.value)} aria-label="Filter by club">
            <option value="">Any club</option>
            {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort targets">
            {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
          </select>
          <button
            type="button"
            className={styles.cta}
            onClick={() => setEditing('new')}
            disabled={atCap}
            title={atCap ? `You're tracking ${MAX_ACTIVE_TARGETS} targets already. Withdraw one to add another.` : undefined}
          >
            + Add Target
          </button>
        </div>

        <div className={styles.facets}>
          {facets.map((f) => {
            const n = count(f.key);
            return (
              <button
                key={f.key}
                type="button"
                className={`${styles.facet} ${facet === f.key ? styles.facetOn : ''}`}
                style={facet === f.key ? { background: f.color, borderColor: f.color } : { color: f.color }}
                onClick={() => setFacet(f.key)}
              >
                {f.label} <span className={styles.facetCount}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {model.targets.length === 0 ? (
        <p className={styles.empty}>
          No club has posted a target yet. Post one and the rest of the league can see what
          you&rsquo;re after.
        </p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>No target matches those filters.</p>
      ) : (
        <div className={styles.board}>
          {section(
            'Wanted From You',
            'Targets you can answer from your squad',
            wanted,
            'Nothing on the board asks for a player you hold.',
          )}
          <div className={styles.sectGap} />
          {section(
            'The Board',
            'What every other club is after',
            board,
            'No other club is advertising a target right now.',
          )}
          <div className={styles.sectGap} />
          {section(
            'Your Targets',
            "Everything you're chasing",
            mine,
            "You haven't posted a target yet.",
          )}
        </div>
      )}

      {editing && (
        <TargetEditor
          open
          onClose={() => setEditing(null)}
          leagueId={leagueId}
          model={model}
          target={editing === 'new' ? null : editing}
          onDone={refresh}
        />
      )}

      {offer && (
        <ProposeBuilder
          open
          onClose={() => setOffer(null)}
          leagueId={leagueId}
          model={model}
          initialMode="offer"
          initialTeamId={offer.teamId}
          initialGiveIds={offer.giveIds}
          onDone={refresh}
        />
      )}

      {listing && (
        <ListingEditor
          open
          onClose={() => setListing(null)}
          leagueId={leagueId}
          listing={null}
          myRoster={model.myRoster}
          initialPlayerId={listing}
          targets={model.targets}
          myTeamId={model.myTeam.id}
          onDone={refresh}
        />
      )}

      {bid?.player && (
        <BidDialog
          open
          onClose={() => setBid(null)}
          leagueId={leagueId}
          player={bid.player}
          auction={auctionByListing.get(bid.id) ?? null}
          listing={bid}
          mode="bid"
          budget={model.myTeam.faab_budget}
          committedTotal={model.auctions.reduce((s, a) => s + (a.my_bid != null && a.my_bid > 0 ? a.my_bid : 0), 0)}
          openBidCount={model.auctions.filter((a) => a.my_bid != null && a.my_bid > 0).length}
          rosterFull={model.rosterFull}
          myRoster={model.myRoster}
          academy={model.academy}
          bidFloor={model.league.free_agent_bid_floor ?? 0.5}
          onDone={refresh}
        />
      )}
    </div>
  );
}
