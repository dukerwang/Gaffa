'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './expansion.module.css';

export interface ExpansionPlayer {
  id: string;
  name: string;
  position: string;
  club: string | null;
  marketValue: number;
  /** Academy or loan: can't be taken, so needs no protection. */
  exempt: boolean;
}

export interface ExpansionModel {
  leagueId: string;
  leagueName: string;
  canOpen: boolean;
  isCommissioner: boolean;
  myTeamId: string | null;
  expansion: null | {
    id: string;
    status: 'protecting' | 'drafting' | 'complete' | 'cancelled';
    newClubs: number;
    protectCount: number;
    perClubCap: number;
    protectionDeadline: string | null;
    clubs: { teamId: string; teamName: string }[];
    isNewClub: boolean;
    onClock: string | null;
    onClockName: string | null;
    myTurn: boolean;
    mySquad: ExpansionPlayer[];
    myProtected: string[];
    exposedByClub: { teamId: string; teamName: string; lost: number; players: ExpansionPlayer[] }[];
    freeAgents: ExpansionPlayer[];
    picks: { number: number; teamName: string; playerName: string; from: string | null; automatic: boolean }[];
  };
}

const money = (n: number) => `€${n}m`;

export default function ExpansionClient({ model }: { model: ExpansionModel }) {
  const router = useRouter();
  const exp = model.expansion;
  const base = `/api/leagues/${model.leagueId}/expansion`;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [newClubs, setNewClubs] = useState(1);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(exp?.myProtected ?? []));
  const [faQuery, setFaQuery] = useState('');

  const canPick = exp?.status === 'drafting' && (exp.myTurn || model.isCommissioner);

  async function call(key: string, url: string, init: RequestInit, ok?: string) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? 'Something went wrong.' });
        return;
      }
      if (ok) setMessage({ ok: true, text: ok });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  const pick = (playerId: string | null) =>
    call(`pick-${playerId ?? 'auto'}`, `${base}/pick`, { method: 'POST', body: JSON.stringify({ playerId }) });

  const faShown = useMemo(() => {
    const q = faQuery.trim().toLowerCase();
    const list = exp?.freeAgents ?? [];
    return (q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.club ?? '').toLowerCase().includes(q)) : list).slice(0, 40);
  }, [exp?.freeAgents, faQuery]);

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (exp && next.size < exp.protectCount) next.add(id);
      return next;
    });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Expansion Draft</h1>

      {!exp || exp.status === 'complete' ? (
        <section className={styles.section}>
          {exp?.status === 'complete' && (
            <p className={styles.lead}>The last expansion draft is complete, and the season&apos;s fixtures and cups include the new clubs.</p>
          )}
          {model.canOpen ? (
            <div className={styles.panel}>
              <div className={styles.form}>
                <label className={styles.fieldLabel} htmlFor="new-clubs">New Clubs</label>
                <select id="new-clubs" className={styles.select} value={newClubs} onChange={(e) => setNewClubs(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <p className={styles.hint}>
                  Each club protects 8 players; academy and loan players are safe anyway. New clubs then take turns
                  picking from everyone else and from the free agents, no more than 2 from any one club. A new club
                  starts with the league&apos;s median Club Balance. Share the invite code with the new managers.
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy !== null}
                    onClick={() => call('open', base, { method: 'POST', body: JSON.stringify({ newClubs }) }, 'Expansion draft opened.')}
                  >
                    {busy === 'open' ? 'Opening…' : 'Open Expansion Draft'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            !exp && (
              <p className={styles.lead}>
                {model.isCommissioner
                  ? 'A dynasty league can add clubs in the offseason, after the reset and before Kickoff.'
                  : 'No expansion draft is running.'}
              </p>
            )
          )}
        </section>
      ) : (
        <>
          <section className={styles.section}>
            <p className={styles.lead}>
              {exp.status === 'protecting'
                ? `${model.leagueName} is adding ${exp.newClubs === 1 ? 'a new club' : `${exp.newClubs} new clubs`}. Clubs are choosing who to protect.`
                : exp.onClockName
                  ? `${exp.onClockName} is on the clock.`
                  : 'Every new club is full.'}
            </p>
            <div className={styles.chips}>
              {exp.clubs.length === 0 && <span className={styles.chip}>Waiting for new managers to join</span>}
              {exp.clubs.map((c) => (
                <span key={c.teamId} className={`${styles.chip} ${c.teamId === exp.onClock ? styles.chipOn : ''}`}>{c.teamName}</span>
              ))}
            </div>

            {model.isCommissioner && (
              <div className={styles.actions}>
                {exp.status === 'protecting' && (
                  <>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy !== null || exp.clubs.length === 0}
                      onClick={() => call('start', `${base}/start`, { method: 'POST' }, 'Picks have started.')}
                    >
                      {busy === 'start' ? 'Starting…' : 'Start Picks'}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm('Cancel the expansion draft? Any new club that joined is removed.')) {
                          call('cancel', base, { method: 'DELETE' }, 'Expansion draft cancelled.');
                        }
                      }}
                    >
                      Cancel Expansion
                    </button>
                  </>
                )}
                {exp.status === 'drafting' && exp.onClock && (
                  <button type="button" className={styles.secondary} disabled={busy !== null} onClick={() => pick(null)}>
                    {busy === 'pick-auto' ? 'Picking…' : `Auto-Pick for ${exp.onClockName ?? 'This Club'}`}
                  </button>
                )}
              </div>
            )}
            {message && <p className={message.ok ? styles.ok : styles.error}>{message.text}</p>}
          </section>

          {exp.status === 'protecting' && !exp.isNewClub && model.myTeamId && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Protect Your Squad</h2>
              <p className={styles.hint}>
                Choose up to {exp.protectCount}. If you don&apos;t choose, your most valuable players are protected when
                picks start. A new club can take at most {exp.perClubCap} of the rest.
              </p>
              <div className={styles.panel}>
                {exp.mySquad.map((p) => (
                  <label key={p.id} className={styles.row}>
                    <input
                      type="checkbox"
                      checked={p.exempt || chosen.has(p.id)}
                      disabled={p.exempt || (!chosen.has(p.id) && chosen.size >= exp.protectCount)}
                      onChange={() => toggle(p.id)}
                    />
                    <span className={styles.rowMain}>
                      <span className={styles.rowLabel}>{p.name}</span>
                      <span className={styles.rowMeta}>{p.position} · {p.club ?? '—'} · {money(p.marketValue)}{p.exempt ? ' · safe (academy or loan)' : ''}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy !== null}
                  onClick={() => call('protect', `${base}/protect`, { method: 'POST', body: JSON.stringify({ playerIds: [...chosen] }) }, 'Protections saved.')}
                >
                  {busy === 'protect' ? 'Saving…' : `Save Protections (${chosen.size}/${exp.protectCount})`}
                </button>
              </div>
            </section>
          )}

          {exp.status === 'protecting' && exp.isNewClub && (
            <section className={styles.section}>
              <p className={styles.hint}>
                Your club builds its squad here once the commissioner starts the picks. You&apos;ll take turns with the
                other new clubs until your squad is full.
              </p>
            </section>
          )}

          {exp.status === 'drafting' && (
            <>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Exposed Players</h2>
                <p className={styles.hint}>No club loses more than {exp.perClubCap}.</p>
                {exp.exposedByClub.map((club) => {
                  const capped = club.lost >= exp.perClubCap;
                  return (
                    <div key={club.teamId} className={styles.club}>
                      <div className={styles.clubHead}>
                        <span>{club.teamName}</span>
                        <span className={styles.rowMeta}>{club.lost} of {exp.perClubCap} taken</span>
                      </div>
                      {!capped && (
                        <div className={styles.panel}>
                          {club.players.slice(0, 12).map((p) => (
                            <div key={p.id} className={styles.row}>
                              <span className={styles.rowMain}>
                                <span className={styles.rowLabel}>{p.name}</span>
                                <span className={styles.rowMeta}>{p.position} · {p.club ?? '—'} · {money(p.marketValue)}</span>
                              </span>
                              {canPick && (
                                <button type="button" className={styles.pickBtn} disabled={busy !== null} onClick={() => pick(p.id)}>
                                  Pick
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Free Agents</h2>
                <input
                  className={styles.search}
                  placeholder="Search by name or club"
                  value={faQuery}
                  onChange={(e) => setFaQuery(e.target.value)}
                />
                <div className={styles.panel}>
                  {faShown.map((p) => (
                    <div key={p.id} className={styles.row}>
                      <span className={styles.rowMain}>
                        <span className={styles.rowLabel}>{p.name}</span>
                        <span className={styles.rowMeta}>{p.position} · {p.club ?? '—'} · {money(p.marketValue)}</span>
                      </span>
                      {canPick && (
                        <button type="button" className={styles.pickBtn} disabled={busy !== null} onClick={() => pick(p.id)}>
                          Pick
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {exp && exp.picks.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Picks</h2>
          <div className={styles.panel}>
            {exp.picks.map((p) => (
              <div key={p.number} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowLabel}>{p.number}. {p.playerName}</span>
                  <span className={styles.rowMeta}>
                    {p.teamName} · {p.from ? `from ${p.from}` : 'free agent'}{p.automatic ? ' · auto-pick' : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
