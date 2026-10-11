'use client';

import { useState } from 'react';
import type { GranularPosition } from '@/types';
import type { EnrichedPlayer, RosterPlayer } from '@/lib/transfers/buildTransfersModel';
import PositionBadge from '@/components/players/PositionBadge';
import Modal from './Modal';
import styles from './BidDialog.module.css';
import { getPlayerDisplayName } from '@/lib/players/displayName';

const money = (n: number) => `€${n}m`;

interface Props {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  player: EnrichedPlayer;
  rosterFull: boolean;
  myRoster: RosterPlayer[];
  /** FPL team ids whose match has kicked off this gameweek: those players can't be dropped. */
  kickedOffClubIds: number[];
  onDone: () => void;
}

/**
 * Redraft instant signing after Transfer Day: free, first come first served,
 * until the player's club kicks off (POST /transfer-day/claim).
 */
export default function SignNowDialog({ open, onClose, leagueId, player, rosterFull, myRoster, kickedOffClubIds, onDone }: Props) {
  const [dropId, setDropId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const locked = new Set(kickedOffClubIds);
  const droppable = myRoster.filter(
    (r) => (r.status === 'active' || r.status === 'bench') && !(r.pl_team_id != null && locked.has(r.pl_team_id)),
  );
  const needsDrop = rosterFull && !dropId;

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/transfer-day/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id, dropPlayerId: dropId || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? 'Could not sign that player.');
        return;
      }
      onDone();
      onClose();
    } catch {
      setMessage('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign Now"
      footer={
        <>
          <span className={styles.summary}>Free, and he joins your squad straight away.</span>
          <button type="button" className={styles.ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={styles.go} onClick={submit} disabled={busy || needsDrop}>
            {busy ? 'Signing…' : 'Sign Player'}
          </button>
        </>
      }
    >
      <div className={styles.identity}>
        <PositionBadge position={player.primary_position as GranularPosition} size="sm" />
        <span className={styles.name}>{getPlayerDisplayName(player, 'full')}</span>
        <span className={styles.meta}>
          {player.pl_team} · {money(Number(player.market_value) || 0)} · free agent
        </span>
      </div>

      {rosterFull && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Player to drop</span>
          <select className={styles.select} value={dropId} onChange={(e) => setDropId(e.target.value)}>
            <option value="">Choose a player to drop</option>
            {droppable.map((r) => (
              <option key={r.id} value={r.id}>
                {getPlayerDisplayName(r, 'full')} · {r.primary_position}
              </option>
            ))}
          </select>
          <div className={styles.hint}>
            Your squad is full. The player you drop is up for auction until the next Transfer Day.
          </div>
        </label>
      )}

      {message && <p className={styles.error}>{message}</p>}
    </Modal>
  );
}
