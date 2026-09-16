'use client';

import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import PositionBadge from '@/components/players/PositionBadge';
import { useLeagueChat } from '@/components/chat/LeagueChatContext';
import type { CrestConfig } from '@/components/crest/types';
import type { GranularPosition } from '@/types';
import type {
  CoverGap,
  HomeClub,
  HomeFixtureModel,
  HomeModel,
  OpponentCard,
  XiSlot,
  BenchPlayer,
  DebriefItem,
} from '@/lib/home/buildHomeModel';
import styles from './home.module.css';

/**
 * Your two fixtures, side by side.
 *
 * The page used to show one of them and put the other behind a tab pair
 * labelled "Last week / Up next". The tab was there because both fixtures
 * wanted the same slot, and it cost the page the one question a manager
 * actually opens Home to answer before a deadline — is my lineup right —
 * every time the phase machine chose to show the result instead.
 *
 * So both are on screen. The phase decides which is the LEAD (wide, with the
 * report and the debrief) and which is the ASIDE (narrow, the essentials),
 * and a live match takes the row on its own because there is nothing to set
 * while it is being played.
 */

interface Side {
  fixture: HomeFixtureModel;
  played: boolean;
  xi: XiSlot[];
  xiFlags: string[];
  xiSummary: string;
  coverGaps: CoverGap[];
  bench: BenchPlayer[];
  debrief: DebriefItem[];
  opponent: OpponentCard | null;
}

function sides(model: HomeModel): { lead: Side | null; aside: Side | null } {
  const primary: Side | null = model.fixture
    ? {
        fixture: model.fixture,
        played: model.heroPlayed,
        xi: model.xi,
        xiFlags: model.xiFlags,
        xiSummary: model.xiSummary,
        coverGaps: model.coverGaps,
        bench: model.benchSummary,
        debrief: model.debrief,
        opponent: model.opponent,
      }
    : null;

  const secondary: Side | null = model.secondaryFixture
    ? {
        fixture: model.secondaryFixture,
        played: model.secondaryPlayed,
        xi: model.secondaryXi,
        xiFlags: model.secondaryXiFlags,
        xiSummary: model.secondaryXiSummary,
        coverGaps: model.secondaryCoverGaps,
        bench: model.secondaryBenchSummary,
        debrief: model.secondaryDebrief,
        opponent: model.secondaryOpponent,
      }
    : null;

  // Live: the match being played owns the row.
  if (model.phase === 'live') return { lead: primary, aside: null };

  const settled = [primary, secondary].find((s) => s?.played) ?? null;
  const upcoming = [primary, secondary].find((s) => s && !s.played) ?? null;

  // Before a deadline the fixture you can still change leads. Afterwards the
  // result does, because there is nothing left to do about it but read it.
  if (model.phase === 'buildup') return { lead: upcoming ?? settled, aside: upcoming ? settled : null };
  return { lead: settled ?? upcoming, aside: settled ? upcoming : null };
}

function Team({
  club,
  meta,
  score,
  dim,
  size,
}: {
  club: HomeClub;
  meta: string;
  score: number | null;
  dim: boolean;
  size: 'lead' | 'aside';
}) {
  return (
    <div className={styles.mTeam}>
      <CrestBadge
        config={club.crest as CrestConfig | null}
        size={size === 'lead' ? 34 : 26}
        teamName={club.name}
        teamId={club.id}
      />
      <div className={styles.mTeamTx}>
        <div className={styles.mTeamName}>{club.name}</div>
        <div className={styles.mTeamMeta}>{meta}</div>
      </div>
      {score !== null && (
        <span className={dim ? styles.mScoreDim : styles.mScore}>{score.toFixed(2)}</span>
      )}
    </div>
  );
}

function StatusChip({ fixture, played, live }: { fixture: HomeFixtureModel; played: boolean; live: boolean }) {
  if (live) {
    return (
      <span className={styles.mLive}>
        <span className={styles.mLiveDot} aria-hidden="true" />
        In Play
      </span>
    );
  }
  if (!played) return <span className={styles.mStatus}>Not Yet Locked</span>;
  return (
    <span className={fixture.outcome === 'ahead' ? styles.mStatusWin : styles.mStatus}>
      {fixture.outcome === 'ahead' ? 'Won' : fixture.outcome === 'behind' ? 'Lost' : 'Drawn'}
    </span>
  );
}

/** How much of the combined score is yours, as one bar. */
function Share({ fixture }: { fixture: HomeFixtureModel }) {
  const home = fixture.homeScore ?? 0;
  const away = fixture.awayScore ?? 0;
  const total = home + away;
  if (total <= 0) return null;
  const pct = (home / total) * 100;
  return (
    <div
      className={styles.share}
      role="img"
      aria-label={`${fixture.home.name} have ${Math.round(pct)}% of the combined score`}
    >
      <div className={styles.shareA} style={{ width: `${pct}%` }} />
      <div className={styles.shareB} />
    </div>
  );
}

function Xi({ side, compact }: { side: Side; compact: boolean }) {
  if (side.xi.length === 0) return null;
  const flagged = side.xi.filter((s) => s.state === 'flag').length;
  const locked = side.xi.filter((s) => s.state === 'locked').length;

  return (
    <div className={styles.xi}>
      <div className={styles.xiHd}>
        <span className={styles.xiT}>Your XI</span>
        <span className={styles.xiMeter} aria-hidden="true">
          {side.xi.map((s, i) => (
            <span
              key={i}
              className={
                s.state === 'flag' ? styles.xiTickFlag : s.state === 'locked' ? styles.xiTickLocked : styles.xiTick
              }
            />
          ))}
        </span>
        <span className={styles.xiS}>{side.xiSummary}</span>
      </div>

      {!compact && (
        <div className={styles.xiGrid}>
          {side.xi.map((slot, i) => (
            <span key={`${slot.playerId}-${i}`} className={`g-namerow ${styles.xiCell}`}>
              <PositionBadge position={slot.slot as GranularPosition} size="sm" />
              <span
                className={
                  slot.state === 'flag'
                    ? styles.xiNameFlag
                    : slot.state === 'locked'
                      ? styles.xiNameLocked
                      : styles.xiName
                }
                title={slot.note ?? undefined}
              >
                {slot.name}
              </span>
            </span>
          ))}
        </div>
      )}

      {compact && (flagged > 0 || locked === side.xi.length) && (
        <div className={styles.xiS}>
          {flagged > 0 ? `${flagged} doubtful` : 'Every player locked'}
        </div>
      )}

      {side.xiFlags.length > 0 && !compact && (
        <div className={styles.xiFlags}>
          {side.xiFlags.slice(0, 3).map((flag, i) => (
            <span key={i} className={styles.xiFlag}>
              {flag}
            </span>
          ))}
        </div>
      )}

      {/* A cover gap is a RISK, not a mistake, and it is only real if that
          starter records zero minutes. Stating the consequence and then
          showing the bench that produces it is the difference between a rule
          the reader learns and an error message they distrust — the bench
          categories (DEF/MID/ATT/FLEX) decide where a player sits, never what
          he can cover. */}
      {side.coverGaps.length > 0 && (
        <div className={styles.cover}>
          <div className={styles.coverLead}>
            {side.coverGaps.length === 1 ? (
              <>
                <b>
                  {side.coverGaps[0].starter} is doubtful and nobody on your bench can fill{' '}
                  {side.coverGaps[0].slot}
                </b>{' '}
                — if he records no minutes, that slot scores nothing.
              </>
            ) : (
              <>
                <b>{side.coverGaps.map((g) => `${g.starter} (${g.slot})`).join(', ')}</b> are doubtful
                with no eligible cover on your bench — any of those slots scores nothing if the
                starter does not play.
              </>
            )}
          </div>
          {!compact && side.bench.length > 0 && (
            <div className={styles.coverBench}>
              Your bench: {side.bench.map((b) => `${b.name} (${b.positions.join('/')})`).join(', ')}. A
              substitute has to match the slot exactly, by his primary or secondary position.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageManager({ opponent, leagueId }: { opponent: OpponentCard; leagueId: string }) {
  const chat = useLeagueChat();
  const manager = opponent.club.manager;

  return (
    <NavigationLink
      href={`/league/${leagueId}/chat`}
      className={styles.btn}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!chat) return;
        e.preventDefault();
        if (opponent.club.userId && manager) {
          chat.openChat({
            type: 'dm',
            userId: opponent.club.userId,
            username: manager,
            teamName: opponent.club.name,
          });
        } else {
          chat.openChat({ type: 'lobby' });
        }
      }}
    >
      {manager ? `Message @${manager}` : 'Open Chat'}
    </NavigationLink>
  );
}

function Card({
  side,
  model,
  size,
  live,
}: {
  side: Side;
  model: HomeModel;
  size: 'lead' | 'aside';
  live: boolean;
}) {
  const f = side.fixture;
  const lead = size === 'lead';
  const homeDim = f.hasScores && f.outcome === 'behind';
  const awayDim = f.hasScores && f.outcome === 'ahead';

  return (
    <article className={lead ? styles.mCardLead : styles.mCard}>
      {/* The club's own crest, enlarged and faded — the card is about this
          fixture, and a flat panel with nothing behind it reads as a box. */}
      <div className={styles.mWatermark} aria-hidden="true">
        <CrestBadge
          config={model.club.crest as CrestConfig | null}
          size={lead ? 260 : 190}
          teamName={model.club.name}
          interactive={false}
        />
      </div>

      <NavigationLink
        href={`/league/${model.leagueId}/matchups/${f.matchupId}`}
        className={styles.mBar}
        aria-label={`Open ${f.home.name} against ${f.away.name}`}
      >
        <span className={styles.mBarT}>Matchweek {f.gameweek}</span>
        <span className={styles.mBarWhen}>{f.when.replace(/^Matchweek \d+ · /, '')}</span>
        <StatusChip fixture={f} played={side.played} live={live} />
      </NavigationLink>

      <div className={styles.mBody}>
        <Team club={f.home} meta={f.homeMeta} score={f.homeScore} dim={homeDim} size={size} />
        <Team club={f.away} meta={f.awayMeta} score={f.awayScore} dim={awayDim} size={size} />

        {f.hasScores && <Share fixture={f} />}

        {/* The meter is live-only: once the result is settled the distance to
            the next outcome is history and the verdict carries the message. */}
        {live && f.hasScores && (
          <div className={styles.meter}>
            <div className={styles.meterTrack}>
              <div className={styles.meterBand} />
              <div className={styles.meterZero} />
              <div
                className={
                  f.outcome === 'ahead'
                    ? styles.meterMarkAhead
                    : f.outcome === 'behind'
                      ? styles.meterMarkBehind
                      : styles.meterMark
                }
                style={{ left: `${f.markerPct.toFixed(2)}%` }}
              />
            </div>
            <div className={styles.meterAxis}>
              <span>+40 you</span>
              <span>&larr; draw band &plusmn;10 &rarr;</span>
              <span>them +40</span>
            </div>
          </div>
        )}

        {f.hasScores && f.verdict && (
          <div className={f.outcome === 'drawn' ? styles.verdictCalm : styles.verdict}>{f.verdict}</div>
        )}

        {live && (
          <div className={styles.mStill}>
            <span>
              <b>{f.stillToPlay.mine}</b> still to play
            </span>
            <span>
              <b>{f.stillToPlay.theirs}</b> for them
            </span>
          </div>
        )}

        {!side.played && <Xi side={side} compact={!lead} />}

        {side.played && lead && model.matchReportHeadline && (
          <div className={styles.report}>
            <div className={styles.reportH}>{model.matchReportHeadline}</div>
            <div className={styles.reportB}>
              {model.matchReportByline ? `${model.matchReportByline} · ` : ''}
              <NavigationLink href={`/league/${model.leagueId}/matchups/${f.matchupId}`}>
                Read the Report
              </NavigationLink>
            </div>
          </div>
        )}

        {side.played && side.debrief.length > 0 && (
          <div className={styles.debrief}>
            {side.debrief.slice(0, lead ? 4 : 2).map((d, i) => (
              <span key={i} className={styles.debriefItem}>
                <b>{d.value}</b> {d.label}
              </span>
            ))}
          </div>
        )}

        {f.cupLine && (
          <div className={styles.cup}>
            <span className={styles.cupTag}>Also</span>
            <span>{f.cupLine}</span>
          </div>
        )}

        {!side.played && (
          <div className={styles.mActions}>
            <NavigationLink href={`/league/${model.leagueId}/team`} className={styles.btnPrimary}>
              Set Lineup
            </NavigationLink>
            {side.opponent && <MessageManager opponent={side.opponent} leagueId={model.leagueId} />}
          </div>
        )}

        {side.played && side.opponent && (
          <div className={styles.h2h}>
            <span className={styles.h2hV}>{side.opponent.record}</span>
            <span className={styles.h2hK}>all-time against {side.opponent.club.name}</span>
            {side.opponent.lastMeeting !== 'First meeting' && (
              <span className={styles.h2hK}>&middot; last {side.opponent.lastMeeting}</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Match({ model }: { model: HomeModel }) {
  const { lead, aside } = sides(model);
  if (!lead) return null;
  const live = model.phase === 'live';

  return (
    <div className={aside ? styles.matchRow : styles.matchRowSolo}>
      <Card side={lead} model={model} size="lead" live={live} />
      {aside && <Card side={aside} model={model} size="aside" live={false} />}
    </div>
  );
}
