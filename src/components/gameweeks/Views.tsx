'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Player } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { usePlayerCard } from '@/components/players/PlayerCardProvider';
import { clubHref as clubHrefFor } from '@/lib/teams/clubHref';
import type { MatchState, MatchupView, PitchPlayer } from '@/lib/matchups/matchupView';
import type { RibbonCell, ResultLetter, TableRow, TeamMeta } from '@/lib/matchups/roundView';
import { s } from './parts';
import Scoreboard from './Scoreboard';
import { GameweekBar, MatchBar } from './GameweekBar';
import { Fixtures, RoundRecords, SeasonList, Spread, Standings, type RecordsData, type SeasonTopRow, type SpreadPlayer } from './RoundSections';
import { LineTotals, Lineups, Momentum, Report } from './MatchSections';
import { HeadToHead, TeamSheets, type H2HData } from './TeamSheets';
import type { Metas, TeamLite, TieLite } from './types';

/**
 * Re-runs the server render when a matchup row in this league changes, the
 * way scores move during a live gameweek (migrations 103/104). Coalesced, so
 * a sync that touches every row costs one refresh.
 */
function LiveRefresh({ leagueId, matchupId }: { leagueId: string; matchupId?: string }) {
  const router = useRouter();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const filter = matchupId ? `id=eq.${matchupId}` : `league_id=eq.${leagueId}`;
    const channel = supabase
      .channel(`gameweeks:${matchupId ?? leagueId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matchups', filter }, () => {
        if (pending.current) return;
        pending.current = setTimeout(() => { pending.current = null; router.refresh(); }, 1500);
      })
      .subscribe();
    return () => {
      if (pending.current) clearTimeout(pending.current);
      supabase.removeChannel(channel);
    };
  }, [leagueId, matchupId, router]);
  return null;
}

function useOpen(players: Record<string, Partial<Player>>, gameweek: number) {
  const { openPlayer, openPlayerById, primePlayers } = usePlayerCard();
  useEffect(() => {
    primePlayers(Object.values(players).filter((p) => p?.id) as Player[]);
  }, [players, primePlayers]);
  const open = useCallback((p: PitchPlayer) => {
    const row = players[p.id];
    if (row?.id) openPlayer(row as Player, { gameweek, position: p.slot });
    else openPlayerById(p.id, { gameweek, position: p.slot });
  }, [players, gameweek, openPlayer, openPlayerById]);
  const openId = useCallback((id: string, slot?: string) => {
    const row = players[id];
    if (row?.id) openPlayer(row as Player, { gameweek, position: slot ?? null });
    else openPlayerById(id, { gameweek, position: slot ?? null });
  }, [players, gameweek, openPlayer, openPlayerById]);
  return { open, openId };
}

export interface RoundProps {
  leagueId: string;
  gw: number;
  gameweeks: number[];
  myTeamId?: string;
  state: MatchState;
  window: { first: string | null; last: string | null };
  deadline: string | null;
  ribbon: RibbonCell[];
  record: TeamMeta | null;
  ties: TieLite[];
  clock: string[];
  metas: Metas;
  teams: Record<string, TeamLite>;
  table: TableRow[];
  moves: Record<string, number>;
  gwRes: Record<string, { r: ResultLetter; my: number; opp: number }>;
  records: RecordsData | null;
  spread: SpreadPlayer[] | null;
  seasonTop: SeasonTopRow[] | null;
  players: Record<string, Partial<Player>>;
}

export function RoundView(p: RoundProps) {
  const { open, openId } = useOpen(p.players, p.gw);
  const mine = p.ties.find((t) => t.a.id === p.myTeamId || t.b?.id === p.myTeamId) ?? null;
  const clubHref = (id: string) => clubHrefFor(p.leagueId, id, id === p.myTeamId);
  return (
    <div className={`${s.root} g-page`}>
      {p.state === 'live' && <LiveRefresh leagueId={p.leagueId} />}
      <GameweekBar leagueId={p.leagueId} gw={p.gw} gameweeks={p.gameweeks} ribbon={p.ribbon} record={p.record} state={p.state} window={p.window} deadline={p.deadline} />
      {p.ties.length === 0 ? (
        <div className={`${s.panel} ${s.empty}`}>No matchups scheduled for Gameweek {p.gw}.</div>
      ) : (
        <>
          {mine && (
            <div className={s.hxWide}>
              <Scoreboard tie={mine} state={mine.state} gw={p.gw} myTeamId={p.myTeamId} metas={p.metas} window={p.window} deadline={p.deadline}
                href={`/league/${p.leagueId}/matchups/${mine.id}`} lineupHref={`/league/${p.leagueId}/team`} squadHref={`/league/${p.leagueId}/team/roster`} onOpen={open} />
            </div>
          )}
          <Fixtures ties={p.ties} clock={p.clock} state={p.state} metas={p.metas} myTeamId={p.myTeamId} leagueId={p.leagueId} />
          {p.records && <div className={s.stl}><RoundRecords data={p.records} teams={p.teams} myTeamId={p.myTeamId} /></div>}
          <div className={s.stl}>
            <div className={s.r2Grid}>
              <div>
                {p.spread && p.spread.length > 0
                  ? <Spread all={p.spread} teams={p.teams} myTeamId={p.myTeamId} live={p.state === 'live'} onOpen={open} />
                  : p.seasonTop ? <SeasonList rows={p.seasonTop} teams={p.teams} onOpenId={openId} /> : null}
              </div>
              <div>
                <Standings rows={p.table} moves={p.moves} gwRes={p.gwRes} gw={p.gw} teams={p.teams} myTeamId={p.myTeamId} leagueId={p.leagueId} clubHref={clubHref} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export interface MatchProps {
  leagueId: string;
  myTeamId?: string;
  view: MatchupView;
  teams: { a: TeamLite; b: TeamLite };
  ties: TieLite[];
  current: TieLite;
  metas: Metas;
  h2h: H2HData | null;
  window: { first: string | null; last: string | null };
  deadline: string | null;
}

export function MatchView(p: MatchProps) {
  const { open, openId } = useOpen(p.view.players, p.view.gameweek);
  const { view, teams } = p;
  const mineK: 'a' | 'b' = teams.b.id === p.myTeamId ? 'b' : 'a';
  const otherK = mineK === 'a' ? 'b' : 'a';
  const up = view.state === 'upcoming';
  const done = view.state === 'final' || view.state === 'provisional';
  const clubHref = (id: string) => clubHrefFor(p.leagueId, id, id === p.myTeamId);
  const h2h = p.h2h ? <div className={s.stl}><HeadToHead data={p.h2h} mine={teams[mineK]} other={teams[otherK]} /></div> : null;
  return (
    <div className={`${s.root} g-page`}>
      {view.state === 'live' && <LiveRefresh leagueId={p.leagueId} matchupId={view.id} />}
      <MatchBar leagueId={p.leagueId} gw={view.gameweek} ties={p.ties} current={view.id} />
      <Scoreboard tie={p.current} state={view.state} gw={view.gameweek} big myTeamId={p.myTeamId} metas={p.metas} window={p.window} deadline={p.deadline}
        lineupHref={`/league/${p.leagueId}/team`} squadHref={`/league/${p.leagueId}/team/roster`} clubHref={clubHref} onOpen={open} />
      {up && h2h}
      {!up && <div className={s.stl}><Momentum view={view} teams={teams} /></div>}
      <div className={s.stl}><Lineups view={view} teams={teams} onOpen={open} mineFirst={mineK} /></div>
      {!up && (
        <div className={s.stl}>
          <div className={s.story2}>
            <div><LineTotals view={view} teams={teams} /></div>
            <div><Report view={view} teams={teams} onOpenId={(id) => openId(id)} /></div>
          </div>
        </div>
      )}
      <div className={s.stl}><TeamSheets view={view} teams={teams} mine={mineK} onOpen={open} /></div>
      {done && h2h}
    </div>
  );
}
