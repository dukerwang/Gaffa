-- ============================================================
-- Migration 188: Lock down SECURITY DEFINER RPCs that were still public
-- ============================================================
--
-- Supabase's security advisor (2026-11-07) listed SECURITY DEFINER functions in
-- `public` that the `anon` role can execute through /rest/v1/rpc/<name> with
-- only the public anon key. Six of them change data and none checks who is
-- calling (no auth.uid(), no service-role check in the body):
--
--   place_auction_bid_rpc        bids for any team the caller names
--   execute_draft_pick           makes a draft pick for any team
--   auto_draft_pick              triggers an auto-pick in any league
--   refresh_auction_state        rewrites an auction's cached state
--   update_player_fantasy_scores recomputes every player's fantasy totals
--   trigger_live_score_sync      calls the live sync endpoint
--
-- Migration 050 did this for the first batch of RPCs. These escaped for the same
-- reason a later REVOKE can: 050 revoked `update_player_fantasy_scores()` with
-- no arguments, and the function was later replaced by `(p_season text)`. A
-- REVOKE names one signature, so the new overload was public again.
--
-- Callers, all traced before writing this:
--   * place_auction_bid_rpc        src/app/api/leagues/[leagueId]/auctions/bid/route.ts (admin client)
--   * update_player_fantasy_scores src/app/api/sync/stats/route.ts (service-role client), two repair scripts
--   * trigger_live_score_sync      pg_cron job `live-score-sync-5m`, which runs as postgres (the owner)
--   * execute_draft_pick, auto_draft_pick, refresh_auction_state
--                                  no application caller; drafts use make_draft_pick_rpc. refresh_auction_state
--                                  is called from trigger functions, which run as their owner.
-- The three read-only helpers below are called only from server code with the
-- admin client (expansion routes, hubData.ts, the players page).
--
-- service_role keeps EXECUTE and is granted again explicitly. The owner (postgres)
-- is not affected, so pg_cron and the trigger functions keep working.
--
-- Deliberately NOT touched:
--   * is_league_member(uuid, uuid)  used inside an RLS policy, so the signed-in role must keep it
--   * touch_league_activity(uuid)   signed-in only and checks auth.uid()
--   * the trigger functions the advisor lists  they cannot be called as RPCs, and a trigger
--                                  checks EXECUTE when it is created, not when it fires
--
-- To undo: GRANT EXECUTE ON FUNCTION <the same signatures> TO anon, authenticated;
-- ============================================================

-- 1. Change data, no caller check.
REVOKE EXECUTE ON FUNCTION public.place_auction_bid_rpc(uuid, uuid, uuid, uuid, integer, timestamptz, timestamptz, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_draft_pick(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_draft_pick(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_auction_state(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_player_fantasy_scores(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_live_score_sync() FROM PUBLIC, anon, authenticated;

-- 2. Read-only helpers that only server code calls.
REVOKE EXECUTE ON FUNCTION public.expansion_on_clock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.player_xgi_percentile(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.season_gameweeks(text) FROM PUBLIC, anon, authenticated;

-- 3. service_role keeps access.
GRANT EXECUTE ON FUNCTION public.place_auction_bid_rpc(uuid, uuid, uuid, uuid, integer, timestamptz, timestamptz, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_draft_pick(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_draft_pick(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_auction_state(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_player_fantasy_scores(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_live_score_sync() TO service_role;
GRANT EXECUTE ON FUNCTION public.expansion_on_clock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.player_xgi_percentile(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.season_gameweeks(text) TO service_role;
