-- Migration 187: apply_player_position_ranks writes only the rows that change.
--
-- The live stats sync (every five minutes through a gameweek) calls this with
-- every player's rank list. The old body first reset every player holding any
-- rank to '[]' and then rewrote every player in the payload, so each tick
-- updated each ranked player twice whether or not a rank had moved. That was
-- the bulk of the 8.4M `players` updates and 8.5 GB of WAL that exhausted the
-- project's disk IO budget.
--
-- Now a player is touched only when the stored list differs from the new one,
-- and a player missing from the payload is cleared only if they hold ranks.
-- The return value is the number of rows written, which `recomputePositionRanks`
-- reports as `written`.

CREATE OR REPLACE FUNCTION public.apply_player_position_ranks(p_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cleared INTEGER;
  v_written INTEGER;
BEGIN
  WITH payload AS (
    SELECT
      (e->>'player_id')::uuid AS player_id,
      COALESCE(e->'position_ranks', '[]'::jsonb) AS position_ranks
    FROM jsonb_array_elements(COALESCE(p_payload, '[]'::jsonb)) e
  ),
  cleared AS (
    UPDATE public.players p
    SET position_ranks = '[]'::jsonb
    WHERE p.position_ranks <> '[]'::jsonb
      AND NOT EXISTS (SELECT 1 FROM payload pl WHERE pl.player_id = p.id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_cleared FROM cleared;

  WITH payload AS (
    SELECT
      (e->>'player_id')::uuid AS player_id,
      COALESCE(e->'position_ranks', '[]'::jsonb) AS position_ranks
    FROM jsonb_array_elements(COALESCE(p_payload, '[]'::jsonb)) e
  ),
  upd AS (
    UPDATE public.players p
    SET position_ranks = pl.position_ranks
    FROM payload pl
    WHERE p.id = pl.player_id
      AND p.position_ranks IS DISTINCT FROM pl.position_ranks
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_written FROM upd;

  RETURN v_cleared + v_written;
END;
$function$;
