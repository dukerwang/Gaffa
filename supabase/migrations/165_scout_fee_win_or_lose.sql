-- Scout's Fee, win or lose.
--
-- Applied after 164, the last migration that redefines
-- resolve_single_player_auction_rpc. Any later CREATE OR REPLACE of that
-- function must keep this rule, or it will silently restore the old one.
--
-- The fee used to be paid only when the manager who opened an auction lost it
-- (migrations 093, 152). That made losing worth 10% of the price, so a scout
-- who valued a player at v stopped bidding at v / 1.1. Paying the same 10% when
-- the scout wins, as a rebate on their own bid, moves that point back to v.
-- The 80% burn is unchanged. When the scout wins, the other clubs share the
-- remaining 10% instead of the whole 20%.
--
-- The reference implementation is computeSolidarity() in
-- src/lib/economy/solidarity.ts, and its tests pin the same arithmetic.
--
-- This patches the LIVE function text rather than restating all ~600 lines, so
-- it can't undo whatever the held-players migrations changed elsewhere in the
-- resolver. It fails loudly if any line it expects has moved.

DO $migration$
DECLARE
  v_def TEXT;
  v_old TEXT;
  v_new TEXT;
  v_edits TEXT[][] := ARRAY[
    -- 1. A manager-opened auction always has a scout, including when they win.
    [
      E'        AND v_initiator_team_id <> v_winner_team_id\n',
      ''
    ],
    -- 2. A scout who won is the payer, so only one club is left out of the split.
    [
      'v_other_club_count := GREATEST(0, v_total_clubs - 2);',
      'v_other_club_count := GREATEST(0, v_total_clubs - CASE WHEN v_initiator_team_id = v_winner_team_id THEN 1 ELSE 2 END);'
    ]
  ];
  i INT;
BEGIN
  v_def := pg_get_functiondef('public.resolve_single_player_auction_rpc(uuid,uuid,integer[])'::regprocedure);

  FOR i IN 1 .. array_length(v_edits, 1) LOOP
    v_old := v_edits[i][1];
    v_new := v_edits[i][2];
    IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
      RAISE EXCEPTION 'scout fee migration: expected exactly one match for edit %, resolver has changed', i;
    END IF;
    v_def := replace(v_def, v_old, v_new);
  END LOOP;

  EXECUTE v_def;
END
$migration$;
