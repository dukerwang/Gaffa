-- ============================================================
-- Migration 176: players.preferred_foot
-- ============================================================
--
-- The Lineup Builder lays a real starting XI out from listed positions, and a
-- listing says "CB", never which centre-back. Foot is the usual tell: a
-- left-footed centre-back plays on the left of a pair. Read from the player's
-- Transfermarkt profile by scripts/sync_transfermarkt_gaps.ts, which already
-- fetches that page for the market value. See src/lib/lineups/fitFormation.ts.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS preferred_foot TEXT
  CHECK (preferred_foot IN ('left', 'right', 'both'));
