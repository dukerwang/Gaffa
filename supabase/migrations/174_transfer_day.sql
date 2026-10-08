-- 174: Transfer Day
--
-- Redraft leagues don't run rolling 72-hour auctions. Managers bid openly all
-- week and every lot settles together on Transfer Day, 24 hours before the
-- gameweek's first kickoff. After that, until each player's own club kicks
-- off, an unclaimed free agent can be signed instantly for nothing. A player
-- dropped is up for auction until the next Transfer Day, so nobody can drop a
-- player straight into a friend's hands.
-- Spec: docs/superpowers/specs/2026-10-04-redraft-mode-design.md
--
-- The schedule is defined once, here, so the bid route, drops and the auction
-- resolver all close on the same moment.

-- Every gameweek's span and its Transfer Day. A congested week, where 24 hours
-- before the first kickoff would land before the previous gameweek's last
-- match, settles at the midpoint between the two instead. A gameweek whose
-- span overlaps the previous one (a postponed match moved later) keeps the
-- plain 24 hours, because a midpoint would fall after its own first kickoff.
CREATE OR REPLACE FUNCTION public.transfer_day_schedule()
RETURNS TABLE (season TEXT, gameweek INT, first_kickoff TIMESTAMPTZ, last_kickoff TIMESTAMPTZ, settle_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH spans AS (
    SELECT f.season, f.gameweek, min(f.kickoff_time) AS first_kickoff, max(f.kickoff_time) AS last_kickoff
    FROM public.pl_fixtures f
    WHERE f.kickoff_time IS NOT NULL AND f.gameweek IS NOT NULL
    GROUP BY f.season, f.gameweek
  ), ordered AS (
    SELECT s.*, lag(s.last_kickoff) OVER (ORDER BY s.first_kickoff) AS prev_last
    FROM spans s
  )
  SELECT o.season, o.gameweek, o.first_kickoff, o.last_kickoff,
    CASE
      WHEN o.prev_last IS NOT NULL
        AND o.prev_last < o.first_kickoff
        AND o.first_kickoff - INTERVAL '24 hours' < o.prev_last
      THEN o.prev_last + (o.first_kickoff - o.prev_last) / 2
      ELSE o.first_kickoff - INTERVAL '24 hours'
    END
  FROM ordered o;
$$;

-- Where a moment sits in the Transfer Day cycle:
--   next_settle_at   when a bid placed now settles (NULL once the season's done)
--   last_settle_at   the most recent Transfer Day
--   instant_open     whether instant signings are open: the last Transfer Day
--                    has passed and its gameweek's last match hasn't kicked off
--   instant_season, instant_gameweek   the gameweek instant signings are for
CREATE OR REPLACE FUNCTION public.transfer_day_window(p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
  next_settle_at TIMESTAMPTZ,
  last_settle_at TIMESTAMPTZ,
  instant_open BOOLEAN,
  instant_season TEXT,
  instant_gameweek INT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH sched AS (SELECT * FROM public.transfer_day_schedule()),
  last_td AS (SELECT * FROM sched WHERE settle_at <= p_at ORDER BY settle_at DESC LIMIT 1)
  SELECT
    (SELECT min(settle_at) FROM sched WHERE settle_at > p_at),
    (SELECT settle_at FROM last_td),
    COALESCE((SELECT p_at < last_kickoff FROM last_td), FALSE),
    (SELECT season FROM last_td),
    (SELECT gameweek FROM last_td);
$$;

CREATE OR REPLACE FUNCTION public.next_transfer_day(p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT min(settle_at) FROM public.transfer_day_schedule() WHERE settle_at > p_at;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_day_schedule() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_day_window(TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_transfer_day(TIMESTAMPTZ) TO authenticated, service_role;

-- The auction resolver opens a 72-hour auction on a player a winning bid
-- dropped. In a redraft league that auction runs to the next Transfer Day
-- instead. Swap the one line; fail loudly if it isn't there exactly once.
DO $patch$
DECLARE
  v_def  TEXT;
  v_old  TEXT := 'v_auction_expiry := NOW() + INTERVAL ''72 hours'';';
  v_new  TEXT := 'v_auction_expiry := CASE WHEN COALESCE((SELECT l.is_dynasty FROM public.leagues l WHERE l.id = p_league_id), TRUE) THEN NOW() + INTERVAL ''72 hours'' ELSE COALESCE(public.next_transfer_day(NOW()), NOW() + INTERVAL ''72 hours'') END;';
  v_hits INT;
BEGIN
  SELECT pg_get_functiondef('public.resolve_single_player_auction_rpc(uuid, uuid, integer[])'::regprocedure) INTO v_def;
  v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION 'Expected one dropped-player auction expiry in resolve_single_player_auction_rpc, found %', v_hits;
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END
$patch$;

-- An instant signing after Transfer Day. Free, first come first served, and
-- atomic: an advisory lock on (league, player) means two managers can't both
-- sign the same player. Timing (the window and the player's own kickoff) and
-- the IR rule are checked by the route; this owns everything that must not
-- race. Returns {success, error?}.
CREATE OR REPLACE FUNCTION public.claim_free_agent_rpc(
  p_league_id UUID,
  p_team_id UUID,
  p_player_id UUID,
  p_drop_player_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_league      RECORD;
  v_player      RECORD;
  v_drop_entry  RECORD;
  v_team_name   TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_league_id::TEXT || ':' || p_player_id::TEXT));

  SELECT id, is_dynasty, status, roster_locked INTO v_league FROM public.leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'League not found.'); END IF;
  IF v_league.is_dynasty IS DISTINCT FROM FALSE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Instant signings are for redraft leagues.');
  END IF;
  IF v_league.status <> 'active' OR v_league.roster_locked THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Signings are closed right now.');
  END IF;

  SELECT team_name INTO v_team_name FROM public.teams WHERE id = p_team_id AND league_id = p_league_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Club not found in this league.'); END IF;

  SELECT id, name, is_active INTO v_player FROM public.players WHERE id = p_player_id;
  IF NOT FOUND OR NOT v_player.is_active THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'That player isn''t available.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.roster_entries WHERE league_id = p_league_id AND player_id = p_player_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', v_player.name || ' is already at a club.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.waiver_claims
    WHERE league_id = p_league_id AND player_id = p_player_id AND status = 'pending' AND is_auction
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', v_player.name || ' is up for auction until the next Transfer Day. Bid for him instead.');
  END IF;

  IF public.team_is_holding(p_team_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Activate or drop your held player first.');
  END IF;

  IF p_drop_player_id IS NOT NULL THEN
    SELECT id, status INTO v_drop_entry FROM public.roster_entries
    WHERE team_id = p_team_id AND player_id = p_drop_player_id;
    IF NOT FOUND OR v_drop_entry.status NOT IN ('active', 'bench') THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'The player you named to drop isn''t in your squad.');
    END IF;
  ELSIF public.team_active_count(p_team_id) >= public.team_roster_limit(p_team_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Your squad is full. Select a player to drop.');
  END IF;

  IF p_drop_player_id IS NOT NULL THEN
    DELETE FROM public.roster_entries WHERE id = v_drop_entry.id;
    INSERT INTO public.transactions (league_id, team_id, player_id, type, compensation_amount, notes)
    VALUES (p_league_id, p_team_id, p_drop_player_id, 'drop', 0,
      'Dropped ' || (SELECT name FROM public.players WHERE id = p_drop_player_id) || ' to sign ' || v_player.name);
    -- The dropped player is up for auction until the next Transfer Day.
    INSERT INTO public.waiver_claims (
      league_id, team_id, player_id, faab_bid, priority, status, gameweek, is_auction, expires_at, opens_at, system_seeded,
      market_value_at_auction
    ) VALUES (
      p_league_id, NULL, p_drop_player_id, 0, 999, 'pending', 0, TRUE,
      COALESCE(public.next_transfer_day(NOW()), NOW() + INTERVAL '72 hours'), NULL, TRUE,
      (SELECT market_value FROM public.players WHERE id = p_drop_player_id)
    );
  END IF;

  INSERT INTO public.roster_entries (team_id, player_id, status, acquisition_type, acquisition_value, acquired_at)
  VALUES (p_team_id, p_player_id, 'bench', 'free_agent', 0, NOW());

  INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes)
  VALUES (p_league_id, p_team_id, p_player_id, 'free_agent_pickup', 0, v_team_name || ' signed ' || v_player.name || ' after Transfer Day');

  RETURN jsonb_build_object('success', TRUE, 'player_name', v_player.name);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_agent_rpc(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_agent_rpc(UUID, UUID, UUID, UUID) TO service_role;
