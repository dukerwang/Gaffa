-- ============================================================
-- Migration 189: close a named target when its club ACQUIRES the player by
-- moving an existing roster row
--
-- 180 fired on INSERT only. Trades (154, 160) and loans move a player by
-- UPDATE roster_entries SET team_id, so a club that traded for the player it
-- had named kept an active target on a man it already owns. The spec says a
-- target fills by any route.
--
-- The function is unchanged; only the trigger widens.
-- ============================================================

DROP TRIGGER IF EXISTS trg_fill_targets_on_acquisition ON public.roster_entries;
CREATE TRIGGER trg_fill_targets_on_acquisition
  AFTER INSERT OR UPDATE OF team_id ON public.roster_entries
  FOR EACH ROW EXECUTE FUNCTION public.fill_targets_on_acquisition();

-- Settle any target a trade has already left stale. Harmless if none exist.
UPDATE public.player_targets t
SET status = 'filled'
WHERE t.status = 'active'
  AND t.target_kind = 'player'
  AND EXISTS (
    SELECT 1 FROM public.roster_entries re
    WHERE re.player_id = t.player_id
      AND re.team_id = t.team_id
  );
