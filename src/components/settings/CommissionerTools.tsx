'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HoldButton } from '@/components/ui/HoldButton';
import { Select } from '@/components/ui/Select';
import { gaffaClubItem } from '@/components/select/domainItems';
import type { CrestConfig } from '@/components/crest/types';
import styles from './settings.module.css';

export interface CommissionerClub {
  teamId: string;
  teamName: string;
  /** null for a club the Caretaker runs. */
  userId: string | null;
  managerName: string | null;
  /** When the manager last opened the league (migration 171). */
  lastActiveAt?: string | null;
  crest?: CrestConfig | null;
}

function lastActiveLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days < 1) return 'Active today';
  if (days < 2) return 'Active yesterday';
  if (days < 14) return `Active ${days} days ago`;
  return `Last active ${then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

interface Props {
  leagueId: string;
  myUserId: string;
  clubs: CommissionerClub[];
}

/**
 * Commissioner controls for a league that has drafted: hand the role to
 * another manager, and remove a manager (their club passes to the Caretaker).
 */
export default function CommissionerTools({ leagueId, myUserId, clubs }: Props) {
  const router = useRouter();
  const others = clubs.filter((c) => c.userId && c.userId !== myUserId);
  const [nextCommissioner, setNextCommissioner] = useState(others[0]?.userId ?? '');
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Something went wrong.');
  }

  async function transfer() {
    const club = others.find((c) => c.userId === nextCommissioner);
    if (!club) return;
    setPending('transfer');
    setStatus(null);
    try {
      await post(`/api/leagues/${leagueId}/commissioner`, { userId: club.userId });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong.' });
      setPending(null);
    }
  }

  async function remove(club: CommissionerClub) {
    const who = club.managerName ?? 'this manager';
    setPending(club.teamId);
    setStatus(null);
    try {
      await post(`/api/leagues/${leagueId}/teams/${club.teamId}/remove-manager`);
      setStatus({ ok: true, text: `${who} was removed. The Caretaker now runs ${club.teamName}.` });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong.' });
    }
    setPending(null);
  }

  return (
    <div className={styles.panel}>
      {others.length > 0 && (
        <div className={styles.form}>
          <span className={styles.fieldLabel}>Transfer Commissioner</span>
          <Select
            fullWidth
            ariaLabel="Transfer Commissioner"
            value={nextCommissioner}
            onChange={setNextCommissioner}
            items={others.map((c) =>
              gaffaClubItem(c.userId ?? '', c.managerName ? `${c.managerName} · ${c.teamName}` : c.teamName, c.crest),
            )}
          />
          <div className={styles.formActions}>
            <HoldButton size="sm" variant="primary" disabled={pending !== null} confirmedLabel="Transferring…" onConfirm={transfer}>
              Transfer Role
            </HoldButton>
            <span className={styles.formStatus}>
              Hand the role on before you leave the league. You&apos;ll lose the commissioner controls.
            </span>
          </div>
        </div>
      )}

      {clubs
        .filter((c) => c.userId !== myUserId)
        .map((club) => (
          <div key={club.teamId} className={styles.row}>
            <div className={styles.rowMain}>
              <span className={styles.rowLabel}>{club.teamName}</span>
              <span className={styles.rowMeta}>
                {club.userId
                  ? [club.managerName ?? 'Manager', lastActiveLabel(club.lastActiveAt)].filter(Boolean).join(' · ')
                  : 'Run by the Caretaker'}
              </span>
            </div>
            {club.userId && (
              <HoldButton size="sm" disabled={pending !== null} confirmedLabel="Removing…" onConfirm={() => remove(club)}>
                Remove Manager
              </HoldButton>
            )}
          </div>
        ))}

      {clubs.some((c) => c.userId && c.userId !== myUserId) && (
        <p className={`${styles.dangerNote} ${styles.statusLine}`}>
          A removed manager&apos;s club keeps its squad, Club Balance and record. You can&apos;t undo this.
        </p>
      )}

      {status && (
        <p className={`${styles.formStatus} ${styles.statusLine} ${status.ok ? styles.formOk : styles.formError}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
