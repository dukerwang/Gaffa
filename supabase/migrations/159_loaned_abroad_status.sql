-- Gaffa — Migration 159: loaned abroad (part 1 of 2)
--
-- A player who leaves the Premier League on loan used to open the same
-- Release/Retain decision as a permanent sale, because FPL marks both with
-- status 'u'. The Retained List is priced for a player whose return is
-- uncertain; a season-long loan has a known return, so Release became a forced
-- sale into an auction the owner was barred from, and Retain spent a scarce
-- slot on a near-certain claim.
--
-- A loaned-abroad player now becomes a held right with status 'on_loan': off
-- the roster (he does not count toward the squad limit), no compensation, no
-- retained slot, tradeable, and given up for nothing. He rejoins the holder's
-- squad automatically when he is back in the PL. See migration 160 for the
-- lifecycle and the RPCs.
--
-- Split from 160 because Postgres refuses to use an enum value in the same
-- transaction that adds it, and 160's partial indexes name 'on_loan'.

ALTER TYPE public.departure_decision_status ADD VALUE IF NOT EXISTS 'on_loan';

-- Where the player sat when he left, so a returning academy player goes back
-- to the academy rather than taking a squad place.
ALTER TABLE public.departure_decisions
  ADD COLUMN IF NOT EXISTS roster_status_at_departure public.roster_status;

-- The club he joined on loan, parsed from FPL's news text. Display only.
ALTER TABLE public.departure_decisions
  ADD COLUMN IF NOT EXISTS loan_club TEXT;

-- The FPL season the loan was last confirmed in. Deliberately not season_from:
-- an offseason league records departures against the season being left, so
-- season_from can lag the live season by a year and would read every summer
-- loan as already overdue.
ALTER TABLE public.departure_decisions
  ADD COLUMN IF NOT EXISTS loan_season TEXT;

COMMENT ON COLUMN public.departure_decisions.loan_season IS
  'FPL season in which an on_loan player was last confirmed out on loan. A loan still unresolved once the next season is under way converts to an ordinary pending decision.';
