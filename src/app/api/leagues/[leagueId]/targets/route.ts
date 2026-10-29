import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { POSITION_FLEX_MAP } from '@/types';
import { targetStance } from '@/lib/transfers/targetStance';
import { isTargetRole } from '@/lib/transfers/targetRole';
import {
  MAX_ACTIVE_TARGETS,
  MAX_PUBLIC_TARGETS,
  TARGET_NOTE_MAX,
} from '@/lib/transfers/targetLimits';

/**
 * Targets — the demand side of the market (migration 179).
 *
 * A target is inert by design: it advertises what a club is looking for and
 * pre-fills the existing offer composer. Nothing here settles anything, which
 * is why this route has no price validation, no floor, and no clock. Compare
 * `../listings/route.ts`, which is doing the opposite job.
 *
 * Spec: docs/superpowers/specs/2026-09-04-targets-design.md
 */

interface Props {
  params: Promise<{ leagueId: string }>;
}

const VALID_POSITIONS = new Set(Object.keys(POSITION_FLEX_MAP));

/** Active and unexpired. Everything reads targets through this pair. */
function liveTargets(admin: ReturnType<typeof createAdminClient>, leagueId: string) {
  return admin
    .from('player_targets')
    .select(`*, team:teams!team_id(id, team_name, abbreviation, crest_config), player:players(${FULL_PLAYER_SELECT})`)
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());
}

/**
 * Every public target in the league, plus the caller's own, plus any direct
 * ones aimed at a player the caller rosters.
 *
 * The visibility split is enforced here AND by RLS (179, widened by 182).
 * This route uses the service-role client, which bypasses RLS, so the filter
 * below is the only thing separating the three — it is not a convenience.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: myTeam } = await admin
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!myTeam) return NextResponse.json({ error: 'No team in this league' }, { status: 403 });

  // A direct target (182) is readable by whoever rosters the player, which
  // PostgREST cannot express as an `.or` against another table — fetch my
  // roster first and match on the ids.
  const { data: mine } = await admin
    .from('roster_entries')
    .select('player_id')
    .eq('league_id', leagueId)
    .eq('team_id', myTeam.id);

  const myPlayerIds = (mine ?? []).map((r) => r.player_id);

  const clauses = [`visibility.eq.public`, `team_id.eq.${myTeam.id}`];
  if (myPlayerIds.length) {
    clauses.push(`and(visibility.eq.direct,player_id.in.(${myPlayerIds.join(',')}))`);
  }

  const { data, error } = await liveTargets(admin, leagueId)
    .or(clauses.join(','))
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ targets: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: myTeam } = await admin
    .from('teams')
    .select('id, team_name, abbreviation')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!myTeam) return NextResponse.json({ error: 'No team in this league' }, { status: 403 });

  const body = await req.json();
  const {
    targetKind,
    playerId,
    position,
    role,
    visibility,
    openToSale,
    openToTrade,
    openToLoan,
    budget,
    note,
  } = body as {
    targetKind?: string;
    playerId?: string | null;
    position?: string | null;
    role?: string | null;
    visibility?: string;
    openToSale?: boolean;
    openToTrade?: boolean;
    openToLoan?: boolean;
    budget?: number | null;
    note?: string | null;
  };

  // ── Shape. Mirrors the player_targets_kind_shape CHECK so a malformed
  // body comes back as a sentence rather than a constraint violation.
  if (targetKind !== 'player' && targetKind !== 'profile') {
    return NextResponse.json({ error: 'targetKind must be "player" or "profile"' }, { status: 400 });
  }

  if (targetKind === 'player' && !playerId) {
    return NextResponse.json({ error: 'A named target needs a player' }, { status: 400 });
  }

  if (targetKind === 'profile' && !VALID_POSITIONS.has(String(position))) {
    return NextResponse.json({ error: 'Pick one of the 12 tactical positions' }, { status: 400 });
  }

  // The role is what makes a profile answerable: "an LB" could be a EUR60m
  // starter or a body for the bench, and a seller cannot tell which.
  if (targetKind === 'profile' && !isTargetRole(role)) {
    return NextResponse.json({ error: 'Pick a squad role' }, { status: 400 });
  }

  // ── Audience. Three rungs (182), not the two 179 shipped with.
  //
  // Anything unrecognised falls back to 'public' rather than 400ing, matching
  // how the boolean stances below treat a missing field: the editor always
  // sends one, and a body that doesn't is an old client, not an attack.
  const audience: 'public' | 'direct' | 'private' =
    visibility === 'private' ? 'private' : visibility === 'direct' ? 'direct' : 'public';

  // A role profile has no owner, so there is nobody for 'direct' to reach.
  // The kind-shape CHECK enforces this too; catching it here turns a
  // constraint violation into a sentence.
  if (audience === 'direct' && targetKind !== 'player') {
    return NextResponse.json(
      { error: 'A position has no owner to approach. Name a player to send a target directly.' },
      { status: 400 },
    );
  }

  if (budget != null && (!Number.isInteger(budget) || budget < 0)) {
    return NextResponse.json({ error: 'budget must be a non-negative whole number' }, { status: 400 });
  }

  const trimmedNote = typeof note === 'string' ? note.trim() : null;
  if (trimmedNote && trimmedNote.length > TARGET_NOTE_MAX) {
    return NextResponse.json({ error: `Keep the note to ${TARGET_NOTE_MAX} characters` }, { status: 400 });
  }

  // ── You cannot want what you already have. Re-checked at match time too,
  // since a target survives its club signing the player another way.
  if (targetKind === 'player') {
    const { data: owned } = await admin
      .from('roster_entries')
      .select('id')
      .eq('team_id', myTeam.id)
      .eq('player_id', playerId as string)
      .maybeSingle();

    if (owned) {
      return NextResponse.json({ error: 'He already plays for you' }, { status: 400 });
    }
  }

  // ── Caps. Counted rather than CHECK'd, because the manager needs to be
  // told WHICH limit they hit, and a CHECK cannot count sibling rows.
  const { data: existing } = await liveTargets(admin, leagueId).eq('team_id', myTeam.id);
  const live = existing ?? [];

  if (live.length >= MAX_ACTIVE_TARGETS) {
    return NextResponse.json(
      { error: `You're tracking ${MAX_ACTIVE_TARGETS} targets already. Withdraw one to add another.` },
      { status: 409 },
    );
  }

  // Only the board is rationed. A direct target never reaches the board, so it
  // spends a slot from the 10 above and none of the 5 here — the public cap
  // exists to stop one manager's notepad filling everybody's screen, and a
  // target only its recipient can see does not do that.
  if (audience === 'public' && live.filter((t) => t.visibility === 'public').length >= MAX_PUBLIC_TARGETS) {
    return NextResponse.json(
      {
        error: `You can show ${MAX_PUBLIC_TARGETS} targets to the league at once. Withdraw one, or send this to the club that owns him instead.`,
      },
      { status: 409 },
    );
  }

  // ── Duplicate. The partial unique indexes are the real enforcement; this
  // turns a 23505 into something readable.
  const dupeQuery = liveTargets(admin, leagueId).eq('team_id', myTeam.id);
  const { data: dupe } = await (targetKind === 'player'
    ? dupeQuery.eq('player_id', playerId as string)
    : dupeQuery.eq('position', position as string)
  ).maybeSingle();

  if (dupe) {
    return NextResponse.json({ error: "You're already tracking this one" }, { status: 409 });
  }

  const { data: target, error: insertError } = await admin
    .from('player_targets')
    .insert({
      league_id: leagueId,
      team_id: myTeam.id,
      target_kind: targetKind,
      player_id: targetKind === 'player' ? playerId : null,
      position: targetKind === 'profile' ? position : null,
      role: targetKind === 'profile' ? role : null,
      visibility: audience,
      open_to_sale: openToSale !== false,
      open_to_trade: !!openToTrade,
      open_to_loan: !!openToLoan,
      budget: budget ?? null,
      note: trimmedNote || null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── Tell the owner, if there is one to tell.
  //
  // A NAMED target with an audience notifies — public or direct, the owner
  // hears about it either way, and a direct one is an approach made
  // specifically to him. A private one tells nobody by definition, and a
  // profile would ping every club that owns a left-back, which is spam on a
  // scale nothing else in the app produces.
  //
  // This is also the only event that notifies: PATCH deliberately does not,
  // or a manager could bump a budget repeatedly into somebody's
  // notifications.
  if (audience !== 'private' && targetKind === 'player') {
    try {
      // roster_entries carries league_id itself, so the owner lookup is
      // scoped without leaning on the embed to report which league it is in.
      const [{ data: playerRow }, { data: holder }] = await Promise.all([
        admin.from('players').select('name').eq('id', playerId as string).maybeSingle(),
        admin
          .from('roster_entries')
          .select('team_id, team:teams!team_id(id, user_id)')
          .eq('league_id', leagueId)
          .eq('player_id', playerId as string)
          .maybeSingle(),
      ]);

      // PostgREST models every embed as an array, including to-one relations.
      const embedded = holder?.team as unknown;
      const ownerTeam = (Array.isArray(embedded) ? embedded[0] : embedded) as
        | { id: string; user_id: string }
        | null
        | undefined;

      if (ownerTeam && ownerTeam.id !== myTeam.id) {
        const { createNotification } = await import('@/lib/notifications/createNotification');
        const { targetDeclaredNotice } = await import('@/lib/notifications/copy');

        const stance = targetStance({
          open_to_sale: openToSale !== false,
          open_to_trade: !!openToTrade,
          open_to_loan: !!openToLoan,
          budget: budget ?? null,
        });

        await createNotification(admin, {
          kind: 'targets',
          leagueId,
          userId: ownerTeam.user_id,
          ...targetDeclaredNotice(
            myTeam,
            playerRow?.name ?? 'a player',
            stance.headline,
            audience === 'direct',
          ),
          url: `/league/${leagueId}/transfers/targets`,
          tag: `target-declared-${target.id}`,
        });
      }
    } catch (err) {
      console.error('[targets] Failed to notify the owner of a declared target:', err);
    }
  }

  return NextResponse.json({ ok: true, target }, { status: 201 });
}
