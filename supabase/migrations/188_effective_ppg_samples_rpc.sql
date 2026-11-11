-- Appearance samples for the effective-PPG figure, one row per player.
--
-- The transfer market, free agents, trades and loans read each rostered
-- player's points and minutes for this season and last to work out the PPG
-- shown beside an asking price (src/lib/transfers/effectivePpg.ts). It used to
-- pull every player_stats row for those players, including the whole `stats`
-- JSON blob, only to read one number out of it: ~5,400 rows and 4 MB, fetched
-- in six sequential pages on every page load.
--
-- This returns the same inputs compactly: for each player with at least one
-- appearance, two arrays of [points, minutes] pairs, this season's newest
-- gameweek first (the "last 10" form window is the head of that list) and last
-- season's in the same order. Rows with no minutes are left out, as before.
-- The PPG rules themselves stay in TypeScript, where they are tested.
create or replace function public.effective_ppg_samples(
  p_player_ids uuid[],
  p_season text,
  p_prev_season text
)
returns table (player_id uuid, curr jsonb, prev jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select
      ps.player_id,
      ps.season,
      ps.gameweek,
      ps.id,
      coalesce(ps.fantasy_points, 0) as points,
      case
        when ps.stats ->> 'minutes_played' ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (ps.stats ->> 'minutes_played')::numeric
        else 0
      end as minutes
    from public.player_stats ps
    where ps.player_id = any (p_player_ids)
      and ps.season in (p_season, p_prev_season)
  )
  select
    s.player_id,
    coalesce(
      jsonb_agg(jsonb_build_array(s.points, s.minutes) order by s.gameweek desc, s.id)
        filter (where s.season = p_season),
      '[]'::jsonb
    ) as curr,
    coalesce(
      jsonb_agg(jsonb_build_array(s.points, s.minutes) order by s.gameweek desc, s.id)
        filter (where s.season = p_prev_season and p_prev_season <> p_season),
      '[]'::jsonb
    ) as prev
  from s
  where s.minutes > 0
  group by s.player_id;
$$;

revoke all on function public.effective_ppg_samples(uuid[], text, text) from public, anon, authenticated;
grant execute on function public.effective_ppg_samples(uuid[], text, text) to service_role;
