import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { loadCupsPage } from '@/lib/cups/loadCupsPage';
import { TrophyShelf } from '@/components/cups/TrophyShelf';
import { NextTie } from '@/components/cups/NextTie';
import { RoundPager } from '@/components/cups/RoundPager';
import { LiveRefresh } from '@/components/gameweeks/Views';
import s from '@/components/cups/cups.module.css';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ leagueId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CupsPage({ params, searchParams }: Props) {
    const { leagueId } = await params;
    const { cup } = await searchParams;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const res = await loadCupsPage(createAdminClient(), {
        leagueId,
        userId: user.id,
        selectedCupId: typeof cup === 'string' ? cup : null,
    });
    if (res.kind === 'notFound') notFound();
    if (res.kind === 'redirect') redirect(res.to);

    const { model, season, live } = res;
    const kind = model.shelf.find((x) => x.selected)?.kind ?? 'champions_cup';

    return (
        <div className="g-page">
            {live && <LiveRefresh leagueId={leagueId} />}
            <TrophyShelf items={model.shelf} club={model.club} season={season}>
                {model.next ? <NextTie next={model.next} kind={kind} /> : null}
            </TrophyShelf>
            {model.selected && model.rounds.length > 0 ? (
                <RoundPager
                    key={model.selected.id}
                    rounds={model.rounds}
                    initial={model.initialRound}
                    seeded={model.selected.seeded}
                />
            ) : (
                <p className={s.empty}>
                    {model.selected ? 'The draw for this cup isn’t out yet.' : 'The cups are drawn at matchweek 7, once the table has had time to settle.'}
                </p>
            )}
        </div>
    );
}
