import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    COMMISSIONER_LEAVE_BLOCKED_MESSAGE,
    DELETE_BLOCKED_MESSAGE,
    LEAVABLE_LEAGUE_STATUS,
    canLeaveLeague,
} from '@/lib/leagues/leaveGuard';
import { handClubToCaretaker } from '@/lib/leagues/caretaker';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ leagueId: string }> }
) {
    try {
        const { leagueId } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = createAdminClient();

        // Verify league & roles
        const { data: league, error: leagueErr } = await admin
            .from('leagues')
            .select('id, commissioner_id, status')
            .eq('id', leagueId)
            .single();

        if (leagueErr || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        const isCommissioner = league.commissioner_id === user.id;

        // After the draft, results are published history: the league can't be
        // deleted, and a manager who leaves hands the club to the Caretaker.
        if (!canLeaveLeague(league.status)) {
            if (isCommissioner) {
                return NextResponse.json({ error: COMMISSIONER_LEAVE_BLOCKED_MESSAGE }, { status: 409 });
            }

            const { data: myTeam } = await admin
                .from('teams')
                .select('id')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (myTeam) {
                await handClubToCaretaker(admin, myTeam.id);
            } else {
                // A member without a club (shouldn't happen after the draft):
                // only the membership row is left to clear.
                const { error: memberErr } = await admin
                    .from('league_members')
                    .delete()
                    .eq('league_id', leagueId)
                    .eq('user_id', user.id);
                if (memberErr) throw memberErr;
            }

            return NextResponse.json({ success: true, action: 'handed_to_caretaker' });
        }

        if (isCommissioner) {
            // Commissioner action before the draft: DELETE the entire league.
            // ON DELETE CASCADE wipes teams, league_members, transactions, etc.
            // The status filter repeats the guard in the same statement, so a
            // draft that starts between the read above and this delete still
            // stops it.
            const { data: deleted, error: deleteErr } = await admin
                .from('leagues')
                .delete()
                .eq('id', leagueId)
                .eq('status', LEAVABLE_LEAGUE_STATUS)
                .select('id');

            if (deleteErr) throw deleteErr;
            if (!deleted || deleted.length === 0) {
                return NextResponse.json({ error: DELETE_BLOCKED_MESSAGE }, { status: 409 });
            }

            return NextResponse.json({ success: true, action: 'deleted' });
        }

        // Member action before the draft: nothing has been played, so the
        // club goes with them.
        const { error: teamErr } = await admin
            .from('teams')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', user.id);

        if (teamErr) throw teamErr;

        const { error: memberErr } = await admin
            .from('league_members')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', user.id);

        if (memberErr) throw memberErr;

        return NextResponse.json({ success: true, action: 'left' });

    } catch (error: any) {
        console.error('Leave/Delete league error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
