-- ============================================================
-- Migration 177: pl_match_lineups
-- ============================================================
--
-- Where each starter actually stood. FPL says who started a match but not the
-- shape or the sides, so the Lineup Builder used to infer both from listed
-- positions and could not tell, say, which of two right-footed centre-backs
-- played in the middle. The Premier League's own match feed (pulselive) gives
-- each side's formation label and its lines of players, which settles it.
--
-- One row per club per match, keyed like pl_fixtures. `lines` runs from the
-- goalkeeper forwards, each line LEFT TO RIGHT, as Gaffa player ids; a starter
-- with no Gaffa row is left out of his line. Written by
-- src/lib/fixtures/plLineups.ts.

CREATE TABLE IF NOT EXISTS public.pl_match_lineups (
  season          TEXT        NOT NULL,
  fpl_fixture_id  INT         NOT NULL,
  club_slug       TEXT        NOT NULL,
  formation       TEXT,                     -- the feed's label, e.g. "4-2-3-1"
  lines           JSONB       NOT NULL,     -- [["gk-id"], ["lb-id", "cb-id", ...], ...]
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season, fpl_fixture_id, club_slug)
);

ALTER TABLE public.pl_match_lineups ENABLE ROW LEVEL SECURITY;

-- Public match facts, like pl_fixtures: anyone may read, only the service role writes.
DROP POLICY IF EXISTS pl_match_lineups_read ON public.pl_match_lineups;
CREATE POLICY pl_match_lineups_read ON public.pl_match_lineups FOR SELECT USING (true);
