'use client';

import type { CSSProperties } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import ReadOnlyFormationBoard, {
  type FormationBoardSlot,
} from '@/components/formation/ReadOnlyFormationBoard';
import { playerHoverProps, usePlayerCard } from '@/components/players/PlayerCardProvider';
import { renderBoldedText } from '@/lib/narrative/boldText';
import type { CrestConfig } from '@/components/crest/types';
import type { GranularPosition } from '@/types';
import type { HomeModel } from '@/lib/home/buildHomeModel';
import styles from './home.module.css';

/**
 * Team of the Week — the highest-scoring legal XI from the latest completed
 * gameweek, plus the same four semantic bench slots the lineup editor uses.
 *
 * It used to close the page, below the table. It is the only region built
 * from photographs rather than type, so it now sits where the page needs
 * imagery: directly under the market, above the league regions.
 */
export function TeamOfWeek({ model }: { model: HomeModel }) {
  const team = model.teamOfWeek;
  const { openPlayerById, prefetchPlayer } = usePlayerCard();
  if (!team) return null;

  const slots: FormationBoardSlot[] = team.starters.map((player) => ({
    slot: player.slot as GranularPosition,
    player: {
      id: player.playerId,
      name: player.name,
      club: player.club,
      photoUrl: player.photoUrl,
      photoVersion: player.photoVersion,
      headTopPct: player.portraitHeadTopPct,
      headWidthPct: player.portraitHeadWidthPct,
      detail: player.owner,
      marker: player.points,
    },
  }));

  return (
    <section className={styles.section} aria-labelledby="team-of-the-week">
      <div className={styles.head}>
        {/* The instrument: the shape the XI lines up in. */}
        <span className={styles.shapeTile} aria-hidden="true">
          <span className={styles.shapeTileK}>SHAPE</span>
          <span className={styles.shapeTileV}>{team.formation}</span>
        </span>
        <div className={styles.headTx}>
          <h2 id="team-of-the-week" className={styles.headT}>
            Team of the Week
          </h2>
          <div className={styles.headSub}>
            Matchweek {model.teamOfWeekGw} &middot; {team.total} pts across the eleven
          </div>
        </div>
        <NavigationLink href={`/league/${model.leagueId}/stats`} className={styles.headLink}>
          Full Stats &rarr;
        </NavigationLink>
      </div>

      <div className={styles.tow}>
        <ReadOnlyFormationBoard
          formation={team.formation}
          slots={slots}
          ariaLabel="Team of the Week formation"
          emptyLabel="No eligible Team of the Week is available."
          onSelectPlayer={(id) => openPlayerById(id, { gameweek: model.teamOfWeekGw })}
        />
        <div className={styles.towBench}>
          <div className={styles.towBenchHead}>
            <h3>Bench</h3>
            <span className="g-label">Best remaining scores</span>
          </div>
          <div className={styles.towBenchGrid}>
            {Object.entries(team.bench).map(([slot, player]) =>
              player ? (
                <button
                  type="button"
                  key={slot}
                  className={`${styles.towBenchSlot} ${styles.towBenchSlotButton}`}
                  onClick={() => openPlayerById(player.playerId, { gameweek: model.teamOfWeekGw })}
                  {...playerHoverProps(prefetchPlayer, {
                    id: player.playerId,
                    photo_url: player.photoUrl,
                  })}
                  aria-label={`${player.name}, ${slot} bench, ${player.points} points`}
                >
                  <span className={styles.towBenchSlotLabel}>{slot}</span>
                  <div className={styles.towBenchName}>{player.name}</div>
                  <div className={styles.towBenchMeta}>
                    {player.club} &middot; {player.owner}
                  </div>
                  <div className={styles.towBenchPoints}>{player.points} pts</div>
                </button>
              ) : (
                <div className={styles.towBenchSlot} key={slot}>
                  <span className={styles.towBenchSlotLabel}>{slot}</span>
                  <span className={styles.towBenchEmpty}>No eligible player</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Where the season stands, with what each finish pays. */
function TheTable({ model }: { model: HomeModel }) {
  const played = Math.max(0, model.gameweek - 1);
  const segments = Array.from({ length: model.totalGameweeks }, (_, i) =>
    i < played ? styles.segDone : styles.segTodo,
  );

  return (
      <section className={styles.section} aria-labelledby="table">
        <div className={styles.head}>
          <div className={styles.headTx}>
            <h2 id="table" className={styles.headT}>
              {model.phase === 'closed' ? 'The Final Table' : 'The Table'}
            </h2>
            <div className={styles.headSub}>
              Pays: the placement prize at that finish, on today&rsquo;s table &middot; Form:
              newest first
            </div>
          </div>
          {/* The instrument: how much of the season has actually been played. */}
          <div className={styles.season}>
            <div
              className={styles.seasonBar}
              style={{ '--n': segments.length } as CSSProperties}
              aria-hidden="true"
            >
              {segments.map((cls, i) => (
                <span key={i} className={cls} />
              ))}
            </div>
            <div className={styles.seasonKey}>
              <span>{played} Played</span>
              <span className={styles.seasonKeyTodo}>
                {model.totalGameweeks - played} To Come
              </span>
            </div>
          </div>
          <NavigationLink href={`/league/${model.leagueId}/standings`} className={styles.headLink}>
            Full Standings &rarr;
          </NavigationLink>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.alignLeft}>Rk</th>
                <th scope="col" className={styles.alignLeft}>Club</th>
                <th scope="col" className={styles.colDesktop}>W</th>
                <th scope="col" className={styles.colDesktop}>D</th>
                <th scope="col" className={styles.colDesktop}>L</th>
                <th scope="col" className={styles.colDesktop}>For</th>
                <th scope="col">Pts</th>
                <th scope="col" className={styles.colDesktop}>Form</th>
                <th scope="col">Pays</th>
              </tr>
            </thead>
            <tbody>
              {model.table.map((r) => (
                <tr key={r.teamId} className={r.isMe ? styles.rowMe : undefined}>
                  <td className={styles.alignLeft}>
                    <span className={styles.num}>{r.rank}</span>{' '}
                    {/* The rank is data and stays in primary ink; only the
                        glyph is tinted, and it is a shape first. */}
                    <span
                      className={
                        r.movement > 0
                          ? styles.moveUp
                          : r.movement < 0
                            ? styles.moveDown
                            : styles.moveFlat
                      }
                      aria-label={
                        r.movement > 0
                          ? `up ${r.movement}`
                          : r.movement < 0
                            ? `down ${Math.abs(r.movement)}`
                            : 'no change'
                      }
                    >
                      {r.movement > 0 ? '▲' : r.movement < 0 ? '▼' : '–'}
                    </span>
                  </td>
                  <td className={styles.alignLeft}>
                    <span className={`g-namerow ${styles.club}`}>
                      <CrestBadge
                        config={r.club.crest as CrestConfig | null}
                        size={21}
                        teamName={r.club.name}
                        teamId={r.teamId}
                      />
                      <span className={r.isMe ? styles.clubNameMe : styles.clubName}>
                        {r.club.name}
                      </span>
                      {r.isMe && <span className={styles.you}>You</span>}
                    </span>
                  </td>
                  <td className={styles.colDesktop}>{r.wins}</td>
                  <td className={styles.colDesktop}>{r.draws}</td>
                  <td className={styles.colDesktop}>{r.losses}</td>
                  <td className={styles.colDesktop}>{r.pointsFor}</td>
                  <td>
                    <span className={styles.num}>{r.leaguePoints}</span>
                  </td>
                  <td className={styles.colDesktop}>
                    <span className={styles.form}>
                      {r.form.map((p, i) => (
                        <span
                          key={i}
                          className={p === 'W' ? styles.pipW : p === 'D' ? styles.pipD : styles.pipL}
                        >
                          {p}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <span className={styles.prize}>{r.prize}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
  );
}

/** The rest of this matchweek, as crest-led score lines. */
function Elsewhere({ model }: { model: HomeModel }) {
  if (model.matchweek.length === 0) return null;

  return (
        <section className={styles.section} aria-labelledby="elsewhere">
          <div className={styles.head}>
            <span className={styles.mwTile} aria-hidden="true">
              <span className={styles.mwTileK}>MW</span>
              <span className={styles.mwTileV}>{model.fixture?.gameweek ?? model.gameweek}</span>
            </span>
            <div className={styles.headTx}>
              <h2 id="elsewhere" className={styles.headT}>
                Elsewhere
              </h2>
              <div className={styles.headSub}>The rest of the matchweek</div>
            </div>
            <NavigationLink href={`/league/${model.leagueId}/matchups`} className={styles.headLink}>
              All Fixtures &rarr;
            </NavigationLink>
          </div>

          <div className={styles.mw}>
            {model.matchweek.map((m) => (
              <NavigationLink
                key={m.id}
                href={`/league/${model.leagueId}/matchups/${m.id}`}
                className={styles.mwRow}
              >
                <CrestBadge
                  config={m.home.crest as CrestConfig | null}
                  size={22}
                  teamName={m.home.name}
                  teamId={m.home.id}
                  interactive={false}
                />
                <span
                  className={
                    !m.live && !m.drawn && (m.homeScore ?? 0) < (m.awayScore ?? 0)
                      ? styles.mwNameDim
                      : styles.mwName
                  }
                >
                  {m.home.name}
                </span>
                <span className={styles.mwScores}>
                  <span className={m.homeScore == null ? styles.mwScoreDim : styles.mwScore}>
                    {m.homeScore == null ? '—' : m.homeScore.toFixed(1)}
                  </span>
                  <span className={m.live ? styles.mwTagLive : m.drawn ? styles.mwTagBand : styles.mwTag}>
                    {m.tag}
                  </span>
                  <span className={m.awayScore == null ? styles.mwScoreDim : styles.mwScore}>
                    {m.awayScore == null ? '—' : m.awayScore.toFixed(1)}
                  </span>
                </span>
                <span
                  className={
                    !m.live && !m.drawn && (m.awayScore ?? 0) < (m.homeScore ?? 0)
                      ? `${styles.mwNameDim} ${styles.mwNameB}`
                      : `${styles.mwName} ${styles.mwNameB}`
                  }
                >
                  {m.away.name}
                </span>
                <CrestBadge
                  config={m.away.crest as CrestConfig | null}
                  size={22}
                  teamName={m.away.name}
                  teamId={m.away.id}
                  interactive={false}
                />
              </NavigationLink>
            ))}
          </div>
        </section>
  );
}

/**
 * The cups, and the club's own record.
 *
 * "On All Fronts" carried four tiles, and the first of them — League, your
 * rank, the gap to the leader, the prize — was the masthead's first figure
 * and the table's Pays column said a third time. It is gone; the three cups
 * are what is left, because a cup is the only competition whose standing is
 * not already on this page.
 */
function Cups({ model }: { model: HomeModel }) {
  const cups = model.fronts.filter((f) => f.competition !== 'League');

  return (
      <section className={styles.section} aria-labelledby="cups">
        <div className={styles.head}>
          <div className={styles.headTx}>
            <h2 id="cups" className={styles.headT}>
              {model.phase === 'closed' ? 'How the Cups Finished' : 'Cups'}
            </h2>
            <div className={styles.headSub}>Three knockouts run alongside the league</div>
          </div>
          <NavigationLink href={`/league/${model.leagueId}/tournaments`} className={styles.headLink}>
            Brackets &rarr;
          </NavigationLink>
        </div>

        <div className={styles.cups}>
          {cups.map((fr, i) => (
            <div
              key={i}
              className={fr.tone === 'won' ? styles.cupWon : fr.tone === 'out' ? styles.cupOut : styles.cupTile}
            >
              <span className={styles.cupName}>{fr.competition}</span>
              <span
                className={
                  fr.tone === 'won' ? styles.cupVGold : fr.tone === 'out' ? styles.cupVMuted : styles.cupV
                }
              >
                {fr.value}
              </span>
              <span className={styles.cupSub}>{fr.sub}</span>
              <span className={styles.cupPrize}>{fr.prize}</span>
            </div>
          ))}
        </div>

        <div className={styles.facts}>
          {model.clubFacts.map((f, i) => (
            <div key={i} className={styles.fact}>
              <span className={styles.factK}>{f.label}</span>
              <span className={f.gold ? styles.factVGold : styles.factV}>{f.value}</span>
            </div>
          ))}
        </div>
      </section>
  );
}

/** Players who have changed hands, as the settled record. */
function Transactions({ model }: { model: HomeModel }) {
  return (
      <section className={styles.section} aria-labelledby="transactions">
        <div className={styles.head}>
          <div className={styles.headTx}>
            <h2 id="transactions" className={styles.headT}>
              Transactions
            </h2>
            <div className={styles.headSub}>Players who have changed hands</div>
          </div>
          <NavigationLink href={`/league/${model.leagueId}/activity`} className={styles.headLink}>
            All Transactions &rarr;
          </NavigationLink>
        </div>

        {model.wire.length === 0 ? (
          <div className={styles.lotsEmpty}>No player has changed hands yet this season.</div>
        ) : (
          <div className={styles.wire}>
            {model.wire.map((e) => (
              <div key={e.id} className={styles.ev}>
                {/* The generators mark emphasis with **…** and encode player
                    references as **p:{id}:{Name}**. Printing the raw string
                    leaks both. renderBoldedText is the parser the rest of the
                    app already uses; with no click handler it degrades to
                    <strong>, which is exactly right for a digest. */}
                <span className={styles.evText}>{renderBoldedText(e.text)}</span>
                <span className={styles.evTime}>{e.at}</span>
              </div>
            ))}
          </div>
        )}
      </section>
  );
}

/** The two settled columns, laid out as one band. */
export function Closing({ model }: { model: HomeModel }) {
  return (
    <div className={styles.closing}>
      <div className={styles.closingMain}>
        <TheTable model={model} />
        <Cups model={model} />
      </div>
      <div className={styles.closingSide}>
        <Elsewhere model={model} />
        <Transactions model={model} />
      </div>
    </div>
  );
}
