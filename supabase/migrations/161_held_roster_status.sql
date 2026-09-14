-- Gaffa — Migration 161: held players (part 1 of 4)
--
-- A player who arrives at a squad with no room is held: he's the manager's, off
-- the squad, and doesn't count toward the roster limit, until the manager
-- activates or drops him. See docs/superpowers/specs/2026-09-13-held-players-design.md.
--
-- Split out on its own because Postgres refuses to use an enum value in the same
-- transaction that adds it, and 162 onward reference 'held'.

ALTER TYPE public.roster_status ADD VALUE IF NOT EXISTS 'held';
