-- 173: The redraft season cycle
--
-- A redraft league drafts a fresh squad every season. At the reset, after the
-- season is archived, the league returns to `pre_draft`: squads are cleared,
-- Club Balances go back to the league's budget, and the next draft order is
-- shuffled. Spec: docs/superpowers/specs/2026-10-04-redraft-mode-design.md
--
-- draft_picks is unique on (league_id, round, pick) and (league_id, player_id),
-- and four functions count and number picks per league (execute_draft_pick,
-- make_draft_pick_rpc, auto_draft_pick, auto_pick_expired_drafts). Rather than
-- teach all of that about seasons, the reset moves the finished draft into
-- draft_picks_archive and clears it, so draft_picks only ever holds the current
-- season's draft. Dynasty leagues draft once and never touch the archive.

CREATE TABLE IF NOT EXISTS public.draft_picks_archive (
  id UUID PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  round INT NOT NULL,
  pick INT NOT NULL,
  picked_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, season, round, pick)
);

ALTER TABLE public.draft_picks_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members read their league's past drafts"
  ON public.draft_picks_archive FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.league_members m
    WHERE m.league_id = draft_picks_archive.league_id AND m.user_id = (SELECT auth.uid())
  ));

-- Runs after the season reset has archived standings, matchups, cups and
-- player stats and advanced current_season. Everything here is the part that
-- only a redraft league does, in one transaction so a league can never be left
-- half reset.
CREATE OR REPLACE FUNCTION public.reset_redraft_league_rpc(p_league_id UUID, p_season_from TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_league   RECORD;
  v_picks    INT;
  v_entries  INT;
  v_claims   INT;
BEGIN
  SELECT id, is_dynasty, faab_budget INTO v_league
  FROM public.leagues WHERE id = p_league_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found';
  END IF;
  IF v_league.is_dynasty IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Only a redraft league is reset to a new draft';
  END IF;

  -- 1. Last season's draft goes to the archive.
  INSERT INTO public.draft_picks_archive (id, league_id, season, team_id, player_id, round, pick, picked_at)
  SELECT id, league_id, p_season_from, team_id, player_id, round, pick, picked_at
  FROM public.draft_picks WHERE league_id = p_league_id
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_picks = ROW_COUNT;

  DELETE FROM public.draft_picks WHERE league_id = p_league_id;
  DELETE FROM public.draft_queues WHERE league_id = p_league_id;

  -- 2. Nothing still open carries into the new season.
  UPDATE public.waiver_claims SET status = 'rejected'
  WHERE league_id = p_league_id AND status = 'pending';
  GET DIAGNOSTICS v_claims = ROW_COUNT;
  DELETE FROM public.auction_state WHERE league_id = p_league_id AND status <> 'resolved';
  DELETE FROM public.pending_drops WHERE league_id = p_league_id;
  UPDATE public.trade_proposals SET status = 'cancelled', updated_at = NOW()
  WHERE league_id = p_league_id AND status IN ('pending', 'accepted_deferred');

  -- 3. Every squad starts empty.
  DELETE FROM public.roster_entries
  WHERE team_id IN (SELECT id FROM public.teams WHERE league_id = p_league_id);
  GET DIAGNOSTICS v_entries = ROW_COUNT;

  -- 4. Every club gets the league's budget back, and a new random draft order.
  WITH shuffled AS (
    SELECT id, row_number() OVER (ORDER BY random()) AS slot
    FROM public.teams WHERE league_id = p_league_id
  )
  UPDATE public.teams t
  SET faab_budget = v_league.faab_budget,
      draft_order = s.slot,
      consecutive_autopicks = 0,
      updated_at = NOW()
  FROM shuffled s
  WHERE t.id = s.id;

  -- 5. The league waits for its next draft. Rosters unlock (there are none to
  --    protect); free-agent bidding stays closed until the draft finishes.
  UPDATE public.leagues
  SET status = 'pre_draft',
      roster_locked = FALSE,
      draft_scheduled_at = NULL,
      updated_at = NOW()
  WHERE id = p_league_id;

  RETURN jsonb_build_object(
    'archived_picks', v_picks,
    'cleared_roster_entries', v_entries,
    'withdrawn_claims', v_claims
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_redraft_league_rpc(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_redraft_league_rpc(UUID, TEXT) TO service_role;
