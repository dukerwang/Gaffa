-- 175: The expansion draft
--
-- A dynasty league can add clubs in the offseason, between the reset and
-- Kickoff. Each existing club protects 8 players (academy and loaned-out
-- players are exempt on top of that); the new clubs then take turns picking
-- either an exposed player, with no existing club losing more than 2 in
-- total, or a free agent, until their squads are full. A new club starts with
-- the league's median Club Balance and pays no fees.
-- Spec and evidence: docs/superpowers/specs/2026-10-04-expansion-and-takeovers-design.md,
-- scratch/expansion-sim/.

CREATE TABLE IF NOT EXISTS public.expansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  -- protecting: clubs choose protections and new managers join
  -- drafting:   new clubs pick; complete / cancelled are final
  status TEXT NOT NULL DEFAULT 'protecting' CHECK (status IN ('protecting', 'drafting', 'complete', 'cancelled')),
  new_clubs INT NOT NULL CHECK (new_clubs BETWEEN 1 AND 4),
  protect_count INT NOT NULL DEFAULT 8 CHECK (protect_count >= 0),
  per_club_cap INT NOT NULL DEFAULT 2 CHECK (per_club_cap >= 0),
  protection_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- At most one expansion open per league at a time.
CREATE UNIQUE INDEX IF NOT EXISTS expansions_one_open_per_league
  ON public.expansions (league_id) WHERE status IN ('protecting', 'drafting');

CREATE TABLE IF NOT EXISTS public.expansion_clubs (
  expansion_id UUID NOT NULL REFERENCES public.expansions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  pick_order INT,
  PRIMARY KEY (expansion_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.expansion_protections (
  expansion_id UUID NOT NULL REFERENCES public.expansions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  automatic BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (expansion_id, team_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.expansion_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expansion_id UUID NOT NULL REFERENCES public.expansions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- the existing club he came from; NULL for a free agent
  from_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  pick_number INT NOT NULL,
  automatic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (expansion_id, pick_number),
  UNIQUE (expansion_id, player_id)
);

ALTER TABLE public.expansions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_protections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_picks ENABLE ROW LEVEL SECURITY;

-- Everything is written through service-role routes. League members can read
-- their league's expansion, except other clubs' protection lists while clubs
-- are still choosing.
CREATE POLICY "Members read their league's expansions" ON public.expansions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.league_members m WHERE m.league_id = expansions.league_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY "Members read expansion clubs" ON public.expansion_clubs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expansions e JOIN public.league_members m ON m.league_id = e.league_id
                 WHERE e.id = expansion_clubs.expansion_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY "Members read expansion picks" ON public.expansion_picks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expansions e JOIN public.league_members m ON m.league_id = e.league_id
                 WHERE e.id = expansion_picks.expansion_id AND m.user_id = (SELECT auth.uid())));

-- Squad statuses an expansion club can't take: the academy, players out on
-- loan (still owned elsewhere), and players in on loan (they belong to the lender).
CREATE OR REPLACE FUNCTION public.expansion_exempt_status(p_status roster_status)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$ SELECT p_status IN ('taxi', 'loan_out', 'loan_in'); $$;

-- The new club whose turn it is: among clubs whose squads aren't full, the one
-- with the fewest picks so far, then by pick order. That alternates turns and
-- skips a club once it's full. NULL when every new club is full.
CREATE OR REPLACE FUNCTION public.expansion_on_clock(p_expansion_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.team_id
  FROM public.expansion_clubs c
  JOIN public.expansions e ON e.id = c.expansion_id
  JOIN public.leagues l ON l.id = e.league_id
  WHERE c.expansion_id = p_expansion_id
    AND public.team_active_count(c.team_id) < l.roster_size
  ORDER BY (SELECT count(*) FROM public.expansion_picks p WHERE p.expansion_id = c.expansion_id AND p.team_id = c.team_id),
           c.pick_order NULLS LAST, c.team_id
  LIMIT 1;
$$;

-- Closes protections and starts the draft. A club that protected fewer than
-- protect_count players gets its most valuable eligible players added
-- automatically, and the new clubs get a random pick order.
CREATE OR REPLACE FUNCTION public.start_expansion_draft_rpc(p_expansion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exp     RECORD;
  v_team    RECORD;
  v_auto    INT := 0;
  v_added   INT;
BEGIN
  SELECT * INTO v_exp FROM public.expansions WHERE id = p_expansion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Expansion not found.'); END IF;
  IF v_exp.status <> 'protecting' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This expansion draft has already started.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.expansion_clubs WHERE expansion_id = p_expansion_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No new club has joined yet.');
  END IF;

  FOR v_team IN
    SELECT t.id FROM public.teams t
    WHERE t.league_id = v_exp.league_id
      AND t.id NOT IN (SELECT team_id FROM public.expansion_clubs WHERE expansion_id = p_expansion_id)
  LOOP
    INSERT INTO public.expansion_protections (expansion_id, team_id, player_id, automatic)
    SELECT p_expansion_id, v_team.id, re.player_id, TRUE
    FROM public.roster_entries re
    JOIN public.players p ON p.id = re.player_id
    WHERE re.team_id = v_team.id
      AND NOT public.expansion_exempt_status(re.status)
      AND re.player_id NOT IN (
        SELECT player_id FROM public.expansion_protections WHERE expansion_id = p_expansion_id AND team_id = v_team.id
      )
    ORDER BY p.market_value DESC NULLS LAST, p.id
    LIMIT GREATEST(0, v_exp.protect_count - (
      SELECT count(*) FROM public.expansion_protections WHERE expansion_id = p_expansion_id AND team_id = v_team.id
    ));
    GET DIAGNOSTICS v_added = ROW_COUNT;
    v_auto := v_auto + v_added;
  END LOOP;

  WITH shuffled AS (
    SELECT team_id, row_number() OVER (ORDER BY random()) AS slot
    FROM public.expansion_clubs WHERE expansion_id = p_expansion_id
  )
  UPDATE public.expansion_clubs c SET pick_order = s.slot
  FROM shuffled s WHERE c.expansion_id = p_expansion_id AND c.team_id = s.team_id;

  UPDATE public.expansions SET status = 'drafting', started_at = NOW() WHERE id = p_expansion_id;

  RETURN jsonb_build_object('success', TRUE, 'automatic_protections', v_auto,
    'on_clock', public.expansion_on_clock(p_expansion_id));
END;
$$;

-- One pick, atomically. p_player_id NULL means pick automatically: the most
-- valuable exposed player still allowed, else the most valuable free agent.
-- Returns {success, error?, player_id, from_team_id, complete, on_clock}.
CREATE OR REPLACE FUNCTION public.expansion_pick_rpc(p_expansion_id UUID, p_team_id UUID, p_player_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exp       RECORD;
  v_player    UUID := p_player_id;
  v_entry     RECORD;
  v_from      UUID;
  v_lost      INT;
  v_pick_no   INT;
  v_on_clock  UUID;
  v_auto      BOOLEAN := p_player_id IS NULL;
BEGIN
  SELECT * INTO v_exp FROM public.expansions WHERE id = p_expansion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Expansion not found.'); END IF;
  IF v_exp.status <> 'drafting' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'The expansion draft isn''t running.');
  END IF;

  v_on_clock := public.expansion_on_clock(p_expansion_id);
  IF v_on_clock IS DISTINCT FROM p_team_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'It isn''t this club''s turn.');
  END IF;

  IF v_auto THEN
    SELECT re.player_id INTO v_player
    FROM public.roster_entries re
    JOIN public.teams t ON t.id = re.team_id AND t.league_id = v_exp.league_id
    JOIN public.players p ON p.id = re.player_id
    WHERE NOT public.expansion_exempt_status(re.status)
      AND re.team_id NOT IN (SELECT team_id FROM public.expansion_clubs WHERE expansion_id = p_expansion_id)
      AND re.player_id NOT IN (SELECT player_id FROM public.expansion_protections WHERE expansion_id = p_expansion_id)
      AND (SELECT count(*) FROM public.expansion_picks x WHERE x.expansion_id = p_expansion_id AND x.from_team_id = re.team_id) < v_exp.per_club_cap
    ORDER BY p.market_value DESC NULLS LAST, p.id
    LIMIT 1;

    IF v_player IS NULL THEN
      SELECT p.id INTO v_player
      FROM public.players p
      WHERE p.is_active
        AND NOT EXISTS (SELECT 1 FROM public.roster_entries re WHERE re.league_id = v_exp.league_id AND re.player_id = p.id)
      ORDER BY p.market_value DESC NULLS LAST, p.id
      LIMIT 1;
    END IF;
    IF v_player IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Nobody is left to pick.'); END IF;
  END IF;

  SELECT re.id, re.team_id, re.status INTO v_entry
  FROM public.roster_entries re
  JOIN public.teams t ON t.id = re.team_id AND t.league_id = v_exp.league_id
  WHERE re.player_id = v_player
  ORDER BY (re.status = 'loan_in')  -- the owning club's entry first
  LIMIT 1;

  IF FOUND THEN
    v_from := v_entry.team_id;
    IF v_from IN (SELECT team_id FROM public.expansion_clubs WHERE expansion_id = p_expansion_id) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'That player already belongs to a new club.');
    END IF;
    IF public.expansion_exempt_status(v_entry.status) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Academy players and players on loan can''t be taken.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.expansion_protections WHERE expansion_id = p_expansion_id AND player_id = v_player) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'That player is protected.');
    END IF;
    SELECT count(*) INTO v_lost FROM public.expansion_picks WHERE expansion_id = p_expansion_id AND from_team_id = v_from;
    IF v_lost >= v_exp.per_club_cap THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'That club has already lost ' || v_exp.per_club_cap || ' players.');
    END IF;

    UPDATE public.roster_entries
    SET team_id = p_team_id, status = 'bench', acquisition_type = 'draft', acquisition_value = 0, acquired_at = NOW(),
        held_at = NULL, held_source = NULL, on_trade_block = FALSE
    WHERE id = v_entry.id;
    UPDATE public.player_sale_listings SET status = 'cancelled', updated_at = NOW()
    WHERE seller_team_id = v_from AND player_id = v_player AND status IN ('pending', 'active');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = v_player AND is_active) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'That player isn''t available.');
    END IF;
    v_from := NULL;
    INSERT INTO public.roster_entries (team_id, player_id, status, acquisition_type, acquisition_value, acquired_at)
    VALUES (p_team_id, v_player, 'bench', 'draft', 0, NOW());
  END IF;

  SELECT COALESCE(max(pick_number), 0) + 1 INTO v_pick_no FROM public.expansion_picks WHERE expansion_id = p_expansion_id;
  INSERT INTO public.expansion_picks (expansion_id, team_id, player_id, from_team_id, pick_number, automatic)
  VALUES (p_expansion_id, p_team_id, v_player, v_from, v_pick_no, v_auto);

  INSERT INTO public.transactions (league_id, team_id, player_id, type, notes)
  VALUES (v_exp.league_id, p_team_id, v_player, 'draft_pick',
    'Expansion draft pick ' || v_pick_no ||
    CASE WHEN v_from IS NULL THEN ' (free agent)' ELSE ' from ' || (SELECT team_name FROM public.teams WHERE id = v_from) END);

  v_on_clock := public.expansion_on_clock(p_expansion_id);
  IF v_on_clock IS NULL THEN
    UPDATE public.expansions SET status = 'complete', completed_at = NOW() WHERE id = p_expansion_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'player_id', v_player, 'from_team_id', v_from,
    'complete', v_on_clock IS NULL, 'on_clock', v_on_clock);
END;
$$;

REVOKE ALL ON FUNCTION public.start_expansion_draft_rpc(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_pick_rpc(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expansion_on_clock(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_expansion_draft_rpc(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expansion_pick_rpc(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expansion_on_clock(UUID) TO authenticated, service_role;
