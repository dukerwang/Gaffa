-- 168: xGI-per-90 percentile for one player, computed in the database.
--
-- The player card's Scouting view shows where a player's expected goal
-- involvement sits within his position group. The hub computes this in
-- TypeScript (src/lib/outlook/facetInputs.ts, percentileByPosition) by pulling
-- every player_stats row for two seasons, about six seconds per request. Here
-- it is one aggregate.
--
-- Semantics match percentileByPosition exactly:
--   * the pool is ACTIVE players (players.is_active), as the hub's is;
--   * a player qualifies with at least 600 minutes in the season;
--   * the group is GK / DEF / MID / ATT from primary_position;
--   * the value is the share of the group strictly below him,
--     below / (n - 1), which is percent_rank(); 0.5 in a group of one.
-- Returns NULL when the player doesn't qualify.

create or replace function public.player_xgi_percentile(p_player_id uuid, p_season text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with agg as (
    select s.player_id,
           sum(coalesce((s.stats->>'minutes_played')::numeric, 0)) as minutes,
           sum(coalesce((s.stats->>'expected_goals')::numeric, 0)
             + coalesce((s.stats->>'expected_assists')::numeric, 0)) as xgi
    from player_stats s
    where s.season = p_season
    group by s.player_id
  ),
  ranked as (
    select a.player_id,
           case
             when p.primary_position = 'GK' then 'GK'
             when p.primary_position in ('CB', 'LB', 'RB', 'LWB', 'RWB') then 'DEF'
             when p.primary_position in ('DM', 'CM', 'AM') then 'MID'
             else 'ATT'
           end as grp,
           a.xgi * 90 / a.minutes as per90
    from agg a
    join players p on p.id = a.player_id
    where a.minutes >= 600
      and p.is_active
  ),
  scored as (
    select player_id,
           count(*) over (partition by grp) as n,
           percent_rank() over (partition by grp order by per90) as pct
    from ranked
  )
  select case when n < 2 then 0.5 else pct end
  from scored
  where player_id = p_player_id;
$$;

grant execute on function public.player_xgi_percentile(uuid, text) to anon, authenticated, service_role;
