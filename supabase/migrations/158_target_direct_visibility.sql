-- ============================================================
-- Migration 158: a target you send to one club only
--
-- 153 gave a target two audiences: the whole league, or nobody. Both are
-- wrong for the commonest case. Naming a player you want is usually an
-- approach to the club that owns him, and the two existing options force a
-- choice between announcing that approach to nine rivals — who now know
-- where to bid against you — and telling nobody at all, which reaches the
-- one person who could actually say yes exactly as often as it reaches
-- everybody else: never.
--
-- 'direct' is that middle rung. The owner is told and can see it; the rest
-- of the league cannot.
--
-- Only meaningful on a NAMED target. A role profile has no owner to send it
-- to, so 'direct' on one would name an audience that does not exist. That
-- rule is folded into player_targets_kind_shape rather than living beside
-- it, for the reason 155 gave: the kind and what the kind permits stay one
-- rule, so neither can be satisfied while the other is broken.
-- ============================================================

-- ── 1. The third value ───────────────────────────────────────

ALTER TABLE public.player_targets
  DROP CONSTRAINT IF EXISTS player_targets_visibility_check;

ALTER TABLE public.player_targets
  ADD CONSTRAINT player_targets_visibility_check
  CHECK (visibility IN ('public', 'direct', 'private'));

COMMENT ON COLUMN public.player_targets.visibility IS
  'Who can read this target. public = the whole league; direct = only the club '
  'that rosters the named player (named targets only); private = only the club '
  'that posted it. Enforced by RLS, not by the reading code — Realtime honours '
  'RLS and the board subscribes.';

-- ── 2. Fold the named-only rule into the shape CHECK ─────────

ALTER TABLE public.player_targets
  DROP CONSTRAINT IF EXISTS player_targets_kind_shape;

ALTER TABLE public.player_targets
  ADD CONSTRAINT player_targets_kind_shape CHECK (
    (target_kind = 'player'
      AND player_id IS NOT NULL AND position IS NULL     AND role IS NULL) OR
    (target_kind = 'profile'
      AND position  IS NOT NULL AND player_id IS NULL    AND role IS NOT NULL
      AND visibility <> 'direct')
  );

-- ── 3. RLS: the third reader ─────────────────────────────────
--
-- A direct target is readable by its author (the team clause, unchanged) and
-- by whoever rosters the player right now. "Right now" is the point: the
-- policy reads roster_entries live, so trading the player re-points the
-- target at his new owner without anything having to notice. That matches
-- the rule a target already followed for its player changing PL clubs — the
-- target is about the man, and it follows him.
--
-- Status is deliberately not filtered. A loaned player has two roster rows —
-- the lender's, marked loan_out, and the borrower's — and this lets a direct
-- target reach both. The lender is the one who could actually sell him, but
-- the borrower is the one who has him, and excluding either would silently
-- drop an approach that had a real reader. Over-delivering to two clubs in
-- one league is the cheaper mistake.
--
-- (select auth.uid()) rather than a bare auth.uid(), per 145: the bare form
-- re-evaluates per row and trips auth_rls_initplan.

DROP POLICY IF EXISTS "Targets: read public in league, private if mine"
  ON public.player_targets;
DROP POLICY IF EXISTS "Targets: read public, direct if aimed at me, private if mine"
  ON public.player_targets;

CREATE POLICY "Targets: read public, direct if aimed at me, private if mine"
  ON public.player_targets FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.league_members lm
      WHERE lm.league_id = player_targets.league_id
        AND lm.user_id = (SELECT auth.uid())
    )
    AND (
      visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = player_targets.team_id
          AND t.user_id = (SELECT auth.uid())
      )
      OR (
        visibility = 'direct'
        AND EXISTS (
          SELECT 1
          FROM public.roster_entries re
          JOIN public.teams owner ON owner.id = re.team_id
          WHERE re.league_id = player_targets.league_id
            AND re.player_id = player_targets.player_id
            AND owner.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- No new index. The far side of that join is covered by the existing
-- idx_roster_entries_player_id: a player_id is selective down to a couple of
-- rows league-wide, and the league_id filter costs nothing on top of that.
-- roster_entries_one_club_per_player_per_league looks like a better fit and
-- is not — it is partial on status <> 'loan_out', which this policy does not
-- predicate on.
