-- Migration 154: Fix trade roster limit validation and incoming player statuses.
--
-- 1. Active roster limit:
--    execute_trade_transaction_rpc previously counted all rows in roster_entries,
--    charging teams for players parked on IR ('ir'), in the Academy ('taxi'), and
--    borrowed on loan ('loan_in'). It now excludes those uncounted statuses
--    matching src/lib/roster/capacity.ts (UNCOUNTED_ROSTER_STATUSES).
--
-- 2. Outgoing active count:
--    Only outgoing players who actually held an active or bench slot decrement
--    the active squad count. Relinquishing an IR or Academy player does not
--    falsely free an active roster slot.
--
-- 3. Loan buyback slots:
--    A manager who loaned a player out and paid the buyback fee has a legal slot
--    held open (player_loans.slot_buyback_used). The trade RPC now includes
--    active buyback slots in each team's roster limit.
--
-- 4. Incoming player status:
--    Traded starters no longer remain status = 'active' on their new club,
--    which previously caused teams to have more than 11 active starters.
--    Incoming players are placed on 'bench' (or 'taxi' if originating from the
--    academy and the acquiring club has academy space and age eligibility).

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
      AND status IN ('retained', 'return_pending');

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
      AND status IN ('retained', 'return_pending');

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
    AND status NOT IN ('ir', 'taxi', 'loan_in');

  SELECT count(1) INTO v_team_b_current_size
  FROM public.roster_entries
  WHERE team_id = v_trade.team_b_id
    AND status NOT IN ('ir', 'taxi', 'loan_in');

  -- Count outgoing players who actually occupied active roster slots
  IF v_trade.offered_players IS NOT NULL AND cardinality(v_trade.offered_players) > 0 THEN
    SELECT count(1) INTO v_team_a_offered_active
    FROM public.roster_entries
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_trade.offered_players)
      AND status NOT IN ('ir', 'taxi', 'loan_in');

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
      AND status NOT IN ('ir', 'taxi', 'loan_in');

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

    IF (v_team_a_slots_used - v_offered_rights_n + v_requested_rights_n) > v_retained_slots THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accepting this trade would put ' || v_team_a.team_name || ' over the ' || v_retained_slots || ' retained-rights limit. They must relinquish rights to another player first.');
    END IF;

    IF (v_team_b_slots_used - v_requested_rights_n + v_offered_rights_n) > v_retained_slots THEN
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
        acquired_at = v_now
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_team_b_taxi_incoming);
  END IF;

  IF COALESCE(cardinality(v_team_b_bench_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_b_id,
        status = 'bench',
        acquisition_type = 'trade',
        acquired_at = v_now
    WHERE team_id = v_trade.team_a_id
      AND player_id = ANY(v_team_b_bench_incoming);
  END IF;

  -- Move requested players from Team B -> Team A
  IF COALESCE(cardinality(v_team_a_taxi_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_a_id,
        status = 'taxi',
        acquisition_type = 'trade',
        acquired_at = v_now
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_team_a_taxi_incoming);
  END IF;

  IF COALESCE(cardinality(v_team_a_bench_incoming), 0) > 0 THEN
    UPDATE public.roster_entries
    SET team_id = v_trade.team_a_id,
        status = 'bench',
        acquisition_type = 'trade',
        acquired_at = v_now
    WHERE team_id = v_trade.team_b_id
      AND player_id = ANY(v_team_a_bench_incoming);
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.execute_trade_transaction_rpc(uuid, int, int) FROM PUBLIC, anon, authenticated;
