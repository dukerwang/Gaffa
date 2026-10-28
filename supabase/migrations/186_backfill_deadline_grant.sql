-- Migration 186: the ledger row the 2026-09-01 Transfer Deadline grant never got.
--
-- Checked against live data before writing: once accepted trades' cash is
-- counted, every club in Matchday Militia and Dynasty Dragoon reconciles to
-- the league's €250m opening balance plus exactly €30m. No other league
-- received the grant. Balances are not touched; this only records what
-- already happened. Safe to re-run.

INSERT INTO public.transactions (league_id, team_id, type, faab_bid, notes, processed_at, created_at)
SELECT t.league_id, t.id, 'grant', 30, 'Transfer Deadline grant', '2026-09-01 12:00:00+00', now()
FROM public.teams t
WHERE t.league_id IN (
  '772588fc-98d3-43d0-a71d-cb8dd17eafcd', -- Matchday Militia
  '1fcea2ba-5eba-4433-adf0-a9340883b3cf'  -- Dynasty Dragoon
)
AND NOT EXISTS (
  SELECT 1 FROM public.transactions x
  WHERE x.team_id = t.id AND x.type = 'grant' AND x.notes = 'Transfer Deadline grant'
);
