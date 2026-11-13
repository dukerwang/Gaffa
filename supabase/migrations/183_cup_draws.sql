-- 183: round-by-round cup draws, and a record of how each cup tie was decided.
--
-- Spec: docs/superpowers/specs/2026-10-25-cups-redesign-design.md
--
-- The League Cup is drawn at random after its seeded first round, and a small
-- league's Consolation Cup is drawn once its Champions Cup losers are in. The
-- pairing is done in TypeScript (src/lib/tournaments/draw.ts) so it can be
-- tested; apply_cup_draw only guards and records it, so three callers racing
-- to resolve one gameweek can never draw a round twice.

ALTER TABLE public.tournament_matchups
  ADD COLUMN IF NOT EXISTS decided_by text
  CHECK (decided_by IN ('score', 'best_performer', 'position'));

ALTER TABLE public.tournament_rounds
  ADD COLUMN IF NOT EXISTS drawn_at timestamptz;

-- League Cup ties no longer lead to a fixed tie in the next round. Only links
-- change here; no club, score or result does. Finished cups are left alone.
UPDATE public.tournament_matchups m
SET next_matchup_id = NULL
FROM public.tournament_rounds r, public.tournaments t
WHERE r.id = m.round_id
  AND t.id = r.tournament_id
  AND t.type = 'secondary_cup'
  AND t.status <> 'completed'
  AND m.next_matchup_id IS NOT NULL;

-- p_ties: [{ "position": 0, "a": "<team uuid>", "b": "<team uuid>" | null }, ...]
-- Returns true when it wrote the draw, false when it changed nothing.
CREATE OR REPLACE FUNCTION public.apply_cup_draw(p_round_id uuid, p_ties jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_round      public.tournament_rounds%ROWTYPE;
  v_prev_id    uuid;
  v_entrants   uuid[];
  v_given      uuid[];
  v_tie_count  int;
  v_tie        jsonb;
  v_pos        int;
  v_a          uuid;
  v_b          uuid;
  v_target     public.tournament_matchups%ROWTYPE;
BEGIN
  SELECT * INTO v_round FROM public.tournament_rounds WHERE id = p_round_id FOR UPDATE;
  IF NOT FOUND OR v_round.drawn_at IS NOT NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_prev_id
  FROM public.tournament_rounds
  WHERE tournament_id = v_round.tournament_id AND round_number = v_round.round_number - 1;

  IF v_prev_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tournament_matchups
      WHERE round_id = v_prev_id AND status <> 'completed'
    ) THEN
      RETURN false;
    END IF;
    SELECT coalesce(array_agg(winner_id ORDER BY winner_id), '{}') INTO v_entrants
    FROM public.tournament_matchups
    WHERE round_id = v_prev_id AND winner_id IS NOT NULL;
  ELSE
    SELECT coalesce(array_agg(t ORDER BY t), '{}') INTO v_entrants
    FROM (
      SELECT team_a_id AS t FROM public.tournament_matchups WHERE round_id = p_round_id AND team_a_id IS NOT NULL
      UNION ALL
      SELECT team_b_id FROM public.tournament_matchups WHERE round_id = p_round_id AND team_b_id IS NOT NULL
    ) placed;
  END IF;

  SELECT count(*) INTO v_tie_count FROM public.tournament_matchups WHERE round_id = p_round_id;
  IF jsonb_typeof(p_ties) <> 'array' OR jsonb_array_length(p_ties) <> v_tie_count THEN
    RETURN false;
  END IF;

  SELECT coalesce(array_agg(t ORDER BY t), '{}') INTO v_given
  FROM (
    SELECT (e->>'a')::uuid AS t FROM jsonb_array_elements(p_ties) e WHERE e->>'a' IS NOT NULL
    UNION ALL
    SELECT (e->>'b')::uuid FROM jsonb_array_elements(p_ties) e WHERE e->>'b' IS NOT NULL
  ) given;

  IF v_given IS DISTINCT FROM v_entrants OR cardinality(v_entrants) = 0 THEN
    RETURN false;
  END IF;

  FOR v_tie IN SELECT * FROM jsonb_array_elements(p_ties) LOOP
    v_pos := (v_tie->>'position')::int;
    v_a := (v_tie->>'a')::uuid;
    v_b := nullif(v_tie->>'b', '')::uuid;

    SELECT * INTO v_target
    FROM public.tournament_matchups
    WHERE round_id = p_round_id AND bracket_position = v_pos
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'apply_cup_draw: round % has no tie at position %', p_round_id, v_pos;
    END IF;

    IF v_b IS NOT NULL THEN
      UPDATE public.tournament_matchups
      SET team_a_id = v_a, team_b_id = v_b, status = 'active', winner_id = NULL, decided_by = NULL
      WHERE id = v_target.id;
    ELSE
      UPDATE public.tournament_matchups
      SET team_a_id = v_a, team_b_id = NULL, status = 'completed', winner_id = v_a, decided_by = NULL
      WHERE id = v_target.id;

      -- A bye in a linked bracket (the Consolation Cup keeps its links after
      -- its one draw) goes straight through, the way advanceWinner places a
      -- winner: even positions fill team_a, odd fill team_b.
      IF v_target.next_matchup_id IS NOT NULL THEN
        IF v_pos % 2 = 0 THEN
          UPDATE public.tournament_matchups SET team_a_id = v_a WHERE id = v_target.next_matchup_id;
        ELSE
          UPDATE public.tournament_matchups SET team_b_id = v_a WHERE id = v_target.next_matchup_id;
        END IF;
        UPDATE public.tournament_matchups
        SET status = 'active'
        WHERE id = v_target.next_matchup_id AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.tournament_rounds SET drawn_at = now() WHERE id = p_round_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_cup_draw(uuid, jsonb) FROM PUBLIC, anon, authenticated;
