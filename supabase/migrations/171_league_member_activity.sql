-- 171: Manager activity and the inactivity alert
--
-- The commissioner is told when a manager hasn't opened their league for six
-- full gameweeks, after the manager has had a warning at five. Nothing happens
-- to the club automatically: the commissioner decides whether to remove the
-- manager (migration 169 hands the club to the Caretaker).
-- Spec: docs/superpowers/specs/2026-10-04-expansion-and-takeovers-design.md
--
-- Activity must never be guessed. teams.last_seen_at is only the draft room's
-- heartbeat, and auth's last_sign_in_at changes only on a fresh login, so a
-- manager who stays signed in for months would look absent. last_active_at is
-- touched on every visit to the league (and the dashboard), at most hourly.
--
-- Existing members start at NOW(): nobody can be flagged for time before this
-- column existed.

ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS inactivity_warned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivity_reported_at TIMESTAMPTZ;

-- Records a visit by the signed-in user: one league, or every league they're
-- in when p_league_id is NULL (the dashboard covers them all). Callable by any
-- signed-in user, but it only ever touches their own memberships. Resets the
-- warning and report so a later absence is counted afresh.
CREATE OR REPLACE FUNCTION public.touch_league_activity(p_league_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.league_members
  SET last_active_at = NOW(),
      inactivity_warned_at = NULL,
      inactivity_reported_at = NULL
  WHERE user_id = auth.uid()
    AND (p_league_id IS NULL OR league_id = p_league_id)
    AND last_active_at < NOW() - INTERVAL '1 hour';
$$;

REVOKE ALL ON FUNCTION public.touch_league_activity(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_league_activity(UUID) TO authenticated;

-- Full gameweeks played since a moment: every Premier League gameweek whose
-- first kickoff came after it and whose last kickoff has passed. Counting
-- gameweeks rather than days means an international break or the summer never
-- counts toward an absence.
CREATE OR REPLACE FUNCTION public.full_gameweeks_since(p_since TIMESTAMPTZ)
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::INT
  FROM (
    SELECT min(f.kickoff_time) AS first_kickoff, max(f.kickoff_time) AS last_kickoff
    FROM public.pl_fixtures f
    WHERE f.kickoff_time IS NOT NULL AND f.gameweek IS NOT NULL
    GROUP BY f.season, f.gameweek
  ) gw
  WHERE gw.first_kickoff > p_since
    AND gw.last_kickoff < NOW();
$$;

-- Managers in active leagues who have missed at least p_min_gameweeks full
-- gameweeks, with what the daily check needs to warn them or tell the
-- commissioner. Caretaker clubs have no member row, so they never appear.
CREATE OR REPLACE FUNCTION public.inactive_league_members(p_min_gameweeks INT DEFAULT 5)
RETURNS TABLE (
  league_id UUID,
  league_name TEXT,
  commissioner_id UUID,
  user_id UUID,
  username TEXT,
  team_id UUID,
  team_name TEXT,
  last_active_at TIMESTAMPTZ,
  inactive_gameweeks INT,
  gameweeks_since_warning INT,
  warned_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (
    SELECT l.id, l.name, l.commissioner_id, m.user_id, u.username, t.id, t.team_name, m.last_active_at,
      public.full_gameweeks_since(m.last_active_at) AS inactive_gameweeks,
      CASE WHEN m.inactivity_warned_at IS NULL THEN NULL
           ELSE public.full_gameweeks_since(m.inactivity_warned_at) END,
      m.inactivity_warned_at, m.inactivity_reported_at
    FROM public.league_members m
    JOIN public.leagues l ON l.id = m.league_id AND l.status = 'active'
    JOIN public.teams t ON t.league_id = m.league_id AND t.user_id = m.user_id
    LEFT JOIN public.users u ON u.id = m.user_id
  ) x
  WHERE x.inactive_gameweeks >= p_min_gameweeks;
$$;

REVOKE ALL ON FUNCTION public.inactive_league_members(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inactive_league_members(INT) TO service_role;
