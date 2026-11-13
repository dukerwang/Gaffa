-- 184: place round-one bye clubs into the tie their bracket leads to.
--
-- createTournament marked each bye tie won but read next_matchup_id from rows
-- fetched before the links were written, so it was always null and the bye
-- club was never placed in the next round. A Champions Cup semi-final would
-- then hold one club and never start. Fixed in createTournaments.ts; this
-- repairs the cups already created. It only fills an empty place with the club
-- the bracket already sends there; no pairing, score or result changes.
-- Even bracket positions fill team_a, odd fill team_b, as advanceWinner does.
-- Status is left alone: the resolve_stalled cron activates a round's ties once
-- its first matchweek starts (src/app/api/sync/tournaments/route.ts).

UPDATE public.tournament_matchups n
SET team_a_id = m.winner_id
FROM public.tournament_matchups m
JOIN public.tournament_rounds r ON r.id = m.round_id
JOIN public.tournaments t ON t.id = r.tournament_id
WHERE n.id = m.next_matchup_id
  AND t.status <> 'completed'
  AND m.status = 'completed'
  AND m.winner_id IS NOT NULL
  AND (m.team_a_id IS NULL OR m.team_b_id IS NULL)
  AND m.bracket_position % 2 = 0
  AND n.team_a_id IS NULL;

UPDATE public.tournament_matchups n
SET team_b_id = m.winner_id
FROM public.tournament_matchups m
JOIN public.tournament_rounds r ON r.id = m.round_id
JOIN public.tournaments t ON t.id = r.tournament_id
WHERE n.id = m.next_matchup_id
  AND t.status <> 'completed'
  AND m.status = 'completed'
  AND m.winner_id IS NOT NULL
  AND (m.team_a_id IS NULL OR m.team_b_id IS NULL)
  AND m.bracket_position % 2 = 1
  AND n.team_b_id IS NULL;
