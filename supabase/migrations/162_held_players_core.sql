-- Gaffa — Migration 162: held players (part 2 of 4) — core
--
-- Requires 161 to be committed first ('held' enum value).
-- Spec: docs/superpowers/specs/2026-09-13-held-players-design.md (rules R1–R21).
--
-- What this adds:
--   * held_at / held_source on roster_entries
--   * one room calculation in SQL, mirroring src/lib/roster/capacity.ts
--   * place_arrival_rpc — the single way a returning or won player lands
--   * activate_held_rpc — the manager's way in (window check lives in the route)
--   * bid withdrawal when a hold begins
--   * the lineup-lock boundary
--
-- Nothing here changes an existing function, so no live behaviour moves until
-- 163 and 164 switch callers over.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.roster_entries
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_source TEXT;

ALTER TABLE public.roster_entries DROP CONSTRAINT IF EXISTS roster_entries_held_source_check;
ALTER TABLE public.roster_entries
  ADD CONSTRAINT roster_entries_held_source_check
  CHECK (held_source IS NULL OR held_source IN ('loan_return', 'loan_abroad_return', 'retained_return', 'auction'));

-- A held row always says when and why; nothing else carries either.
ALTER TABLE public.roster_entries DROP CONSTRAINT IF EXISTS roster_entries_held_consistency;
ALTER TABLE public.roster_entries
  ADD CONSTRAINT roster_entries_held_consistency
  CHECK (
    (status = 'held' AND held_at IS NOT NULL AND held_source IS NOT NULL)
    OR (status <> 'held' AND held_at IS NULL AND held_source IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_roster_entries_held
  ON public.roster_entries (team_id)
  WHERE status = 'held';

COMMENT ON COLUMN public.roster_entries.held_at IS
  'When this player was held (arrived with no squad room). Drives the lineup lock: see held_lineup_lock_at.';
COMMENT ON COLUMN public.roster_entries.held_source IS
  'Why he is held: loan_return, loan_abroad_return, retained_return or auction.';

-- ── 2. Room ──────────────────────────────────────────────────────────────────
-- Must match UNCOUNTED_ROSTER_STATUSES in src/lib/roster/capacity.ts. The auction
-- settlement function used to count loan_in and ignore buyback slots while the
-- app did the opposite, so a bid could pass placement and fail settlement.
CREATE OR REPLACE FUNCTION public.team_active_count(p_team_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(1)::INT
  FROM public.roster_entries re
  WHERE re.team_id = p_team_id
    AND re.status NOT IN ('ir', 'taxi', 'loan_in', 'held');
$$;

-- Mirrors deriveRosterCapacity's limit: roster_size plus one place per active
-- loan-out whose buyback was paid (countBuybackSlots).
CREATE OR REPLACE FUNCTION public.team_roster_limit(p_team_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    COALESCE((SELECT l.roster_size FROM public.teams t JOIN public.leagues l ON l.id = t.league_id WHERE t.id = p_team_id), 20)
    + (SELECT count(1)::INT FROM public.player_loans pl
       WHERE pl.lender_team_id = p_team_id AND pl.status = 'active' AND pl.slot_buyback_used = TRUE)
  )::INT;
$$;

CREATE OR REPLACE FUNCTION public.team_is_holding(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.roster_entries re WHERE re.team_id = p_team_id AND re.status = 'held');
$$;

-- ── 3. Lineup lock boundary ──────────────────────────────────────────────────
-- R11/R12: the lock starts at the first kickoff of the first gameweek whose
-- earliest kickoff is after the team's oldest hold. A hold that begins mid-
-- gameweek therefore never locks the week already under way, and a hold carried
-- through the summer locks from gameweek 1. Gameweeks are grouped by season so
-- the rollover can't pair one season's number with another's kickoffs. NULL when
-- nothing is held or no later fixture is known yet.
CREATE OR REPLACE FUNCTION public.held_lineup_lock_at(p_team_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH oldest AS (
    SELECT min(re.held_at) AS held_at
    FROM public.roster_entries re
    WHERE re.team_id = p_team_id AND re.status = 'held'
  ), gw_starts AS (
    SELECT f.season, f.gameweek, min(f.kickoff_time) AS first_kickoff
    FROM public.pl_fixtures f
    WHERE f.kickoff_time IS NOT NULL AND f.gameweek IS NOT NULL
    GROUP BY f.season, f.gameweek
  )
  SELECT min(g.first_kickoff)
  FROM gw_starts g, oldest o
  WHERE o.held_at IS NOT NULL
    AND g.first_kickoff > o.held_at;
$$;

CREATE OR REPLACE FUNCTION public.held_lineup_locked(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.held_lineup_lock_at(p_team_id) <= NOW(), FALSE);
$$;

-- ── 4. Bid withdrawal ────────────────────────────────────────────────────────
-- R19: a team that starts holding a player can't sign anyone, so its live bids
-- come off the board at once rather than sitting as leads that can never win.
--
-- Rejecting the claims fires trg_auction_state_upd (migration 078), and
-- refresh_auction_state recomputes the lead from the remaining pending claims.
-- expires_at is left alone: bids only ever extend it, so the withdrawn bid's
-- extension stands and the remaining bidders lose no time.
CREATE OR REPLACE FUNCTION public.withdraw_team_bids_for_hold(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_withdrawn JSONB;
BEGIN
  WITH w AS (
    UPDATE public.waiver_claims wc
    SET status = 'rejected'
    WHERE wc.team_id = p_team_id
      AND wc.is_auction = TRUE
      AND wc.status = 'pending'
    RETURNING wc.id, wc.player_id, wc.faab_bid
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('claim_id', w.id, 'player_id', w.player_id, 'player_name', p.name, 'faab_bid', w.faab_bid)),
    '[]'::JSONB
  )
  INTO v_withdrawn
  FROM w
  LEFT JOIN public.players p ON p.id = w.player_id;

  RETURN v_withdrawn;
END;
$$;

-- ── 5. Placement ─────────────────────────────────────────────────────────────
-- R1/R2: academy if he left from it and still qualifies, reserves if there's
-- room, otherwise held. Upserts on (player_id, team_id) because a loan return
-- already has the lender's loan_out row to update. The room count excludes the
-- arriving player's own row, since a loan return's loan_out row is already
-- counted and he is the one being placed.
CREATE OR REPLACE FUNCTION public.place_arrival_rpc(
  p_team_id            UUID,
  p_player_id          UUID,
  p_origin_status      roster_status,
  p_source             TEXT,
  p_acquisition_type   acquisition_type,
  p_acquisition_value  NUMERIC
)
RETURNS TABLE (
  entry_id        UUID,
  placed_status   roster_status,
  withdrawn_bids  JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_status     roster_status;
  v_taxi_size  INT;
  v_age_limit  INT;
  v_dob        DATE;
  v_withdrawn  JSONB := '[]'::JSONB;
  v_id         UUID;
BEGIN
  PERFORM 1 FROM public.teams t WHERE t.id = p_team_id FOR UPDATE;

  IF p_origin_status = 'taxi' THEN
    SELECT COALESCE(l.taxi_size, 3), COALESCE(l.taxi_age_limit, 21)
    INTO v_taxi_size, v_age_limit
    FROM public.teams t JOIN public.leagues l ON l.id = t.league_id
    WHERE t.id = p_team_id;

    SELECT p.date_of_birth INTO v_dob FROM public.players p WHERE p.id = p_player_id;

    IF v_dob IS NOT NULL
       AND DATE_PART('year', AGE(v_dob)) <= v_age_limit
       AND (SELECT count(1) FROM public.roster_entries re
            WHERE re.team_id = p_team_id AND re.status = 'taxi' AND re.player_id <> p_player_id) < v_taxi_size THEN
      v_status := 'taxi';
    END IF;
  END IF;

  IF v_status IS NULL THEN
    IF (SELECT count(1) FROM public.roster_entries re
        WHERE re.team_id = p_team_id
          AND re.player_id <> p_player_id
          AND re.status NOT IN ('ir', 'taxi', 'loan_in', 'held')) < public.team_roster_limit(p_team_id) THEN
      v_status := 'bench';
    ELSE
      v_status := 'held';
    END IF;
  END IF;

  INSERT INTO public.roster_entries (team_id, player_id, status, acquisition_type, acquisition_value, acquired_at, held_at, held_source)
  VALUES (
    p_team_id, p_player_id, v_status, p_acquisition_type, p_acquisition_value, NOW(),
    CASE WHEN v_status = 'held' THEN NOW() END,
    CASE WHEN v_status = 'held' THEN p_source END
  )
  ON CONFLICT (player_id, team_id) DO UPDATE
  SET status = EXCLUDED.status,
      held_at = EXCLUDED.held_at,
      held_source = EXCLUDED.held_source
  RETURNING id INTO v_id;

  IF v_status = 'held' THEN
    v_withdrawn := public.withdraw_team_bids_for_hold(p_team_id);
  END IF;

  entry_id := v_id;
  placed_status := v_status;
  withdrawn_bids := v_withdrawn;
  RETURN NEXT;
END;
$$;

-- ── 6. Activation ────────────────────────────────────────────────────────────
-- R6: reserves need room; the academy needs age and a free place; IR needs the
-- same FPL status the IR route accepts (i, u, d) and a free place. The
-- mid-gameweek window is checked by the route, which knows the fixture state.
-- A retained player's decision stays return_pending while he's held, so
-- activating him resolves it to returned.
CREATE OR REPLACE FUNCTION public.activate_held_rpc(p_entry_id UUID, p_target roster_status)
RETURNS TABLE (
  team_id    UUID,
  player_id  UUID,
  new_status roster_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  e       RECORD;
  v_league RECORD;
  v_dob    DATE;
  v_fpl    TEXT;
BEGIN
  SELECT re.id, re.team_id, re.player_id, re.status INTO e
  FROM public.roster_entries re
  WHERE re.id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HELD_NOT_FOUND';
  END IF;
  IF e.status <> 'held' THEN
    RAISE EXCEPTION 'NOT_HELD';
  END IF;

  PERFORM 1 FROM public.teams t WHERE t.id = e.team_id FOR UPDATE;

  SELECT COALESCE(l.taxi_size, 3) AS taxi_size, COALESCE(l.taxi_age_limit, 21) AS age_limit, COALESCE(l.ir_size, 2) AS ir_size
  INTO v_league
  FROM public.teams t JOIN public.leagues l ON l.id = t.league_id
  WHERE t.id = e.team_id;

  SELECT p.date_of_birth, p.fpl_status INTO v_dob, v_fpl FROM public.players p WHERE p.id = e.player_id;

  IF p_target = 'bench' THEN
    IF public.team_active_count(e.team_id) >= public.team_roster_limit(e.team_id) THEN
      RAISE EXCEPTION 'NO_ROOM';
    END IF;
  ELSIF p_target = 'taxi' THEN
    IF v_dob IS NULL OR DATE_PART('year', AGE(v_dob)) > v_league.age_limit THEN
      RAISE EXCEPTION 'NOT_ACADEMY_ELIGIBLE';
    END IF;
    IF (SELECT count(1) FROM public.roster_entries re WHERE re.team_id = e.team_id AND re.status = 'taxi') >= v_league.taxi_size THEN
      RAISE EXCEPTION 'ACADEMY_FULL';
    END IF;
  ELSIF p_target = 'ir' THEN
    IF v_fpl IS NULL OR v_fpl NOT IN ('i', 'u', 'd') THEN
      RAISE EXCEPTION 'NOT_IR_ELIGIBLE';
    END IF;
    IF (SELECT count(1) FROM public.roster_entries re WHERE re.team_id = e.team_id AND re.status = 'ir') >= v_league.ir_size THEN
      RAISE EXCEPTION 'IR_FULL';
    END IF;
  ELSE
    RAISE EXCEPTION 'BAD_TARGET';
  END IF;

  UPDATE public.roster_entries re
  SET status = p_target, held_at = NULL, held_source = NULL
  WHERE re.id = e.id;

  UPDATE public.departure_decisions dd
  SET status = 'returned', resolved_at = NOW(), updated_at = NOW()
  WHERE dd.team_id = e.team_id
    AND dd.player_id = e.player_id
    AND dd.status = 'return_pending';

  team_id := e.team_id;
  player_id := e.player_id;
  new_status := p_target;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_active_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.team_roster_limit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.team_is_holding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.held_lineup_lock_at(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.held_lineup_locked(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_team_bids_for_hold(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_arrival_rpc(uuid, uuid, roster_status, text, acquisition_type, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_held_rpc(uuid, roster_status) FROM PUBLIC, anon, authenticated;
