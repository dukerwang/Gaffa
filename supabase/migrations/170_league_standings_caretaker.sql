-- 170: Caretaker clubs stay in the standings
--
-- league_standings inner-joined users, so a club with no manager (a Caretaker
-- club, migration 169) dropped out of the table, and out of
-- season_standings_archive, which the reset fills from this view. Left join
-- instead, and name the Caretaker as the club's manager.
--
-- Identical to the live definition apart from the join and the username.

CREATE OR REPLACE VIEW public.league_standings AS
WITH matchup_results AS (
  SELECT matchups.league_id,
    matchups.team_a_id AS team_id,
    COALESCE(matchups.score_a, 0::numeric) AS pf,
    COALESCE(matchups.score_b, 0::numeric) AS pa,
    CASE
      WHEN abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) <= 10::numeric THEN 1
      WHEN COALESCE(matchups.score_a, 0::numeric) > COALESCE(matchups.score_b, 0::numeric) THEN 3
      ELSE 0
    END AS points,
    CASE
      WHEN abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) <= 10::numeric THEN 1
      ELSE 0
    END AS draws,
    CASE
      WHEN COALESCE(matchups.score_a, 0::numeric) > COALESCE(matchups.score_b, 0::numeric)
        AND abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) > 10::numeric THEN 1
      ELSE 0
    END AS wins,
    CASE
      WHEN COALESCE(matchups.score_b, 0::numeric) > COALESCE(matchups.score_a, 0::numeric)
        AND abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) > 10::numeric THEN 1
      ELSE 0
    END AS losses
  FROM matchups
  WHERE matchups.status = ANY (ARRAY['live'::matchup_status, 'completed'::matchup_status])
    AND matchups.team_a_id IS NOT NULL AND matchups.team_b_id IS NOT NULL
  UNION ALL
  SELECT matchups.league_id,
    matchups.team_b_id AS team_id,
    COALESCE(matchups.score_b, 0::numeric) AS pf,
    COALESCE(matchups.score_a, 0::numeric) AS pa,
    CASE
      WHEN abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) <= 10::numeric THEN 1
      WHEN COALESCE(matchups.score_b, 0::numeric) > COALESCE(matchups.score_a, 0::numeric) THEN 3
      ELSE 0
    END AS points,
    CASE
      WHEN abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) <= 10::numeric THEN 1
      ELSE 0
    END AS draws,
    CASE
      WHEN COALESCE(matchups.score_b, 0::numeric) > COALESCE(matchups.score_a, 0::numeric)
        AND abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) > 10::numeric THEN 1
      ELSE 0
    END AS wins,
    CASE
      WHEN COALESCE(matchups.score_a, 0::numeric) > COALESCE(matchups.score_b, 0::numeric)
        AND abs(COALESCE(matchups.score_a, 0::numeric) - COALESCE(matchups.score_b, 0::numeric)) > 10::numeric THEN 1
      ELSE 0
    END AS losses
  FROM matchups
  WHERE matchups.status = ANY (ARRAY['live'::matchup_status, 'completed'::matchup_status])
    AND matchups.team_a_id IS NOT NULL AND matchups.team_b_id IS NOT NULL
), team_totals AS (
  SELECT matchup_results.league_id,
    matchup_results.team_id,
    count(*) AS played,
    sum(matchup_results.points) AS league_points,
    sum(matchup_results.wins) AS wins,
    sum(matchup_results.draws) AS draws,
    sum(matchup_results.losses) AS losses,
    sum(matchup_results.pf) AS points_for,
    sum(matchup_results.pa) AS points_against,
    sum(matchup_results.pf - matchup_results.pa) AS goal_difference
  FROM matchup_results
  GROUP BY matchup_results.league_id, matchup_results.team_id
)
SELECT t.league_id,
  t.id AS team_id,
  t.team_name,
  COALESCE(u.username, 'Caretaker'::text) AS username,
  COALESCE(tt.played, 0::bigint) AS played,
  COALESCE(tt.league_points, 0::bigint) AS league_points,
  COALESCE(tt.wins, 0::bigint) AS wins,
  COALESCE(tt.draws, 0::bigint) AS draws,
  COALESCE(tt.losses, 0::bigint) AS losses,
  COALESCE(tt.points_for, 0::numeric) AS points_for,
  COALESCE(tt.points_against, 0::numeric) AS points_against,
  COALESCE(tt.goal_difference, 0::numeric) AS goal_difference,
  row_number() OVER (
    PARTITION BY t.league_id
    ORDER BY COALESCE(tt.league_points, 0::bigint) DESC, COALESCE(tt.goal_difference, 0::numeric) DESC,
      COALESCE(tt.points_for, 0::numeric) DESC, t.team_name
  ) AS rank
FROM teams t
  LEFT JOIN users u ON t.user_id = u.id
  LEFT JOIN team_totals tt ON t.id = tt.team_id;
