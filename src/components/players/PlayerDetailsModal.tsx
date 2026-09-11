'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavigationLink from '@/components/ui/NavigationLink';
import type { Player, PlayerOwnership } from '@/types';
import PremiumPlayerCard from './PremiumPlayerCard';
import TargetEditor from '@/components/transfers/TargetEditor';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import styles from './PlayerDetailsModal.module.css';

interface Props {
    player: Player | null;
    /**
     * Owner crest data, when the opener already knows it. `undefined` lets the
     * card resolve it; `null` means known free agent.
     */
    ownership?: PlayerOwnership | null;
    onClose: () => void;
    /** If provided, shows a "Pick" action button inside the modal */
    onPick?: (player: Player) => void;
    /** If provided, shows a "Nominate" action button inside the modal */
    onNominate?: (player: Player) => void;
    /** Opens the card onto this gameweek's game-log row, expanded. */
    focusGameweek?: number | null;
    /** Opens the card evaluated under this position slot. */
    focusPosition?: string | null;
}

export default function PlayerDetailsModal({
    player,
    ownership,
    onClose,
    onPick,
    onNominate,
    focusGameweek,
    focusPosition,
}: Props) {
    const params = useParams();
    const router = useRouter();
    const leagueId = params?.leagueId as string | undefined;
    const [targeting, setTargeting] = useState(false);

    /**
     * "Target" is the demand-side counterpart of the Bid button, and it lives
     * on the player card because this modal is how you reach a player from
     * fifteen different surfaces — putting the entry point here covers the
     * Listings board, Free Agency, the player index and the hub at once,
     * rather than four separate buttons that would each drift.
     *
     * Only on an OWNED player. A free agent needs a bid, not an advertisement,
     * and there is no owner to approach. Whether the owner is YOU is left to
     * the route, which answers "He already plays for you" — this component has
     * no view of which club is the reader's, and inventing that plumbing to
     * pre-hide one button would be the more fragile of the two.
     */
    const canTarget = Boolean(leagueId && player && ownership?.owner);

    // Close on Escape
    useEffect(() => {
        if (!player) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [player, onClose]);

    if (!player) return null;

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Player details: ${player.name}`}
        >
            <div className={styles.box} onClick={(e) => e.stopPropagation()}>
                <div className={styles.cardScaler}>
                    {/* Keyed on the player so switching subjects remounts rather
                        than briefly painting the previous player's photo. */}
                    <PremiumPlayerCard
                        key={player.id}
                        player={player}
                        ownership={ownership}
                        onClose={onClose}
                        focusGameweek={focusGameweek}
                        focusPosition={focusPosition}
                    />
                </div>

                {/* The modal stays the quick look — reached from fifteen
                    surfaces, and mid-draft you want a peek, not a navigation.
                    This is the way through to the deep view. */}
                {leagueId && (
                    <div className={styles.profileLink}>
                        <NavigationLink
                            href={`/league/${leagueId}/players/${player.id}`}
                            onClick={onClose}
                        >
                            Full profile →
                        </NavigationLink>
                    </div>
                )}

                {(onPick || onNominate || canTarget) && (
                    <div className={styles.actions}>
                        {canTarget && (
                            <button
                                className={styles.actionBtn}
                                onClick={() => setTargeting(true)}
                            >
                                Target
                            </button>
                        )}
                        {onPick && (
                            <button
                                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                onClick={() => { onPick(player); onClose(); }}
                            >
                                Draft Pick
                            </button>
                        )}
                        {onNominate && (
                            <button
                                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                onClick={() => { onNominate(player); onClose(); }}
                            >
                                Nominate
                            </button>
                        )}
                    </div>
                )}
            </div>

            {targeting && player && leagueId && (
                <TargetEditor
                    open
                    onClose={() => setTargeting(false)}
                    leagueId={leagueId}
                    target={null}
                    fixedPlayer={{
                        id: player.id,
                        name: getPlayerDisplayName(player, 'full'),
                        position: player.primary_position ?? null,
                        club: player.pl_team ?? null,
                        owner: ownership?.owner?.teamName ?? null,
                    }}
                    onDone={() => router.refresh()}
                />
            )}
        </div>
    );
}
