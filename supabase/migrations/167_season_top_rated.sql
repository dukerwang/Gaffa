-- Season-long Top Rated for the home screen.
--
-- The home screen's "Season" view ranks players by their average match rating
-- across the season. Averaging in Postgres keeps the page to one round trip:
-- player_stats passes 1,000 rows a few gameweeks into every season, so doing
-- this in application code would mean paging through the whole table on every
-- page load.
--
-- A double gameweek gives a player two rows for one gameweek; the best of the
-- two counts, so a double does not count as two appearances. A player needs
-- ratings in at least 60% of the gameweeks played so far, so one excellent
-- cameo cannot top the season list.
create or replace function public.season_top_rated(p_season text, p_limit int default 6)
returns table (player_id uuid, avg_rating numeric, appearances int)
language sql
stable
as $$
  with per_gw as (
    select ps.player_id, ps.gameweek, max(ps.match_rating) as rating
    from public.player_stats ps
    where ps.season = p_season
      and ps.match_rating > 0
    group by ps.player_id, ps.gameweek
  ),
  played as (
    select count(distinct gameweek) as n from per_gw
  ),
  agg as (
    select player_id, avg(rating) as avg_rating, count(*)::int as appearances
    from per_gw
    group by player_id
  )
  select agg.player_id, round(agg.avg_rating, 2), agg.appearances
  from agg, played
  where agg.appearances >= greatest(1, ceil(played.n * 0.6))
  order by agg.avg_rating desc
  limit p_limit;
$$;
