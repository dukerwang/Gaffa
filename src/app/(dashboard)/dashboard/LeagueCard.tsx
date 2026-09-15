import type { CSSProperties } from 'react';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import NavigationLink from '@/components/ui/NavigationLink';
import { Button } from '@/components/ui/Button';
import type { CardSide, LeagueCardModel, MatchCardModel } from '@/lib/dashboard/buildDashboardModel';
import LocalTime from './LocalTime';
import styles from './dashboard.module.css';

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function sideMeta(side: CardSide): string {
  const who = side.manager ?? 'You';
  const standing = [side.rank ? ordinal(side.rank) : null, side.record].filter(Boolean).join(', ');
  return standing ? `${who} · ${standing}` : who;
}

function StatusLabel({ card }: { card: LeagueCardModel }) {
  const m = card.match;
  if (m?.state === 'live') {
    return (
      <span className={styles.statusLive}>
        <span className={styles.liveDot} aria-hidden="true" />
        Live
      </span>
    );
  }
  if (m?.state === 'provisional') return <span className={styles.status}>Provisional</span>;
  if (m?.state === 'final') return <span className={styles.status}>Final</span>;
  if (m?.state === 'upcoming') return <span className={styles.status}>MW{m.gameweek}</span>;
  if (card.kind === 'drafting') {
    return card.drafting?.isMyTurn
      ? <span className={styles.statusAccent}>Your Pick</span>
      : <span className={styles.status}>Drafting</span>;
  }
  if (card.kind === 'setup') return <span className={styles.status}>Pre-Draft</span>;
  return <span className={styles.status}>Offseason</span>;
}

function Side({ side, score, trailing }: { side: CardSide; score: number | null; trailing: boolean }) {
  return (
    <div className={styles.side}>
      <CrestBadge config={side.crest as CrestConfig | null} size={32} teamName={side.name} teamId={side.teamId} />
      <div className={styles.sideTx}>
        <div className={styles.sideName}>{side.name}</div>
        <div className={styles.sideMeta}>{sideMeta(side)}</div>
      </div>
      {score !== null && <span className={trailing ? styles.scoreTrail : styles.score}>{score.toFixed(1)}</span>}
    </div>
  );
}

function MatchBody({ leagueId, m }: { leagueId: string; m: MatchCardModel }) {
  const toneClass =
    m.tone === 'ahead' ? styles.toneAhead : m.tone === 'behind' ? styles.toneBehind : styles.toneLevel;
  const mineTrails = m.mineScore !== null && m.theirScore !== null && m.mineScore < m.theirScore;
  const theirsTrail = m.mineScore !== null && m.theirScore !== null && m.theirScore < m.mineScore;
  const matchupHref = `/league/${leagueId}/matchups/${m.matchupId}`;

  return (
    <div className={`${styles.cardBody} ${toneClass}`}>
      <Side side={m.mine} score={m.mineScore} trailing={mineTrails} />
      <Side side={m.theirs} score={m.theirScore} trailing={theirsTrail} />

      {m.sharePct !== null && (
        <div className={styles.share} role="img" aria-label={`You have ${Math.round(m.sharePct)}% of the combined score`}>
          <div className={styles.shareMine} style={{ width: `${m.sharePct}%` }} />
          <div className={styles.shareGap} />
          <div className={styles.shareTheirs} />
        </div>
      )}

      <div className={styles.cardFoot}>
        {m.state === 'upcoming' ? (
          <>
            <span className={styles.verdict}>
              {m.deadline ? <LocalTime iso={m.deadline} variant="dayTime" prefix="Deadline " /> : `Matchweek ${m.gameweek}`}
            </span>
            <span className={styles.footMeta}>Matchweek {m.gameweek}</span>
          </>
        ) : (
          <>
            <span className={styles.verdict}>{m.verdict}</span>
            <span className={styles.footMeta}>
              {m.playersLeft
                ? `${m.playersLeft.mine} players left · ${m.playersLeft.theirs} for them`
                : `Matchweek ${m.gameweek}`}
            </span>
          </>
        )}
      </div>

      <div className={styles.cardActions}>
        {m.state === 'upcoming' ? (
          <>
            <Button href={matchupHref} variant="secondary" className={styles.cardBtn}>Matchup</Button>
            <Button href={`/league/${leagueId}/team`} variant="primary" className={styles.cardBtn}>Set Lineup</Button>
          </>
        ) : (
          <>
            <Button href={`/league/${leagueId}/team`} variant="secondary" className={styles.cardBtn}>My Squad</Button>
            <Button href={matchupHref} variant="primary" className={styles.cardBtn}>Matchup</Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LeagueCard({ card }: { card: LeagueCardModel }) {
  const leagueHref = `/league/${card.leagueId}`;
  const m = card.match;

  return (
    <article className={styles.card} aria-label={card.leagueName}>
      {m && (
        <div className={styles.watermark} aria-hidden="true">
          <CrestBadge config={m.mine.crest as CrestConfig | null} size={190} teamName={m.mine.name} interactive={false} />
        </div>
      )}

      <NavigationLink href={leagueHref} className={styles.cardBar}>
        <span className={styles.leagueTile} style={{ '--tile': card.leagueColor } as CSSProperties} aria-hidden="true">
          {card.leagueInitials}
        </span>
        <span className={styles.leagueName}>{card.leagueName}</span>
        <StatusLabel card={card} />
      </NavigationLink>

      {m && <MatchBody leagueId={card.leagueId} m={m} />}

      {card.drafting && (
        <div className={styles.cardBody}>
          <div className={styles.stateRow}>
            <div>
              <div className={styles.stateLabel}>
                Round {card.drafting.round}
                {card.drafting.totalRounds ? ` of ${card.drafting.totalRounds}` : ''}
              </div>
              {card.drafting.isMyTurn ? (
                <div className={styles.stateAccent}>You&rsquo;re on the clock</div>
              ) : (
                <div className={styles.sideMeta}>Pick {card.drafting.pick}</div>
              )}
            </div>
          </div>
          <div className={styles.cardActionsOne}>
            <Button href={`/league/${card.leagueId}/draft`} variant="primary" className={styles.cardBtn}>
              Enter Draft Room
            </Button>
          </div>
        </div>
      )}

      {card.setup && (
        <div className={styles.cardBody}>
          <div className={styles.stateRow}>
            <div>
              <div className={styles.stateLabel}>Managers Joined</div>
              <div className={styles.sideMeta}>
                {card.setup.isCommissioner ? 'You’re the commissioner' : 'Waiting on the commissioner'}
              </div>
            </div>
            <span className={styles.stateFig}>
              {card.setup.joined} / {card.setup.max}
            </span>
          </div>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{ width: `${card.setup.max ? Math.min(100, (card.setup.joined / card.setup.max) * 100) : 0}%` }}
            />
          </div>
          <div className={styles.cardActionsOne}>
            <Button href={leagueHref} variant="secondary" className={styles.cardBtn}>
              {card.setup.isCommissioner ? 'Invite Managers' : 'View League'}
            </Button>
          </div>
        </div>
      )}

      {card.offseason && (
        <div className={styles.cardBody}>
          <div className={styles.stateRow}>
            <div className={styles.stateLabel}>Final Position</div>
            <span className={styles.stateFig}>{card.offseason.rank ? ordinal(card.offseason.rank) : '—'}</span>
          </div>
          <div className={styles.cardActionsOne}>
            <Button href={leagueHref} variant="secondary" className={styles.cardBtn}>View League</Button>
          </div>
        </div>
      )}
    </article>
  );
}
