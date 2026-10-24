'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { HoldButton } from '@/components/ui/HoldButton';
import styles from './settings.module.css';

interface Props {
  leagueId: string;
  isCommissioner: boolean;
  /**
   * True once the draft has started. Leaving then hands the club to the
   * Caretaker instead of deleting it. A commissioner never sees this button
   * in a started league: they hand the role on first.
   */
  started?: boolean;
}

export default function LeaveLeagueButton({ leagueId, isCommissioner, started = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const deletes = isCommissioner && !started;

  // What the browser dialog used to ask, said beside the button instead; the
  // hold is the confirmation.
  const consequence = deletes
    ? "Deletes the league and every team in it. You can't undo this."
    : started
      ? "Your club stays in the league, and the Caretaker runs it until a new manager joins. You can't undo this."
      : "You can't undo this.";

  const handleAction = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/leave`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || (deletes ? 'Failed to delete the league.' : 'Failed to leave the league.'));
      }
      window.dispatchEvent(new Event('navigation-start'));
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      toast.error(deletes ? 'League not deleted' : 'League not left', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
      setLoading(false);
    }
  };

  return (
    <div className={styles.dangerStack}>
      <p className={styles.dangerNote}>{consequence}</p>
      <HoldButton disabled={loading} confirmedLabel={deletes ? 'Deleting…' : 'Leaving…'} onConfirm={handleAction}>
        {deletes ? 'Delete League' : 'Leave League'}
      </HoldButton>
    </div>
  );
}
