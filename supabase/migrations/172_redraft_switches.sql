-- 172: Redraft switches
--
-- Redraft leagues (leagues.is_dynasty = FALSE) switch off the systems whose
-- payoff only shows across seasons. Most of them are already per-league
-- settings that the database code reads, so a redraft league carries settings
-- that make them pay or allow nothing (src/lib/leagues/features.ts,
-- REDRAFT_LEAGUE_SETTINGS). Spec: docs/superpowers/specs/2026-10-04-redraft-mode-design.md
--
-- 1. Existing redraft leagues get those settings. The create route sets them
--    for new ones.
-- 2. The auction resolver charges no drop severance in a redraft league:
--    dropping is routine in redraft, and the fee punishes the main thing
--    casual managers do.

UPDATE public.leagues
SET merit_win = 0, merit_draw = 0, merit_loss = 0, merit_bye = 0,
    solidarity_share = 0, scout_share = 0,
    taxi_size = 0, max_loan_outs = 0, max_loan_ins = 0,
    retained_slots = 0,
    departure_compensation_rate = 0
WHERE is_dynasty = FALSE;

-- The resolver is long and was last redefined in migration 164. Rather than
-- restate all of it, swap the one severance line and fail loudly if that
-- line isn't there exactly once.
DO $patch$
DECLARE
  v_def  TEXT;
  v_old  TEXT := 'v_severance_fee := GREATEST(2, FLOOR(COALESCE(v_drop_player_mv, 0) * 0.2));';
  v_new  TEXT := 'v_severance_fee := CASE WHEN COALESCE((SELECT l.is_dynasty FROM public.leagues l WHERE l.id = p_league_id), TRUE) THEN GREATEST(2, FLOOR(COALESCE(v_drop_player_mv, 0) * 0.2)) ELSE 0 END;';
  v_hits INT;
BEGIN
  SELECT pg_get_functiondef('public.resolve_single_player_auction_rpc(uuid, uuid, integer[])'::regprocedure) INTO v_def;
  v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION 'Expected one severance line in resolve_single_player_auction_rpc, found %', v_hits;
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END
$patch$;
