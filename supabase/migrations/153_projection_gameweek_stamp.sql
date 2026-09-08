-- Stamp public.players.projected_points with the gameweek it was computed for.
--
-- The column has been written by scripts/sync_projected_points.ts since the
-- projections engine landed, but carried no season, gameweek, or timestamp. A
-- projection is only meaningful for one fixture round, so without a stamp the
-- UI cannot tell a fresh number from one left over from a previous week, and
-- cannot distinguish "no fixture this gameweek" (engine writes 0.0) from
-- "never computed" (still NULL). Both render identically today.
--
-- These three columns let a surface decide whether to trust the number. Read
-- them together: a projection is current only when projected_season and
-- projected_gameweek both match the round being displayed.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS projected_season text,
  ADD COLUMN IF NOT EXISTS projected_gameweek integer,
  ADD COLUMN IF NOT EXISTS projected_at timestamptz;

COMMENT ON COLUMN public.players.projected_points IS
  'Projected fantasy points for the round named by projected_season/projected_gameweek. Stale unless both match the round being rendered.';
COMMENT ON COLUMN public.players.projected_season IS
  'Season ("YYYY-YY") the current projected_points value was computed for.';
COMMENT ON COLUMN public.players.projected_gameweek IS
  'Gameweek the current projected_points value was computed for.';
COMMENT ON COLUMN public.players.projected_at IS
  'When projected_points was last recomputed.';

-- Existing values predate the stamp, so nothing can vouch for which gameweek
-- they belong to. Leaving them unstamped makes every consumer treat them as
-- stale until the next sync run, which is the honest reading.
