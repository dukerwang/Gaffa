'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GranularPosition } from '@/types';
import type { TransfersModel, TransfersTarget } from '@/lib/transfers/buildTransfersModel';
import PositionBadge from '@/components/players/PositionBadge';
import Modal from './Modal';
import styles from './TargetEditor.module.css';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { TARGET_ROLE_OPTIONS, type TargetRole } from '@/lib/transfers/targetRole';
import { TARGET_NOTE_MAX } from '@/lib/transfers/targetLimits';
import { roleArticle } from '@/lib/scoring/perfBand';
import { fold } from '@/lib/text/fold';

/**
 * Post a target, or edit one you already hold.
 *
 * Two kinds, and the kind never changes after posting: a named target and a
 * role are different statements, and switching one into the other reuses a row
 * the rest of the league may already have read as something else. The route
 * refuses it; this dialog doesn't offer it.
 *
 * The audience field is the one that needed the most care. Three rungs, each
 * naming what actually happens rather than saying "public" or "private", in
 * order of exposure. A NAMED target opens on "Only <the club that owns him>":
 * naming a player is usually an approach to his club, and telling nine rivals
 * where you are shopping should be something you choose, not something you get
 * by leaving a default alone. A ROLE has no owner, so that rung isn't there at
 * all — it is drawn disabled rather than dropped, so the ladder doesn't change
 * length when you flip the kind and leave you re-reading it.
 */

const POSITIONS: GranularPosition[] = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST',
];

type Audience = 'private' | 'direct' | 'public';

interface Props {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  /**
   * The transfers model, when the caller has one. It supplies the player
   * picker and the Club Balance hint, and nothing else — which is why it is
   * optional: a player's own card can open this dialog with `fixedPlayer` set
   * and no model at all, rather than the fifteen surfaces that show a player
   * card each having to load the whole hub first.
   */
  model?: TransfersModel;
  /** Editing an existing target, or null to post a new one. */
  target: TransfersTarget | null;
  /** Pre-selects a named target — the entry point from a player's own file. */
  initialPlayerId?: string | null;
  /**
   * The subject, when the caller already knows it and has no model to look it
   * up in. Replaces the picker with a statement of who this is about.
   */
  fixedPlayer?: { id: string; name: string; position: string | null; club: string | null; owner: string | null } | null;
  onDone: () => void;
}

const Tick = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12.5 9.5 18 20 6.5" />
  </svg>
);

export default function TargetEditor({
  open, onClose, leagueId, model, target, initialPlayerId, fixedPlayer = null, onDone,
}: Props) {
  const editing = target != null;

  // Every player another club in this league holds. That is the honest pool for
  // a named target: you cannot target your own, and a free agent needs a bid
  // rather than an advertisement. Targeting anyone else happens from that
  // player's own file, which passes initialPlayerId.
  const pool = useMemo(() => {
    const rows: { id: string; name: string; position: string | null; club: string | null; owner: string }[] = [];
    if (fixedPlayer) {
      return [{ ...fixedPlayer, owner: fixedPlayer.owner ?? 'A club' }];
    }
    if (!model) return rows;
    for (const [teamId, roster] of Object.entries(model.allRosters)) {
      if (teamId === model.myTeam.id) continue;
      const ownerName = model.allTeams.find((t) => t.id === teamId)?.team_name ?? 'A club';
      for (const p of roster) {
        rows.push({
          id: p.id,
          name: getPlayerDisplayName(p, 'full'),
          position: p.primary_position ?? null,
          club: p.pl_team ?? null,
          owner: ownerName,
        });
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [model, fixedPlayer]);

  const [kind, setKind] = useState<'player' | 'profile'>(
    target?.target_kind ?? (initialPlayerId ? 'player' : 'player'),
  );
  const [playerId, setPlayerId] = useState<string>(
    target?.player_id ?? initialPlayerId ?? fixedPlayer?.id ?? '',
  );
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<GranularPosition | ''>(
    (target?.position as GranularPosition | null) ?? '',
  );
  const [role, setRole] = useState<TargetRole>(target?.role ?? 'starter');
  const [audience, setAudience] = useState<Audience>(
    (target?.visibility as Audience | undefined) ?? 'direct',
  );
  const [payCash, setPayCash] = useState(target ? target.open_to_sale : true);
  const [offerPlayers, setOfferPlayers] = useState(target ? target.open_to_trade : false);
  const [takeLoan, setTakeLoan] = useState(target ? target.open_to_loan : false);
  const [budget, setBudget] = useState<string>(
    target?.budget != null && target.budget > 0 ? String(target.budget) : '',
  );
  const [note, setNote] = useState(target?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = playerId ? pool.find((p) => p.id === playerId) ?? null : null;
  const ownerName = selected?.owner ?? null;

  // A role has no owner to approach. Fall off that rung rather than posting a
  // 'direct' the route would refuse.
  useEffect(() => {
    if (kind === 'profile' && audience === 'direct') setAudience('public');
  }, [kind, audience]);

  const filtered = useMemo(() => {
    const q = fold(query);
    const rows = q
      ? pool.filter((p) => fold(`${p.name} ${p.club ?? ''} ${p.owner}`).includes(q))
      : pool;
    // The <select> is a picker, not a table — a full league's rosters is ~200
    // rows, which is fine to render, but the search is what makes it usable.
    return rows.slice(0, 200);
  }, [pool, query]);

  const noteLeft = TARGET_NOTE_MAX - note.length;
  const budgetValue = budget.trim() === '' ? null : Number(budget);
  const budgetBad = budgetValue != null && (!Number.isInteger(budgetValue) || budgetValue < 0);

  const canSave =
    !busy &&
    !budgetBad &&
    noteLeft >= 0 &&
    (kind === 'player' ? !!playerId : !!position);

  async function save() {
    setError(null);
    setBusy(true);

    const payload = {
      targetKind: kind,
      playerId: kind === 'player' ? playerId : null,
      position: kind === 'profile' ? position : null,
      role: kind === 'profile' ? role : null,
      visibility: audience,
      openToSale: payCash,
      openToTrade: offerPlayers,
      openToLoan: takeLoan,
      budget: budgetValue,
      note: note.trim() || null,
    };

    try {
      const res = await fetch(
        editing
          ? `/api/leagues/${leagueId}/targets/${target!.id}`
          : `/api/leagues/${leagueId}/targets`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The kind and the player never change on an edit; the route refuses
          // both, so they are not sent.
          body: JSON.stringify(editing ? { ...payload, targetKind: undefined, playerId: undefined } : payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'That target was not accepted.');
        setBusy(false);
        return;
      }
      onDone();
      onClose();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!editing) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/targets/${target!.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'That target could not be withdrawn.');
        setBusy(false);
        return;
      }
      onDone();
      onClose();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const audienceOptions: { key: Audience; name: string; hint: string; disabled?: boolean }[] = [
    {
      key: 'private',
      name: 'Only You',
      hint: kind === 'player'
        ? 'Nobody sees this and nobody is told. You still get an alert when he becomes gettable.'
        : `Nobody sees this. You still get an alert when ${roleArticle(position || null)} becomes gettable.`,
    },
    {
      key: 'direct',
      name: ownerName ? `Only ${ownerName}` : 'Only the club that owns him',
      hint: 'Only the club that owns him is told. Nobody else sees it.',
      disabled: kind !== 'player',
    },
    {
      key: 'public',
      name: 'Visible to the League',
      hint: kind === 'player' && ownerName
        ? `Your club is named on the board beside him, and ${ownerName} are told.`
        : 'Your club is named on the board beside it.',
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Target' : 'Add a Target'}
      footer={
        <>
          {editing && (
            <button type="button" className={styles.danger} onClick={withdraw} disabled={busy}>
              Withdraw
            </button>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={styles.go} onClick={save} disabled={!canSave}>
            {editing ? 'Save Target' : 'Post Target'}
          </button>
        </>
      }
    >
      {error && <p className={styles.error}>{error}</p>}

      {!fixedPlayer && (
      <div className={styles.section}>
        <span className={styles.label}>What you&rsquo;re after</span>
        <div className={styles.seg}>
          <button
            type="button"
            className={`${styles.segBtn} ${kind === 'player' ? styles.segOn : ''}`}
            onClick={() => setKind('player')}
            disabled={editing}
          >
            A Specific Player
          </button>
          <button
            type="button"
            className={`${styles.segBtn} ${kind === 'profile' ? styles.segOn : ''}`}
            onClick={() => setKind('profile')}
            disabled={editing}
          >
            A Position
          </button>
        </div>
        {editing && (
          <p className={styles.hint}>
            The kind is fixed once a target is posted. Withdraw it and post a new one to change it.
          </p>
        )}
      </div>
      )}

      {kind === 'player' ? (
        <div className={styles.section}>
          <span className={styles.label}>Player</span>
          {!editing && !fixedPlayer && (
            <input
              className={styles.search}
              placeholder="Search by player, club or manager…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players"
            />
          )}
          {!fixedPlayer && (
            <select
              className={styles.select}
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              disabled={editing}
              aria-label="Player to target"
            >
              <option value="">Pick a player…</option>
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.position ?? '—'} · {p.owner}
                </option>
              ))}
            </select>
          )}
          {selected && (
            <div className={styles.identity}>
              <PositionBadge position={selected.position} size="sm" />
              <span className={styles.identityName}>{selected.name}</span>
              <span className={styles.identityMeta}>
                {[selected.club, `${selected.owner} own him`].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={styles.section}>
            <span className={styles.label}>Position</span>
            <div className={styles.posGrid}>
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.posOpt} ${position === p ? styles.posOptOn : ''}`}
                  style={position === p ? {
                    ['--pos-field' as string]: `var(--color-pos-${p.toLowerCase()})`,
                    ['--pos-ink' as string]: `var(--color-pos-${p.toLowerCase()}-on)`,
                    ['--pos-line' as string]: `var(--color-pos-${p.toLowerCase()}-line)`,
                  } : undefined}
                  onClick={() => setPosition(p)}
                  aria-pressed={position === p}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.label}>Level</span>
            <div className={styles.optList}>
              {TARGET_ROLE_OPTIONS.map((o) => (
                <button
                  key={o.role}
                  type="button"
                  className={`${styles.opt} ${role === o.role ? styles.optOn : ''}`}
                  onClick={() => setRole(o.role)}
                  aria-pressed={role === o.role}
                >
                  <span className={`${styles.radio} ${role === o.role ? styles.radioOn : ''}`} />
                  <span className={styles.optText}>
                    <span className={styles.optName}>{o.label}</span>
                    <span className={styles.optHint}>{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className={styles.hint}>
              Say whether you want a first-choice player or squad depth. A position on its own
              doesn&rsquo;t tell a seller which of his players you mean.
            </p>
          </div>
        </>
      )}

      <div className={styles.section}>
        <span className={styles.label}>Who gets told</span>
        <div className={styles.optList}>
          {audienceOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`${styles.opt} ${audience === o.key ? styles.optOn : ''}`}
              onClick={() => setAudience(o.key)}
              disabled={o.disabled}
              aria-pressed={audience === o.key}
            >
              <span className={`${styles.radio} ${audience === o.key ? styles.radioOn : ''}`} />
              <span className={styles.optText}>
                <span className={styles.optName}>{o.name}</span>
                <span className={styles.optHint}>{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
        {kind === 'profile' && (
          <p className={styles.hint}>
            A position has no owner, so you can&rsquo;t approach anybody privately. Name a player to
            get that option.
          </p>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.label}>What you&rsquo;d give</span>
        <div className={styles.checks}>
          <label className={styles.check}>
            <input type="checkbox" checked={payCash} onChange={(e) => setPayCash(e.target.checked)} />
            <span className={`${styles.box} ${payCash ? styles.boxOn : ''}`}><Tick /></span>
            Pay Cash
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={offerPlayers} onChange={(e) => setOfferPlayers(e.target.checked)} />
            <span className={`${styles.box} ${offerPlayers ? styles.boxOn : ''}`}><Tick /></span>
            Offer Players
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={takeLoan} onChange={(e) => setTakeLoan(e.target.checked)} />
            <span className={`${styles.box} ${takeLoan ? styles.boxOn : ''}`}><Tick /></span>
            Take Him on Loan
          </label>
        </div>
        <p className={styles.hint}>
          Tick everything you&rsquo;d consider, or nothing at all. Both read as open to whatever
          somebody brings you.
        </p>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Budget</span>
        <input
          className={styles.money}
          inputMode="numeric"
          placeholder="€—"
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
          aria-label="Budget in millions"
        />
        <p className={styles.hint}>
          Optional. Other clubs read it as a starting point, not a limit.
          {model && ` Your Club Balance is €${model.myTeam.faab_budget}m.`}
        </p>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Note</span>
        <textarea
          className={styles.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional. What you'd move to get him, or when you need him by."
          aria-label="Note"
        />
        <div className={`${styles.counter} ${noteLeft < 0 ? styles.counterOver : ''}`}>
          {noteLeft} left
        </div>
      </div>
    </Modal>
  );
}
