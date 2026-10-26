'use client';

import NavigationLink from '@/components/ui/NavigationLink';
import { Tabs } from '@/components/ui';
import Trophy from '@/components/trophies/Trophy';
import Scoreboard from '@/components/gameweeks/Scoreboard';
import { Lineups } from '@/components/gameweeks/MatchSections';
import { HeadToHead, TeamSheets } from '@/components/gameweeks/TeamSheets';
import { LiveRefresh, useOpen } from '@/components/gameweeks/Views';
import { s as gw } from '@/components/gameweeks/parts';
import { clubHref as clubHrefFor } from '@/lib/teams/clubHref';
import { fmt } from '@/lib/matchups/roundView';
import type { CupTieProps } from '@/lib/cups/loadTieView';
import s from './cupTie.module.css';

/** A cup tie: the scoreboard, both XIs for the leg on screen, and how it was decided. */
export function CupTieView(p: CupTieProps) {
  const { view, teams } = p;
  const { open } = useOpen(view.players, view.gameweek);
  const mineK: 'a' | 'b' = teams.b.id === p.myTeamId ? 'b' : 'a';
  const otherK = mineK === 'a' ? 'b' : 'a';
  const up = view.state === 'upcoming';
  const clubHref = (id: string) => clubHrefFor(p.leagueId, id, id === p.myTeamId);
  const base = `/league/${p.leagueId}/tournaments/${p.current.id}`;
  const h2h = p.h2h ? <div className={gw.stl}><HeadToHead data={p.h2h} mine={teams[mineK]} other={teams[otherK]} /></div> : null;

  return (
    <div className={`${gw.root} g-page`}>
      {view.state === 'live' && <LiveRefresh leagueId={p.leagueId} />}
      <div className={s.head}>
        <NavigationLink href={`/league/${p.leagueId}/tournaments?cup=${p.cup.id}`} className={s.back}>
          <Trophy kind={p.cup.kind} size="pip" height={22} />
          <span>{p.cup.name} · {p.round.name}</span>
        </NavigationLink>
        {p.aggregate && (
          <span className={s.agg}>
            Aggregate <b>{fmt(p.aggregate.a)}</b> – <b>{fmt(p.aggregate.b)}</b>
          </span>
        )}
      </div>

      {p.round.twoLeg && (
        <div className={s.legs}>
          <Tabs
            ariaLabel="Legs"
            value={String(p.leg)}
            items={p.round.legs.map((g, i) => ({ value: String(i + 1), label: `Leg ${i + 1} · MW${g}`, href: `${base}?leg=${i + 1}` }))}
          />
        </div>
      )}

      <Scoreboard
        tie={p.current}
        state={view.state}
        gw={view.gameweek}
        big
        myTeamId={p.myTeamId}
        metas={{}}
        window={p.window}
        deadline={p.deadline}
        lineupHref={`/league/${p.leagueId}/team`}
        squadHref={`/league/${p.leagueId}/team/roster`}
        clubHref={clubHref}
        onOpen={open}
        knockout={{ winnerId: p.round.twoLeg ? null : p.winnerId }}
      />

      {p.decidedLine && <p className={s.decided}>{p.decidedLine}</p>}
      {up && h2h}
      <div className={gw.stl}><Lineups view={view} teams={teams} onOpen={open} mineFirst={mineK} /></div>
      <div className={gw.stl}><TeamSheets view={view} teams={teams} mine={mineK} onOpen={open} /></div>
      {!up && h2h}
    </div>
  );
}
