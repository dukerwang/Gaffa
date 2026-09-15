-- 166_club_facility_upgrades.sql
--
-- Club Facilities: permanent, one-time upgrades that raise a single club's
-- Academy, Injured Reserve and Loans Out capacity above the league default.
-- Spec: docs/superpowers/specs/2026-09-15-club-facility-upgrades-design.md
--
--   Academy          3 -> 4 (€60m) -> 5 (€90m)
--   Injured Reserve  2 -> 3 (€60m)
--   Loans Out        1 -> 2 (€30m)
--
-- The ladders are duplicated in src/lib/facilities/facilities.ts. Keep the two
-- in step.
--
-- Also raises the free-agent bid floor from 50% to 60% of market value.

-- ── 1. Ledger type ─────────────────────────────────────────────────────────────
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'facility_upgrade';

-- ── 2. Per-team capacity. NULL inherits the league setting. ──────────────────
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS academy_slots  INT NULL,
  ADD COLUMN IF NOT EXISTS ir_slots       INT NULL,
  ADD COLUMN IF NOT EXISTS loan_out_slots INT NULL;

-- ── 3. The one derivation of a team's effective slots ────────────────────────
-- Every RPC that enforces one of these limits reads it through here, so a
-- purchased slot can never be honoured by one path and refused by another.
CREATE OR REPLACE FUNCTION public.team_academy_slots(p_team_id UUID)
RETURNS INT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(t.academy_slots, l.taxi_size, 3)
  FROM public.teams t JOIN public.leagues l ON l.id = t.league_id
  WHERE t.id = p_team_id
$$;

CREATE OR REPLACE FUNCTION public.team_ir_slots(p_team_id UUID)
RETURNS INT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(t.ir_slots, l.ir_size, 2)
  FROM public.teams t JOIN public.leagues l ON l.id = t.league_id
  WHERE t.id = p_team_id
$$;

CREATE OR REPLACE FUNCTION public.team_loan_out_slots(p_team_id UUID)
RETURNS INT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(t.loan_out_slots, l.max_loan_outs, 1)
  FROM public.teams t JOIN public.leagues l ON l.id = t.league_id
  WHERE t.id = p_team_id
$$;

REVOKE EXECUTE ON FUNCTION public.team_academy_slots(UUID)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_ir_slots(UUID)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_loan_out_slots(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_academy_slots(UUID)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_ir_slots(UUID)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_loan_out_slots(UUID) TO authenticated, service_role;

-- ── 4. Route the existing limit checks through the team's own slots ──────────
-- Seven live functions compare against the league setting directly. Their
-- bodies have drifted from the files in this folder over time, so each is
-- patched in place from its live definition. Every replacement asserts it
-- matched exactly the expected number of times, so a future rewrite of one of
-- these functions fails this migration loudly instead of silently skipping it.
DO $migration$
DECLARE
  v_patch RECORD;
  v_def TEXT;
  v_hits INT;
BEGIN
  FOR v_patch IN
    SELECT * FROM (VALUES
      ('activate_held_rpc',
       '>= v_league.taxi_size THEN',
       '>= public.team_academy_slots(e.team_id) THEN', 1),
      ('activate_held_rpc',
       '>= v_league.ir_size THEN',
       '>= public.team_ir_slots(e.team_id) THEN', 1),
      ('execute_loan_acceptance_rpc',
       'IF v_lender_active_loans_count >= COALESCE(v_max_loan_outs, 1) THEN',
       'IF v_lender_active_loans_count >= public.team_loan_out_slots(p_lender_team_id) THEN', 1),
      ('execute_loan_recall_rpc',
       'AND re.status = ''taxi'') < v_taxi_size;',
       'AND re.status = ''taxi'') < public.team_academy_slots(v_lender_team_id);', 1),
      ('execute_trade_transaction_rpc',
       'GREATEST(0, v_taxi_size - (v_team_a_taxi_count',
       'GREATEST(0, public.team_academy_slots(v_trade.team_a_id) - (v_team_a_taxi_count', 1),
      ('execute_trade_transaction_rpc',
       'GREATEST(0, v_taxi_size - (v_team_b_taxi_count',
       'GREATEST(0, public.team_academy_slots(v_trade.team_b_id) - (v_team_b_taxi_count', 1),
      ('place_arrival_rpc',
       'AND re.player_id <> p_player_id) < v_taxi_size THEN',
       'AND re.player_id <> p_player_id) < public.team_academy_slots(p_team_id) THEN', 1),
      ('place_returning_loanee',
       'IF v_taxi_count < COALESCE(v_taxi_size, 3)',
       'IF v_taxi_count < public.team_academy_slots(p_lender_team_id)', 1),
      ('resolve_single_player_auction_rpc',
       'v_academy_count < v_academy_size',
       'v_academy_count < public.team_academy_slots(r.team_id)', 2)
    ) AS t(fn, old_text, new_text, expected)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_patch.fn;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'facility patch: function % not found', v_patch.fn;
    END IF;

    -- Already patched (re-run): the replacement text is present and the old is gone.
    IF position(v_patch.old_text IN v_def) = 0 AND position(v_patch.new_text IN v_def) > 0 THEN
      CONTINUE;
    END IF;

    v_hits := (length(v_def) - length(replace(v_def, v_patch.old_text, ''))) / length(v_patch.old_text);
    IF v_hits <> v_patch.expected THEN
      RAISE EXCEPTION 'facility patch: % matched % times in %, expected %',
        v_patch.old_text, v_hits, v_patch.fn, v_patch.expected;
    END IF;

    EXECUTE replace(v_def, v_patch.old_text, v_patch.new_text);
  END LOOP;
END
$migration$;

-- ── 5. Purchase RPC ──────────────────────────────────────────────────────────
-- Service role only: the API route checks the caller owns the team first.
-- A SECURITY DEFINER function granted to `authenticated` would let any signed-in
-- user spend any club's balance.
CREATE OR REPLACE FUNCTION public.purchase_facility_upgrade_rpc(
  p_team_id UUID,
  p_facility TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_current INT;
  v_next INT;
  v_cost INT;
  v_label TEXT;
BEGIN
  SELECT t.id, t.league_id, t.faab_budget
  INTO v_team
  FROM public.teams t
  WHERE t.id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TEAM_NOT_FOUND', 'error', 'Club not found.');
  END IF;

  IF p_facility = 'academy' THEN
    v_current := public.team_academy_slots(p_team_id);
    v_label := 'Academy';
    v_cost := CASE v_current WHEN 3 THEN 60 WHEN 4 THEN 90 END;
  ELSIF p_facility = 'ir' THEN
    v_current := public.team_ir_slots(p_team_id);
    v_label := 'Injured Reserve';
    v_cost := CASE v_current WHEN 2 THEN 60 END;
  ELSIF p_facility = 'loans_out' THEN
    v_current := public.team_loan_out_slots(p_team_id);
    v_label := 'Loans Out';
    v_cost := CASE v_current WHEN 1 THEN 30 END;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNKNOWN_FACILITY', 'error', 'Unknown facility.');
  END IF;

  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'FULLY_BUILT',
      'error', v_label || ' is fully built.');
  END IF;

  v_next := v_current + 1;

  IF COALESCE(v_team.faab_budget, 0) < v_cost THEN
    RETURN jsonb_build_object('success', false, 'code', 'INSUFFICIENT_BALANCE',
      'error', 'Not enough Club Balance. Slot ' || v_next || ' costs €' || v_cost
        || 'm and you have €' || COALESCE(v_team.faab_budget, 0) || 'm.');
  END IF;

  UPDATE public.teams
  SET faab_budget    = faab_budget - v_cost,
      academy_slots  = CASE WHEN p_facility = 'academy'   THEN v_next ELSE academy_slots END,
      ir_slots       = CASE WHEN p_facility = 'ir'        THEN v_next ELSE ir_slots END,
      loan_out_slots = CASE WHEN p_facility = 'loans_out' THEN v_next ELSE loan_out_slots END,
      updated_at     = NOW()
  WHERE id = p_team_id;

  INSERT INTO public.transactions (league_id, team_id, type, faab_bid, notes, processed_at, created_at)
  VALUES (v_team.league_id, p_team_id, 'facility_upgrade', v_cost,
          v_label || ' Slot ' || v_next, NOW(), NOW());

  RETURN jsonb_build_object(
    'success', true,
    'facility', p_facility,
    'slots', v_next,
    'cost', v_cost,
    'balance', v_team.faab_budget - v_cost
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_facility_upgrade_rpc(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_facility_upgrade_rpc(UUID, TEXT) TO service_role;

-- ── 6. Free-agent bid floor 50% -> 60% ───────────────────────────────────────
ALTER TABLE public.leagues ALTER COLUMN free_agent_bid_floor SET DEFAULT 0.600;

UPDATE public.leagues
SET free_agent_bid_floor = 0.600
WHERE free_agent_bid_floor = 0.500;
