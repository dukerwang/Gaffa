-- Gaffa — Migration 158: Guard trigger_process_auctions() and restore 5m cron sweep
--
-- Why:
-- 1. Migration 102 scheduled `process-auctions-1m` to run every minute, but it was
--    subsequently disabled (active = false) because 1-minute invocations burned
--    through Vercel Hobby's 4-CPU-hour monthly budget (1,440 calls/day), and
--    pg_net's default 5-second timeout frequently failed on cold starts.
-- 2. Once disabled, auctions that expired while nobody had the app open sat
--    unresolved until a manager loaded the Transfers hub (where useLiveTransfers
--    triggers the client-side resolve-expired route).
--
-- Fix:
-- 1. Teach `trigger_process_auctions()` to short-circuit directly in Postgres
--    before making an HTTP request. If no pending auction is expired, no active
--    auction is in the 2-hour closing-in notification window, and no sale listing
--    is older than 14 days, the function returns in < 1ms without invoking Vercel.
--    This slashes remote HTTP invocations by over 99%.
-- 2. Bump pg_net's `timeout_milliseconds` to 30,000 ms so Vercel cold starts
--    never drop.
-- 3. Unschedule the inactive `process-auctions-1m` job and schedule
--    `process-auctions-5m` to run every 5 minutes (*/5 * * * *).

CREATE OR REPLACE FUNCTION public.trigger_process_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_secret TEXT;
  v_has_work BOOLEAN := FALSE;
BEGIN
  -- 1. Check if there are any expired pending auctions that need settlement
  IF EXISTS (
    SELECT 1
    FROM public.waiver_claims
    WHERE status = 'pending'
      AND is_auction = TRUE
      AND expires_at <= NOW()
  ) THEN
    v_has_work := TRUE;
  END IF;

  -- 2. Check if any active auction is closing in the final 2 hours and hasn't had the closing-in alert sent
  IF NOT v_has_work AND EXISTS (
    SELECT 1
    FROM public.waiver_claims wc
    WHERE wc.status = 'pending'
      AND wc.is_auction = TRUE
      AND wc.team_id IS NOT NULL
      AND wc.faab_bid > 0
      AND wc.expires_at > NOW()
      AND wc.expires_at <= NOW() + INTERVAL '2 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.league_id = wc.league_id
          AND n.tag = 'auction-closing-' || COALESCE(wc.sale_listing_id::text, wc.player_id::text)
      )
  ) THEN
    v_has_work := TRUE;
  END IF;

  -- 3. Check if there are any stale listings older than 14 days
  IF NOT v_has_work AND EXISTS (
    SELECT 1
    FROM public.player_sale_listings
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '14 days'
  ) THEN
    v_has_work := TRUE;
  END IF;

  -- If there is no work to do, exit immediately without spending Vercel CPU time
  IF NOT v_has_work THEN
    RETURN;
  END IF;

  v_secret := public.cron_secret();
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'cron_secret not found in vault.secrets — see migration 098';
  END IF;

  PERFORM net.http_post(
    url                  := 'https://gaffa.live/api/cron/process-auctions',
    headers              := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    timeout_milliseconds := 30000
  );
END;
$function$;

-- Unschedule stale 1m or 10m job names if present
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT j.jobid
    FROM cron.job j
    WHERE j.jobname IN ('process-auctions-1m', 'process-auctions-10m')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Schedule 5-minute sweep
SELECT cron.schedule(
  'process-auctions-5m',
  '*/5 * * * *',
  'SELECT trigger_process_auctions();'
);
