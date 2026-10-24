-- A winning bid can name a player to drop. The resolver deletes that player
-- from the winner's roster and opens a system auction on him. Two things were
-- wrong when the dropped player was also up for sale:
--
--   1. His sale listing and its anchor claim (a pending system auction row with
--      sale_listing_id set) were left behind. executeDrop cancels the listing
--      on a manual drop; the resolver never did.
--   2. The new system auction then collided with that anchor on
--      idx_waiver_claims_system_auction (one pending system auction per league
--      and player). The unique violation aborted the whole RPC, so the winning
--      bid stayed pending and process-auctions retried it every five minutes.
--      (2026-10-23: ChelsZ FC's De Cuyper bid, dropping a listed Hackney.)
--
-- Patch the function in place, as 165, 172 and 174 do, and fail loudly if an
-- anchor isn't there exactly once. The listing is cancelled first, then the
-- insert is made safe against any other live system auction.
DO $patch$
DECLARE
  v_def   TEXT;
  v_hits  INT;
  v_old_a TEXT := E'      DELETE FROM public.roster_entries\n      WHERE team_id = v_winner_team_id\n        AND player_id = v_winner_claim.drop_player_id;\n';
  v_new_a TEXT := v_old_a || E'\n'
    || E'      -- The dropped player can no longer be sold by this team: cancel his\n'
    || E'      -- pending listing and reject the anchor claim that listing seeded.\n'
    || E'      WITH cancelled AS (\n'
    || E'        UPDATE public.player_sale_listings\n'
    || E'        SET status = ''cancelled'', updated_at = NOW()\n'
    || E'        WHERE league_id = p_league_id\n'
    || E'          AND player_id = v_winner_claim.drop_player_id\n'
    || E'          AND seller_team_id = v_winner_team_id\n'
    || E'          AND status = ''pending''\n'
    || E'        RETURNING id\n'
    || E'      )\n'
    || E'      UPDATE public.waiver_claims\n'
    || E'      SET status = ''rejected''\n'
    || E'      WHERE sale_listing_id IN (SELECT id FROM cancelled)\n'
    || E'        AND status = ''pending'';\n';
  v_old_b TEXT := E'0, 999, ''pending'', 0, TRUE, v_auction_expiry, NULL, TRUE\n      );';
  v_new_b TEXT := E'0, 999, ''pending'', 0, TRUE, v_auction_expiry, NULL, TRUE\n      )\n      ON CONFLICT (league_id, player_id)\n        WHERE team_id IS NULL AND status = ''pending'' AND is_auction = TRUE\n        DO NOTHING;';
BEGIN
  SELECT pg_get_functiondef('public.resolve_single_player_auction_rpc(uuid, uuid, integer[])'::regprocedure) INTO v_def;

  v_hits := (length(v_def) - length(replace(v_def, v_old_a, ''))) / length(v_old_a);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION 'Expected one winner drop-player delete in resolve_single_player_auction_rpc, found %', v_hits;
  END IF;
  v_def := replace(v_def, v_old_a, v_new_a);

  v_hits := (length(v_def) - length(replace(v_def, v_old_b, ''))) / length(v_old_b);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION 'Expected one dropped-player auction insert in resolve_single_player_auction_rpc, found %', v_hits;
  END IF;
  v_def := replace(v_def, v_old_b, v_new_b);

  EXECUTE v_def;
END
$patch$;
