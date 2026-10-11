-- 169: Caretaker clubs
--
-- A manager who leaves a league after its draft, or is removed by the
-- commissioner, no longer takes the club with them. Deleting a team cascades
-- through its opponents' matchups, its cup ties and every season archive row
-- that names it, so the club stays and the Caretaker runs it until a new
-- manager joins. Spec: docs/superpowers/specs/2026-10-04-expansion-and-takeovers-design.md
--
-- A Caretaker club is a team with no manager: user_id IS NULL. caretaker_since
-- records when it was handed over, and the check keeps the two in step.

ALTER TABLE public.teams ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS caretaker_since TIMESTAMPTZ;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_caretaker_has_no_manager;
ALTER TABLE public.teams ADD CONSTRAINT teams_caretaker_has_no_manager
  CHECK ((user_id IS NULL) = (caretaker_since IS NOT NULL));

CREATE OR REPLACE FUNCTION public.team_is_caretaker(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT t.user_id IS NULL FROM public.teams t WHERE t.id = p_team_id), FALSE);
$$;

-- ── Handing a club to the Caretaker ─────────────────────────────────────────
-- Removes the manager and clears everything they had in flight that the club
-- can no longer follow through on:
--   * live auction bids (the same withdrawal a hold triggers)
--   * pending trade and loan proposals, in either direction
--   * listings nobody has bid on yet
-- Deals already agreed and deferred to the end of the gameweek
-- (accepted_deferred) still go through, and a listing already in bidding runs
-- to its end, as it would if the manager had stayed.
CREATE OR REPLACE FUNCTION public.hand_club_to_caretaker_rpc(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team       RECORD;
  v_withdrawn  JSONB;
  v_trades     INT;
  v_loans      INT;
  v_listings   INT;
BEGIN
  SELECT id, league_id, user_id INTO v_team
  FROM public.teams WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;

  IF v_team.user_id IS NULL THEN
    RETURN jsonb_build_object('already_caretaker', TRUE);
  END IF;

  UPDATE public.teams
  SET user_id = NULL,
      caretaker_since = NOW(),
      last_seen_at = NULL,
      updated_at = NOW()
  WHERE id = p_team_id;

  DELETE FROM public.league_members
  WHERE league_id = v_team.league_id AND user_id = v_team.user_id;

  v_withdrawn := public.withdraw_team_bids_for_hold(p_team_id);

  UPDATE public.trade_proposals
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending' AND (team_a_id = p_team_id OR team_b_id = p_team_id);
  GET DIAGNOSTICS v_trades = ROW_COUNT;

  UPDATE public.player_loans
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending' AND (lender_team_id = p_team_id OR borrower_team_id = p_team_id);
  GET DIAGNOSTICS v_loans = ROW_COUNT;

  UPDATE public.player_sale_listings
  SET status = 'cancelled', updated_at = NOW()
  WHERE seller_team_id = p_team_id AND status = 'pending';
  GET DIAGNOSTICS v_listings = ROW_COUNT;

  RETURN jsonb_build_object(
    'already_caretaker', FALSE,
    'former_user_id', v_team.user_id,
    'league_id', v_team.league_id,
    'withdrawn_bids', v_withdrawn,
    'cancelled_trades', v_trades,
    'cancelled_loans', v_loans,
    'cancelled_listings', v_listings
  );
END;
$$;

-- ── A new manager taking over ───────────────────────────────────────────────
-- Assigns the longest-waiting Caretaker club in the league to the joining
-- user. SKIP LOCKED keeps two people joining at once from claiming the same
-- club. Returns NULL when the league has no Caretaker club.
CREATE OR REPLACE FUNCTION public.claim_caretaker_club_rpc(p_league_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.teams WHERE league_id = p_league_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'You already manage a club in this league';
  END IF;

  SELECT id INTO v_team_id
  FROM public.teams
  WHERE league_id = p_league_id AND user_id IS NULL
  ORDER BY caretaker_since, id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_team_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.teams
  SET user_id = p_user_id, caretaker_since = NULL, updated_at = NOW()
  WHERE id = v_team_id;

  INSERT INTO public.league_members (league_id, user_id)
  VALUES (p_league_id, p_user_id)
  ON CONFLICT DO NOTHING;

  RETURN v_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hand_club_to_caretaker_rpc(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_caretaker_club_rpc(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hand_club_to_caretaker_rpc(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_caretaker_club_rpc(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_is_caretaker(UUID) TO authenticated, service_role;
