-- Gaffa — Migration 163: held players (part 3 of 4) — loans, departures, trades
--
-- Requires 162 (place_arrival_rpc, team_is_holding, room helpers).
-- Spec: docs/superpowers/specs/2026-09-13-held-players-design.md.
--
-- Every function below that already existed is its previous definition with a
-- handful of exact text edits, applied to the live definition in the same way.
-- The source migration for each is named in its comment.
--
--   execute_loan_acceptance_rpc  (138) held players can't be loaned out; a
--                                team holding a player can't borrow (R7, R9)
--   resolve_expired_loan_rpc     (138) the return goes through place_arrival_rpc,
--                                so a full lender holds him instead of the old
--                                pending_activation limbo; the loan always ends
--                                expired, and ends before placement so a paid
--                                buyback place stops counting
--   execute_loan_recall_rpc      (138) a recall needs room and a lender who
--                                isn't holding (R19): a regretted bid can't be
--                                escaped by recalling into a full squad
--   execute_trade_transaction_rpc (160) held players count as no squad place
--                                going out; a holding team can't gain places;
--                                an incoming held player lands on the bench with
--                                his hold cleared; a held retained player's
--                                decision resolves when he's traded; a
--                                return_pending claim is no longer tradeable as a
--                                right, because he now has a roster row
--
-- New:
--   return_from_loan_rpc (replaced, return type gains withdrawn_bids)
--   return_retained_rpc, decline_held_return_rpc

-- execute_loan_acceptance_rpc — from 138.
CREATE OR REPLACE FUNCTION public.execute_loan_acceptance_rpc(
  p_loan_id UUID,
  p_lender_team_id UUID,
  p_borrower_team_id UUID,
  p_player_id UUID,
  p_loan_fee INT,
  p_league_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lender_faab INT;
  v_borrower_faab INT;
  v_lender_active_loans_count INT;
  v_borrower_active_loans_count INT;
  v_max_loan_outs INT;
  v_max_loan_ins INT;
  v_player_status public.roster_status;
  v_roster_entry_id UUID;
BEGIN
  PERFORM 1 FROM public.teams WHERE id = p_lender_team_id FOR UPDATE;
  PERFORM 1 FROM public.teams WHERE id = p_borrower_team_id FOR UPDATE;
  PERFORM 1 FROM public.player_loans WHERE id = p_loan_id FOR UPDATE;

  SELECT max_loan_outs, max_loan_ins
  INTO v_max_loan_outs, v_max_loan_ins
  FROM public.leagues
  WHERE id = p_league_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.player_loans
    WHERE id = p_loan_id AND status IN ('pending', 'accepted_deferred')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Loan is no longer pending');
  END IF;

  SELECT faab_budget INTO v_borrower_faab FROM public.teams WHERE id = p_borrower_team_id;
  IF v_borrower_faab < p_loan_fee THEN
    RETURN json_build_object('success', false, 'error', 'Borrower has insufficient Club Balance');
  END IF;

  SELECT COUNT(1) INTO v_lender_active_loans_count
  FROM public.player_loans
  WHERE lender_team_id = p_lender_team_id AND status = 'active';

  IF v_lender_active_loans_count >= COALESCE(v_max_loan_outs, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Lender has reached maximum active loan-outs limit');
  END IF;

  SELECT COUNT(1) INTO v_borrower_active_loans_count
  FROM public.player_loans
  WHERE borrower_team_id = p_borrower_team_id AND status = 'active';

  IF v_borrower_active_loans_count >= COALESCE(v_max_loan_ins, 2) THEN
    RETURN json_build_object('success', false, 'error', 'Borrower has reached maximum active loan-ins limit');
  END IF;

  IF public.team_is_holding(p_borrower_team_id) THEN
    RETURN json_build_object('success', false, 'error', 'The borrowing club has a held player and can''t take a loan until it''s resolved.');
  END IF;

  SELECT id, status INTO v_roster_entry_id, v_player_status
  FROM public.roster_entries
  WHERE team_id = p_lender_team_id AND player_id = p_player_id;

  IF v_roster_entry_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Player is no longer on lender roster');
  END IF;

  IF v_player_status IN ('ir', 'loan_in', 'loan_out', 'held') THEN
    RETURN json_build_object('success', false, 'error', 'Player status invalid for loan: ' || v_player_status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_loans
    WHERE player_id = p_player_id
      AND league_id = p_league_id
      AND status IN ('pending', 'active')
      AND id <> p_loan_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Player already involved in another active or pending loan');
  END IF;

  IF p_loan_fee > 0 THEN
    UPDATE public.teams
    SET faab_budget = faab_budget - p_loan_fee, updated_at = NOW()
    WHERE id = p_borrower_team_id;

    UPDATE public.teams
    SET faab_budget = faab_budget + p_loan_fee, updated_at = NOW()
    WHERE id = p_lender_team_id;

    INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
    VALUES (p_league_id, p_borrower_team_id, p_player_id, 'loan_fee', -p_loan_fee, 'Paid loan fee for player', NOW());

    INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
    VALUES (p_league_id, p_lender_team_id, p_player_id, 'loan_fee', p_loan_fee, 'Received loan fee for player', NOW());
  END IF;

  UPDATE public.roster_entries
  SET status = 'loan_out'
  WHERE id = v_roster_entry_id;

  INSERT INTO public.roster_entries (team_id, player_id, status, acquisition_type, acquisition_value, acquired_at)
  VALUES (p_borrower_team_id, p_player_id, 'loan_in', 'trade', p_loan_fee, NOW());

  UPDATE public.player_loans
  SET status = 'active',
      origin_status = v_player_status,
      updated_at = NOW()
  WHERE id = p_loan_id;

  RETURN json_build_object('success', true);
END;
$$;

-- resolve_expired_loan_rpc — from 138. p_roster_size is now unused; the limit comes from team_roster_limit.
CREATE OR REPLACE FUNCTION public.resolve_expired_loan_rpc(
  p_loan_id UUID,
  p_league_id UUID,
  p_roster_size INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lender_team_id UUID;
  v_borrower_team_id UUID;
  v_player_id UUID;
  v_loan_fee INT;
  v_status public.loan_status;
  v_origin_status public.roster_status;
  v_borrower_faab INT;
  v_bonus_rate NUMERIC;
  v_bonus_cap INT;
  v_bonus_points NUMERIC;
  v_raw_bonus INT;
  v_cap INT;
  v_capped_bonus INT;
  v_actual_bonus_pay INT;
  v_bonus_forgiven INT;
  v_place JSONB;
  v_arrival RECORD;
BEGIN
  SELECT lender_team_id, borrower_team_id, player_id, loan_fee, status,
         bonus_rate, bonus_cap, bonus_points_scored, origin_status
  INTO v_lender_team_id, v_borrower_team_id, v_player_id, v_loan_fee, v_status,
       v_bonus_rate, v_bonus_cap, v_bonus_points, v_origin_status
  FROM public.player_loans
  WHERE id = p_loan_id AND league_id = p_league_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_status <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Loan is not active');
  END IF;

  PERFORM 1 FROM public.teams WHERE id = v_lender_team_id FOR UPDATE;
  PERFORM 1 FROM public.teams WHERE id = v_borrower_team_id FOR UPDATE;

  v_actual_bonus_pay := 0;
  v_bonus_forgiven := 0;
  IF v_bonus_rate > 0 THEN
    v_raw_bonus := FLOOR(v_bonus_points * v_bonus_rate);
    v_cap := CASE WHEN v_bonus_cap > 0 THEN v_bonus_cap ELSE v_loan_fee * 3 END;
    v_capped_bonus := LEAST(v_raw_bonus, v_cap);

    IF v_capped_bonus > 0 THEN
      SELECT faab_budget INTO v_borrower_faab FROM public.teams WHERE id = v_borrower_team_id;
      v_actual_bonus_pay := LEAST(v_capped_bonus, v_borrower_faab);
      v_bonus_forgiven := v_capped_bonus - v_actual_bonus_pay;

      IF v_actual_bonus_pay > 0 THEN
        UPDATE public.teams
        SET faab_budget = faab_budget - v_actual_bonus_pay, updated_at = NOW()
        WHERE id = v_borrower_team_id;

        UPDATE public.teams
        SET faab_budget = faab_budget + v_actual_bonus_pay, updated_at = NOW()
        WHERE id = v_lender_team_id;

        INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
        VALUES (p_league_id, v_borrower_team_id, v_player_id, 'loan_bonus', -v_actual_bonus_pay, 'Paid performance bonus: ' || v_bonus_points || ' pts @ ' || v_bonus_rate || ' = ' || v_capped_bonus || ' (forgiven: ' || v_bonus_forgiven || ')', NOW());

        INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
        VALUES (p_league_id, v_lender_team_id, v_player_id, 'loan_bonus', v_actual_bonus_pay, 'Received performance bonus from borrower', NOW());
      END IF;
    END IF;
  END IF;

  DELETE FROM public.roster_entries
  WHERE team_id = v_borrower_team_id AND player_id = v_player_id AND status = 'loan_in';

  -- The loan ends before placement, so a paid buyback place stops counting
  -- toward the lender's limit (team_roster_limit reads active loans).
  UPDATE public.player_loans
  SET status = 'expired', bonus_settled = TRUE, updated_at = NOW()
  WHERE id = p_loan_id;

  SELECT * INTO v_arrival
  FROM public.place_arrival_rpc(v_lender_team_id, v_player_id, COALESCE(v_origin_status, 'bench'), 'loan_return', 'trade', 0);

  RETURN json_build_object(
    'success', true,
    'pending_activation', false,
    'held', v_arrival.placed_status = 'held',
    'returned_to', v_arrival.placed_status,
    'withdrawn_bids', v_arrival.withdrawn_bids,
    'bonus_paid', v_actual_bonus_pay,
    'bonus_forgiven', v_bonus_forgiven
  );
END;
$$;

-- execute_loan_recall_rpc — from 138. p_roster_size is now unused; the limit comes from team_roster_limit.
CREATE OR REPLACE FUNCTION public.execute_loan_recall_rpc(
  p_loan_id UUID,
  p_league_id UUID,
  p_roster_size INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lender_team_id UUID;
  v_borrower_team_id UUID;
  v_player_id UUID;
  v_loan_fee INT;
  v_has_recall BOOLEAN;
  v_status public.loan_status;
  v_origin_status public.roster_status;
  v_recall_penalty INT;
  v_lender_faab INT;
  v_borrower_faab INT;
  v_bonus_rate NUMERIC;
  v_bonus_cap INT;
  v_bonus_points NUMERIC;
  v_raw_bonus INT;
  v_cap INT;
  v_capped_bonus INT;
  v_actual_bonus_pay INT;
  v_bonus_forgiven INT;
  v_place JSONB;
  v_arrival RECORD;
  v_buyback BOOLEAN;
  v_taxi_ok BOOLEAN;
  v_taxi_size INT;
  v_age_limit INT;
  v_dob DATE;
BEGIN
  SELECT lender_team_id, borrower_team_id, player_id, loan_fee, has_recall, status,
         bonus_rate, bonus_cap, bonus_points_scored, origin_status
  INTO v_lender_team_id, v_borrower_team_id, v_player_id, v_loan_fee, v_has_recall, v_status,
       v_bonus_rate, v_bonus_cap, v_bonus_points, v_origin_status
  FROM public.player_loans
  WHERE id = p_loan_id AND league_id = p_league_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_status <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Loan is not active');
  END IF;

  IF NOT v_has_recall THEN
    RETURN json_build_object('success', false, 'error', 'Recall clause is not included in this loan');
  END IF;

  PERFORM 1 FROM public.teams WHERE id = v_lender_team_id FOR UPDATE;
  PERFORM 1 FROM public.teams WHERE id = v_borrower_team_id FOR UPDATE;

  -- R19: a recall needs a lender who isn't holding and room for him. Checked
  -- before any money moves. His loan_out row already counts, so room here means
  -- the other players fit under the limit once this loan's buyback place (if
  -- paid) is gone; the academy route counts as room.
  IF public.team_is_holding(v_lender_team_id) THEN
    RETURN json_build_object('success', false, 'code', 'LENDER_HOLDING', 'error', 'Activate or drop your held player first.');
  END IF;

  SELECT COALESCE(slot_buyback_used, FALSE) INTO v_buyback FROM public.player_loans WHERE id = p_loan_id;
  v_taxi_ok := FALSE;
  IF v_origin_status = 'taxi' THEN
    SELECT COALESCE(l.taxi_size, 3), COALESCE(l.taxi_age_limit, 21) INTO v_taxi_size, v_age_limit
    FROM public.leagues l WHERE l.id = p_league_id;
    SELECT p.date_of_birth INTO v_dob FROM public.players p WHERE p.id = v_player_id;
    v_taxi_ok := v_dob IS NOT NULL
      AND DATE_PART('year', AGE(v_dob)) <= v_age_limit
      AND (SELECT count(1) FROM public.roster_entries re WHERE re.team_id = v_lender_team_id AND re.status = 'taxi') < v_taxi_size;
  END IF;

  IF NOT v_taxi_ok AND (
    SELECT count(1) FROM public.roster_entries re
    WHERE re.team_id = v_lender_team_id
      AND re.player_id <> v_player_id
      AND re.status NOT IN ('ir', 'taxi', 'loan_in', 'held')
  ) >= public.team_roster_limit(v_lender_team_id) - (CASE WHEN v_buyback THEN 1 ELSE 0 END) THEN
    RETURN json_build_object('success', false, 'code', 'RECALL_NEEDS_ROOM', 'error', 'Make room in your squad before recalling him.');
  END IF;

  v_recall_penalty := 25;

  SELECT faab_budget INTO v_lender_faab FROM public.teams WHERE id = v_lender_team_id;
  IF v_lender_faab < v_recall_penalty THEN
    RETURN json_build_object('success', false, 'error', 'Lender has insufficient Club Balance for recall penalty');
  END IF;

  UPDATE public.teams
  SET faab_budget = faab_budget - v_recall_penalty, updated_at = NOW()
  WHERE id = v_lender_team_id;

  UPDATE public.teams
  SET faab_budget = faab_budget + v_recall_penalty, updated_at = NOW()
  WHERE id = v_borrower_team_id;

  INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
  VALUES (p_league_id, v_lender_team_id, v_player_id, 'loan_recall_penalty', -v_recall_penalty, 'Paid recall penalty to borrower', NOW());

  INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
  VALUES (p_league_id, v_borrower_team_id, v_player_id, 'loan_recall_penalty', v_recall_penalty, 'Received recall penalty from lender', NOW());

  v_actual_bonus_pay := 0;
  v_bonus_forgiven := 0;
  IF v_bonus_rate > 0 THEN
    v_raw_bonus := FLOOR(v_bonus_points * v_bonus_rate);
    v_cap := CASE WHEN v_bonus_cap > 0 THEN v_bonus_cap ELSE v_loan_fee * 3 END;
    v_capped_bonus := LEAST(v_raw_bonus, v_cap);

    IF v_capped_bonus > 0 THEN
      SELECT faab_budget INTO v_borrower_faab FROM public.teams WHERE id = v_borrower_team_id;
      v_actual_bonus_pay := LEAST(v_capped_bonus, v_borrower_faab);
      v_bonus_forgiven := v_capped_bonus - v_actual_bonus_pay;

      IF v_actual_bonus_pay > 0 THEN
        UPDATE public.teams
        SET faab_budget = faab_budget - v_actual_bonus_pay, updated_at = NOW()
        WHERE id = v_borrower_team_id;

        UPDATE public.teams
        SET faab_budget = faab_budget + v_actual_bonus_pay, updated_at = NOW()
        WHERE id = v_lender_team_id;

        INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
        VALUES (p_league_id, v_borrower_team_id, v_player_id, 'loan_bonus', -v_actual_bonus_pay, 'Paid performance bonus: ' || v_bonus_points || ' pts @ ' || v_bonus_rate || ' = ' || v_capped_bonus || ' (forgiven: ' || v_bonus_forgiven || ')', NOW());

        INSERT INTO public.transactions (league_id, team_id, player_id, type, faab_bid, notes, created_at)
        VALUES (p_league_id, v_lender_team_id, v_player_id, 'loan_bonus', v_actual_bonus_pay, 'Received performance bonus from borrower', NOW());
      END IF;
    END IF;
  END IF;

  DELETE FROM public.roster_entries
  WHERE team_id = v_borrower_team_id AND player_id = v_player_id AND status = 'loan_in';

  UPDATE public.player_loans
  SET status = 'recalled',
      recall_activated = TRUE,
      recall_penalty = v_recall_penalty,
      bonus_settled = TRUE,
      updated_at = NOW()
  WHERE id = p_loan_id;

  SELECT * INTO v_arrival
  FROM public.place_arrival_rpc(v_lender_team_id, v_player_id, COALESCE(v_origin_status, 'bench'), 'loan_return', 'trade', 0);

  RETURN json_build_object(
    'success', true,
    'pending_activation', false,
    'held', v_arrival.placed_status = 'held',
    'returned_to', v_arrival.placed_status,
    'withdrawn_bids', v_arrival.withdrawn_bids,
    'penalty', v_recall_penalty,
    'bonus_paid', v_actual_bonus_pay,
    'bonus_forgiven', v_bonus_forgiven
  );
END;
$$;

-- execute_trade_transaction_rpc — from 160.
CREATE OR REPLACE FUNCTION public.execute_trade_transaction_rpc(
  p_trade_id UUID,
  p_roster_size INT,
  p_min_roster_size INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trade RECORD;
  v_team_a RECORD;
  v_team_b RECORD;
  v_team_a_match_count INT;
  v_team_b_match_count INT;
  v_team_a_current_size INT;
  v_team_b_current_size INT;
  v_team_a_offered_active INT := 0;
  v_team_b_requested_active INT := 0;
  v_team_a_offered_taxi INT := 0;
  v_team_b_requested_taxi INT := 0;
  v_team_a_buyback_slots INT := 0;
  v_team_b_buyback_slots INT := 0;
  v_team_a_limit INT;
  v_team_b_limit INT;
  v_team_a_after INT;
  v_team_b_after INT;
  v_player_id UUID;
  v_right_id UUID;
  v_team_a_new_faab INT;
  v_team_b_new_faab INT;
  v_offered_rights_n INT;
  v_requested_rights_n INT;
  v_retained_slots INT;
  v_team_a_slots_used INT;
  v_team_b_slots_used INT;
  v_offered_slot_rights INT := 0;
  v_requested_slot_rights INT := 0;
  v_taxi_size INT;
  v_taxi_age_limit INT;
  v_team_a_taxi_count INT := 0;
  v_team_b_taxi_count INT := 0;
  v_team_a_taxi_avail INT := 0;
  v_team_b_taxi_avail INT := 0;
  v_team_a_taxi_incoming UUID[] := '{}'::UUID[];
  v_team_a_bench_incoming UUID[] := '{}'::UUID[];
  v_team_b_taxi_incoming UUID[] := '{}'::UUID[];
  v_team_b_bench_incoming UUID[] := '{}'::UUID[];
  v_p_status roster_status;
  v_p_dob DATE;
  v_p_age INT;
  v_min_roster INT := COALESCE(p_min_roster_size, 15);
  v_base_roster_size INT := COALESCE(p_roster_size, 20);
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Fetch and lock trade proposal
  SELECT *
  INTO v_trade
  FROM public.trade_proposals
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade proposal not found');
  END IF;

  -- Accept both 'pending' (immediate) and 'accepted_deferred' (post-GW) status
  IF v_trade.status NOT IN ('pending', 'accepted_deferred') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is already ' || v_trade.status);
  END IF;

  -- 2. Lock teams
  SELECT id, faab_budget, team_name, user_id
  INTO v_team_a
  FROM public.teams
  WHERE id = v_trade.team_a_id
  FOR UPDATE;

  SELECT id, faab_budget, team_name, user_id
  INTO v_team_b
  FROM public.teams
  WHERE id = v_trade.team_b_id
  FOR UPDATE;

  IF v_team_a.id IS NULL OR v_team_b.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both teams not found');
  END IF;

  -- 3. Verify offered players are still on Team A
  IF v_trade.offered_players IS NOT NULL AND cardinality(v_trade.offered_players) > 0 THEN
    SELECT count(1)
    INTO v_team_a_match_count
    FROM public.roster_entries
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_trade.offered_players);

    IF v_team_a_match_count <> cardinality(v_trade.offered_players) THEN
      RETURN jsonb_build_object('success', false, 'error', 'One or more offered players are no longer on the proposing team''s roster. The trade cannot be completed.');
    END IF;
  END IF;

  -- 4. Verify requested players are still on Team B
  IF v_trade.requested_players IS NOT NULL AND cardinality(v_trade.requested_players) > 0 THEN
    SELECT count(1)
    INTO v_team_b_match_count
    FROM public.roster_entries
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_trade.requested_players);

    IF v_team_b_match_count <> cardinality(v_trade.requested_players) THEN
      RETURN jsonb_build_object('success', false, 'error', 'One or more requested players are no longer on your roster. The trade cannot be completed.');
    END IF;
  END IF;

  -- 4b. Verify retained rights are still live and still held by the right team.
  v_offered_rights_n := COALESCE(cardinality(v_trade.offered_rights), 0);
  v_requested_rights_n := COALESCE(cardinality(v_trade.requested_rights), 0);

  IF v_offered_rights_n > 0 THEN
    SELECT count(1)
    INTO v_team_a_match_count
    FROM public.departure_decisions
    WHERE id = ANY(v_trade.offered_rights)
      AND team_id = v_trade.team_a_id
      AND league_id = v_trade.league_id
      AND status IN ('retained', 'on_loan');

    IF v_team_a_match_count <> v_offered_rights_n THEN
      RETURN jsonb_build_object('success', false, 'error', 'One or more offered player rights are no longer held by the proposing team. The trade cannot be completed.');
    END IF;
  END IF;

  IF v_requested_rights_n > 0 THEN
    SELECT count(1)
    INTO v_team_b_match_count
    FROM public.departure_decisions
    WHERE id = ANY(v_trade.requested_rights)
      AND team_id = v_trade.team_b_id
      AND league_id = v_trade.league_id
      AND status IN ('retained', 'on_loan');

    IF v_team_b_match_count <> v_requested_rights_n THEN
      RETURN jsonb_build_object('success', false, 'error', 'One or more requested player rights are no longer held by your team. The trade cannot be completed.');
    END IF;
  END IF;

  -- 5. Validate FAAB budgets
  IF v_trade.offered_faab > v_team_a.faab_budget THEN
    RETURN jsonb_build_object('success', false, 'error', 'The proposing team only has €' || v_team_a.faab_budget || 'm FAAB but offered €' || v_trade.offered_faab || 'm. The trade cannot be completed.');
  END IF;

  IF v_trade.requested_faab > v_team_b.faab_budget THEN
    RETURN jsonb_build_object('success', false, 'error', 'You only have €' || v_team_b.faab_budget || 'm FAAB but the deal requires €' || v_trade.requested_faab || 'm from your side.');
  END IF;

  -- 6. Validate roster size limits.
  -- Active roster slots exclude IR, taxi (Academy), and loaned-in players (capacity.ts: UNCOUNTED_ROSTER_STATUSES).
  SELECT count(1) INTO v_team_a_current_size
  FROM public.roster_entries
  WHERE team_id = v_trade.team_a_id
    AND status NOT IN ('ir', 'taxi', 'loan_in', 'held');

  SELECT count(1) INTO v_team_b_current_size
  FROM public.roster_entries
  WHERE team_id = v_trade.team_b_id
    AND status NOT IN ('ir', 'taxi', 'loan_in', 'held');

  -- Count outgoing players who actually occupied active roster slots
  IF v_trade.offered_players IS NOT NULL AND cardinality(v_trade.offered_players) > 0 THEN
    SELECT count(1) INTO v_team_a_offered_active
    FROM public.roster_entries
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_trade.offered_players)
      AND status NOT IN ('ir', 'taxi', 'loan_in', 'held');

    SELECT count(1) INTO v_team_a_offered_taxi
    FROM public.roster_entries
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_trade.offered_players)
      AND status = 'taxi';
  END IF;

  IF v_trade.requested_players IS NOT NULL AND cardinality(v_trade.requested_players) > 0 THEN
    SELECT count(1) INTO v_team_b_requested_active
    FROM public.roster_entries
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_trade.requested_players)
      AND status NOT IN ('ir', 'taxi', 'loan_in', 'held');

    SELECT count(1) INTO v_team_b_requested_taxi
    FROM public.roster_entries
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_trade.requested_players)
      AND status = 'taxi';
  END IF;

  -- Account for active loan buyback slots holding roster spots open
  SELECT count(1) INTO v_team_a_buyback_slots
  FROM public.player_loans
  WHERE lender_team_id = v_trade.team_a_id
    AND status = 'active'
    AND slot_buyback_used = TRUE;

  SELECT count(1) INTO v_team_b_buyback_slots
  FROM public.player_loans
  WHERE lender_team_id = v_trade.team_b_id
    AND status = 'active'
    AND slot_buyback_used = TRUE;

  v_team_a_limit := v_base_roster_size + v_team_a_buyback_slots;
  v_team_b_limit := v_base_roster_size + v_team_b_buyback_slots;

  -- Check Academy settings to route incoming taxi players if eligible and room exists
  SELECT COALESCE(taxi_size, 3), COALESCE(taxi_age_limit, 21)
  INTO v_taxi_size, v_taxi_age_limit
  FROM public.leagues
  WHERE id = v_trade.league_id;

  SELECT count(1) INTO v_team_a_taxi_count
  FROM public.roster_entries
  WHERE team_id = v_trade.team_a_id AND status = 'taxi';

  SELECT count(1) INTO v_team_b_taxi_count
  FROM public.roster_entries
  WHERE team_id = v_trade.team_b_id AND status = 'taxi';

  v_team_a_taxi_avail := GREATEST(0, v_taxi_size - (v_team_a_taxi_count - v_team_a_offered_taxi));
  v_team_b_taxi_avail := GREATEST(0, v_taxi_size - (v_team_b_taxi_count - v_team_b_requested_taxi));

  -- Classify incoming requested players (moving to Team A)
  IF v_trade.requested_players IS NOT NULL AND cardinality(v_trade.requested_players) > 0 THEN
    FOREACH v_player_id IN ARRAY v_trade.requested_players LOOP
      SELECT re.status, p.date_of_birth
      INTO v_p_status, v_p_dob
      FROM public.roster_entries re
      JOIN public.players p ON p.id = re.player_id
      WHERE re.team_id = v_trade.team_b_id AND re.player_id = v_player_id;

      v_p_age := NULL;
      IF v_p_dob IS NOT NULL THEN
        v_p_age := DATE_PART('year', AGE(v_p_dob));
      END IF;

      IF v_p_status = 'taxi' AND v_team_a_taxi_avail > 0 AND v_p_age IS NOT NULL AND v_p_age <= v_taxi_age_limit THEN
        v_team_a_taxi_avail := v_team_a_taxi_avail - 1;
        v_team_a_taxi_incoming := array_append(v_team_a_taxi_incoming, v_player_id);
      ELSE
        v_team_a_bench_incoming := array_append(v_team_a_bench_incoming, v_player_id);
      END IF;
    END LOOP;
  END IF;

  -- Classify incoming offered players (moving to Team B)
  IF v_trade.offered_players IS NOT NULL AND cardinality(v_trade.offered_players) > 0 THEN
    FOREACH v_player_id IN ARRAY v_trade.offered_players LOOP
      SELECT re.status, p.date_of_birth
      INTO v_p_status, v_p_dob
      FROM public.roster_entries re
      JOIN public.players p ON p.id = re.player_id
      WHERE re.team_id = v_trade.team_a_id AND re.player_id = v_player_id;

      v_p_age := NULL;
      IF v_p_dob IS NOT NULL THEN
        v_p_age := DATE_PART('year', AGE(v_p_dob));
      END IF;

      IF v_p_status = 'taxi' AND v_team_b_taxi_avail > 0 AND v_p_age IS NOT NULL AND v_p_age <= v_taxi_age_limit THEN
        v_team_b_taxi_avail := v_team_b_taxi_avail - 1;
        v_team_b_taxi_incoming := array_append(v_team_b_taxi_incoming, v_player_id);
      ELSE
        v_team_b_bench_incoming := array_append(v_team_b_bench_incoming, v_player_id);
      END IF;
    END LOOP;
  END IF;

  v_team_a_after := v_team_a_current_size - v_team_a_offered_active + COALESCE(cardinality(v_team_a_bench_incoming), 0);
  v_team_b_after := v_team_b_current_size - v_team_b_requested_active + COALESCE(cardinality(v_team_b_bench_incoming), 0);

  -- Held players (162): a holding team can't grow its squad through a trade.
  -- Its outgoing held players free nothing, because the counts above skip them.
  IF public.team_is_holding(v_trade.team_a_id) AND v_team_a_after > v_team_a_current_size THEN
    RETURN jsonb_build_object('success', false, 'error', v_team_a.team_name || ' has a held player and can''t add to their squad until it''s resolved.');
  END IF;

  IF public.team_is_holding(v_trade.team_b_id) AND v_team_b_after > v_team_b_current_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have a held player. Activate or drop him before accepting a trade that adds to your squad.');
  END IF;

  IF v_team_a_after > v_team_a_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accepting this trade would put ' || v_team_a.team_name || ' over the ' || v_team_a_limit || '-player roster limit (they would have ' || v_team_a_after || '). They must drop a player before this trade can be accepted.');
  END IF;

  IF v_team_b_after > v_team_b_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accepting this trade would put your team over the ' || v_team_b_limit || '-player roster limit (you would have ' || v_team_b_after || '). Drop a player first before accepting.');
  END IF;

  IF v_team_a_after < v_min_roster THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade would leave ' || v_team_a.team_name || ' below the minimum roster limit of ' || v_min_roster || ' players.');
  END IF;

  IF v_team_b_after < v_min_roster THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade would leave your team below the minimum roster limit of ' || v_min_roster || ' players.');
  END IF;

  -- 6b. Validate retained slot limits.
  IF v_offered_rights_n > 0 OR v_requested_rights_n > 0 THEN
    SELECT COALESCE(retained_slots, 0) INTO v_retained_slots
    FROM public.leagues WHERE id = v_trade.league_id;

    SELECT count(1) INTO v_team_a_slots_used
    FROM public.departure_decisions
    WHERE team_id = v_trade.team_a_id AND status IN ('retained', 'return_pending');

    SELECT count(1) INTO v_team_b_slots_used
    FROM public.departure_decisions
    WHERE team_id = v_trade.team_b_id AND status IN ('retained', 'return_pending');

    -- on_loan rights ride along without a slot, so only count the ones that use one.
    SELECT count(1) INTO v_offered_slot_rights
    FROM public.departure_decisions
    WHERE id = ANY(v_trade.offered_rights) AND status IN ('retained', 'return_pending');

    SELECT count(1) INTO v_requested_slot_rights
    FROM public.departure_decisions
    WHERE id = ANY(v_trade.requested_rights) AND status IN ('retained', 'return_pending');

    IF (v_team_a_slots_used - v_offered_slot_rights + v_requested_slot_rights) > v_retained_slots THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accepting this trade would put ' || v_team_a.team_name || ' over the ' || v_retained_slots || ' retained-rights limit. They must relinquish rights to another player first.');
    END IF;

    IF (v_team_b_slots_used - v_requested_slot_rights + v_offered_slot_rights) > v_retained_slots THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accepting this trade would put your team over the ' || v_retained_slots || ' retained-rights limit. Relinquish rights to another player first.');
    END IF;
  END IF;

  -- 7. Execute transfers
  -- Move offered players from Team A -> Team B
  IF COALESCE(cardinality(v_team_b_taxi_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_b_id,
        status = 'taxi',
        acquisition_type = 'trade',
        acquired_at = v_now,
        held_at = NULL,
        held_source = NULL
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_team_b_taxi_incoming);
  END IF;

  IF COALESCE(cardinality(v_team_b_bench_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_b_id,
        status = 'bench',
        acquisition_type = 'trade',
        acquired_at = v_now,
        held_at = NULL,
        held_source = NULL
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_team_b_bench_incoming);
  END IF;

  -- Move requested players from Team B -> Team A
  IF COALESCE(cardinality(v_team_a_taxi_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_a_id,
        status = 'taxi',
        acquisition_type = 'trade',
        acquired_at = v_now,
        held_at = NULL,
        held_source = NULL
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_team_a_taxi_incoming);
  END IF;

  IF COALESCE(cardinality(v_team_a_bench_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_a_id,
        status = 'bench',
        acquisition_type = 'trade',
        acquired_at = v_now,
        held_at = NULL,
        held_source = NULL
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_team_a_bench_incoming);
  END IF;

  -- A held retained player traded as a player lands on the receiving bench, so
  -- his return is complete: resolve the decision and move it with him.
  UPDATE public.departure_decisions dd
  SET status = 'returned',
      team_id = CASE WHEN dd.team_id = v_trade.team_a_id THEN v_trade.team_b_id ELSE v_trade.team_a_id END,
      resolved_at = v_now,
      updated_at = v_now
  WHERE dd.league_id = v_trade.league_id
    AND dd.status = 'return_pending'
    AND (
      (dd.team_id = v_trade.team_a_id AND dd.player_id = ANY(v_trade.offered_players))
      OR (dd.team_id = v_trade.team_b_id AND dd.player_id = ANY(v_trade.requested_players))
    );

  -- Move rights. Only team_id changes: original_team_id carries the buy-back
  -- exclusion and must not be laundered, and any live return deadline stands.
  IF v_offered_rights_n > 0 THEN
    UPDATE public.departure_decisions
    SET team_id = v_trade.team_b_id,
        updated_at = v_now
    WHERE id = ANY(v_trade.offered_rights)
      AND team_id = v_trade.team_a_id;
  END IF;

  IF v_requested_rights_n > 0 THEN
    UPDATE public.departure_decisions
    SET team_id = v_trade.team_a_id,
        updated_at = v_now
    WHERE id = ANY(v_trade.requested_rights)
      AND team_id = v_trade.team_b_id;
  END IF;

  -- Apply FAAB adjustments
  v_team_a_new_faab := v_team_a.faab_budget - v_trade.offered_faab + v_trade.requested_faab;
  v_team_b_new_faab := v_team_b.faab_budget - v_trade.requested_faab + v_trade.offered_faab;

  UPDATE public.teams
  SET faab_budget = v_team_a_new_faab,
      updated_at = v_now
  WHERE id = v_trade.team_a_id;

  UPDATE public.teams
  SET faab_budget = v_team_b_new_faab,
      updated_at = v_now
  WHERE id = v_trade.team_b_id;

  -- Update trade status to accepted
  UPDATE public.trade_proposals
  SET status = 'accepted',
      updated_at = v_now
  WHERE id = p_trade_id;

  -- Log transactions
  -- Offered players: A traded out, B received
  IF v_trade.offered_players IS NOT NULL AND cardinality(v_trade.offered_players) > 0 THEN
    FOREACH v_player_id IN ARRAY v_trade.offered_players LOOP
      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_a_id, v_player_id, 'trade', 'Traded to ' || v_team_b.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);

      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_b_id, v_player_id, 'trade', 'Received from ' || v_team_a.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);
    END LOOP;
  END IF;

  -- Requested players: B traded out, A received
  IF v_trade.requested_players IS NOT NULL AND cardinality(v_trade.requested_players) > 0 THEN
    FOREACH v_player_id IN ARRAY v_trade.requested_players LOOP
      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_b_id, v_player_id, 'trade', 'Traded to ' || v_team_a.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);

      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_a_id, v_player_id, 'trade', 'Received from ' || v_team_b.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);
    END LOOP;
  END IF;

  -- Rights changing hands, logged against the player they are a claim on.
  IF v_offered_rights_n > 0 THEN
    FOR v_right_id, v_player_id IN
      SELECT id, player_id FROM public.departure_decisions WHERE id = ANY(v_trade.offered_rights)
    LOOP
      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_a_id, v_player_id, 'trade', 'Retained rights traded to ' || v_team_b.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);

      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_b_id, v_player_id, 'trade', 'Received retained rights from ' || v_team_a.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);
    END LOOP;
  END IF;

  IF v_requested_rights_n > 0 THEN
    FOR v_right_id, v_player_id IN
      SELECT id, player_id FROM public.departure_decisions WHERE id = ANY(v_trade.requested_rights)
    LOOP
      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_b_id, v_player_id, 'trade', 'Retained rights traded to ' || v_team_a.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);

      INSERT INTO public.transactions (league_id, team_id, player_id, type, notes, processed_at, created_at)
      VALUES (v_trade.league_id, v_trade.team_a_id, v_player_id, 'trade', 'Received retained rights from ' || v_team_b.team_name || ' (trade #' || substring(p_trade_id::text from 1 for 8) || ')', v_now, v_now);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'team_a_id', v_trade.team_a_id,
    'team_a_name', v_team_a.team_name,
    'team_a_user_id', v_team_a.user_id,
    'team_b_id', v_trade.team_b_id,
    'team_b_name', v_team_b.team_name,
    'team_b_user_id', v_team_b.user_id,
    'rights_moved', v_offered_rights_n + v_requested_rights_n
  );
END;
$$;

-- ── return_from_loan_rpc (replaces 160) ───────────────────────────────────────
-- A loanee back from abroad lands through place_arrival_rpc: academy if he left
-- from it and qualifies, reserves if there's room, otherwise held. The decision
-- is returned either way; the roster row is now the thing to act on. Dropped and
-- recreated because the return type gains withdrawn_bids.
DROP FUNCTION IF EXISTS public.return_from_loan_rpc(uuid);
CREATE FUNCTION public.return_from_loan_rpc(p_decision_id UUID)
RETURNS TABLE (
  team_id         UUID,
  player_id       UUID,
  new_status      roster_status,
  withdrawn_bids  JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  d          RECORD;
  v_active   BOOLEAN;
  v_arrival  RECORD;
BEGIN
  SELECT * INTO d
  FROM public.departure_decisions dd
  WHERE dd.id = p_decision_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Departure decision not found: %', p_decision_id;
  END IF;

  IF d.status <> 'on_loan' THEN
    RETURN;
  END IF;

  SELECT p.is_active INTO v_active FROM public.players p WHERE p.id = d.player_id;
  IF NOT COALESCE(v_active, FALSE) THEN
    RETURN;
  END IF;

  SELECT * INTO v_arrival
  FROM public.place_arrival_rpc(d.team_id, d.player_id, COALESCE(d.roster_status_at_departure, 'bench'), 'loan_abroad_return', 'retained_return', 0);

  UPDATE public.departure_decisions dd
  SET status = 'returned',
      returned_at = NOW(),
      resolved_at = NOW(),
      updated_at = NOW()
  WHERE dd.id = p_decision_id;

  team_id := d.team_id;
  player_id := d.player_id;
  new_status := v_arrival.placed_status;
  withdrawn_bids := v_arrival.withdrawn_bids;
  RETURN NEXT;
END;
$$;

-- ── return_retained_rpc ───────────────────────────────────────────────────────
-- R3: a retained player back in the PL joins if there's room and is held if
-- not. No 48-hour window. A held return keeps the decision return_pending, so
-- Decline (free, R4) stays available; activate_held_rpc resolves it to returned.
CREATE OR REPLACE FUNCTION public.return_retained_rpc(p_decision_id UUID)
RETURNS TABLE (
  team_id         UUID,
  player_id       UUID,
  new_status      roster_status,
  withdrawn_bids  JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  d          RECORD;
  v_active   BOOLEAN;
  v_arrival  RECORD;
BEGIN
  SELECT * INTO d
  FROM public.departure_decisions dd
  WHERE dd.id = p_decision_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Departure decision not found: %', p_decision_id;
  END IF;

  IF d.status <> 'retained' THEN
    RETURN;
  END IF;

  SELECT p.is_active INTO v_active FROM public.players p WHERE p.id = d.player_id;
  IF NOT COALESCE(v_active, FALSE) THEN
    RETURN;
  END IF;

  SELECT * INTO v_arrival
  FROM public.place_arrival_rpc(d.team_id, d.player_id, 'bench', 'retained_return', 'retained_return', 0);

  UPDATE public.departure_decisions dd
  SET status = CASE WHEN v_arrival.placed_status = 'held' THEN 'return_pending'::departure_decision_status ELSE 'returned'::departure_decision_status END,
      returned_at = NOW(),
      reinstate_by = NULL,
      resolved_at = CASE WHEN v_arrival.placed_status = 'held' THEN NULL ELSE NOW() END,
      updated_at = NOW()
  WHERE dd.id = p_decision_id;

  team_id := d.team_id;
  player_id := d.player_id;
  new_status := v_arrival.placed_status;
  withdrawn_bids := v_arrival.withdrawn_bids;
  RETURN NEXT;
END;
$$;

-- ── decline_held_return_rpc ───────────────────────────────────────────────────
-- R4: the holder of a held retained return gives him up for nothing. His roster
-- row and the decision change together. The caller opens the system auction.
CREATE OR REPLACE FUNCTION public.decline_held_return_rpc(p_decision_id UUID)
RETURNS TABLE (
  league_id  UUID,
  team_id    UUID,
  player_id  UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  d RECORD;
BEGIN
  SELECT * INTO d
  FROM public.departure_decisions dd
  WHERE dd.id = p_decision_id
  FOR UPDATE;

  IF NOT FOUND OR d.status <> 'return_pending' THEN
    RETURN;
  END IF;

  DELETE FROM public.roster_entries re
  WHERE re.team_id = d.team_id
    AND re.player_id = d.player_id
    AND re.status = 'held';

  UPDATE public.departure_decisions dd
  SET status = 'lapsed',
      resolved_at = NOW(),
      updated_at = NOW(),
      notes = 'Rights holder declined the return.'
  WHERE dd.id = p_decision_id;

  league_id := d.league_id;
  team_id := d.team_id;
  player_id := d.player_id;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_from_loan_rpc(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.return_retained_rpc(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decline_held_return_rpc(uuid) FROM PUBLIC, anon, authenticated;
