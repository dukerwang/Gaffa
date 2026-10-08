'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './join.module.css';

interface LeaguePreview {
  name: string;
  maxTeams: number;
  currentTeams: number;
  rosterSize: number;
  faabBudget: number;
  isDynasty: boolean;
  status: 'setup' | 'drafting' | 'active' | 'completed' | 'offseason' | 'pre_draft';
  /** After the draft, the Caretaker club a newcomer would take over. */
  openClub: { teamName: string } | null;
  /** Joining creates a new club: before the first draft, between redraft seasons, or into an expansion. */
  newClubOpen: boolean;
  /** The new club is an expansion club: it builds its squad in the expansion draft. */
  expansionOpen?: boolean;
}

export default function JoinLeagueForm() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inviteCode.trim().length < 4) return;

    const timer = setTimeout(async () => {
      const res = await fetch(`/api/leagues/lookup?code=${encodeURIComponent(inviteCode.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setPreviewError(json.error ?? 'Invite code not found');
        return;
      }
      setPreview(json);
    }, 400);

    return () => clearTimeout(timer);
  }, [inviteCode]);

  // After the draft, the only way in is taking over a Caretaker club.
  // A Caretaker club is filled before anyone gets a new one.
  const takeover = preview && preview.status !== 'setup' ? preview.openClub : null;
  const isFull = preview && !takeover ? preview.currentTeams >= preview.maxTeams : false;
  const isClosed = preview ? !takeover && !preview.newClubOpen : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/leagues/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode, teamName: teamName.trim() || undefined }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed to join league');
      setLoading(false);
      return;
    }

    window.dispatchEvent(new Event('navigation-start'));
    router.push(`/league/${json.leagueId}/team-setup`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="invite-code">
          Invite Code
        </label>
        <input
          id="invite-code"
          type="text"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value.toUpperCase());
            setPreview(null);
            setPreviewError(null);
          }}
          className={styles.input}
          placeholder="e.g. ABC12345"
          required
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
        />
        <p className={styles.hint}>Get this from your league commissioner.</p>
      </div>

      {previewError && <p className={styles.error}>{previewError}</p>}

      {preview && (
        <div className={styles.previewCard}>
          <p className={styles.previewName}>{preview.name}</p>
          <div className={styles.previewStats}>
            <span>{preview.currentTeams}/{preview.maxTeams} teams</span>
            <span>{preview.rosterSize}-man rosters</span>
            <span>{preview.isDynasty ? 'Dynasty' : 'Redraft'}</span>
            <span>€{preview.faabBudget}m budget</span>
          </div>
          {isFull && <p className={styles.previewWarning}>League is full.</p>}
          {!isFull && isClosed && (
            <p className={styles.previewWarning}>League is no longer accepting new members.</p>
          )}
          {takeover && (
            <p className={styles.hint}>
              You&apos;ll take over {takeover.teamName}, which the Caretaker has run since its manager left. You
              keep its squad, Club Balance and record, and you can rename it and change its crest.
            </p>
          )}
          {!takeover && preview.expansionOpen && (
            <p className={styles.hint}>
              This league is expanding. You&apos;ll build your squad in the expansion draft, picking from the
              players other clubs leave unprotected and from the free agents, and you start with the league&apos;s
              median Club Balance.
            </p>
          )}
        </div>
      )}

      {preview && !takeover && !isFull && !isClosed && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="team-name">
            Team Name
          </label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className={styles.input}
            placeholder="Your Club"
            maxLength={40}
          />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading || isFull || isClosed}
      >
        {loading ? 'Joining…' : takeover ? 'Take Over Club' : 'Join League'}
      </button>
    </form>
  );
}
