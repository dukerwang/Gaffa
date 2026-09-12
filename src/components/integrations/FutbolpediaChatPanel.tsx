'use client';

import { useEffect, useId, useRef, useState } from 'react';
import FormattedText from '@/components/ui/FormattedText';
import styles from './FutbolpediaChatPanel.module.css';

type Role = 'user' | 'ai';

export type FutbolpediaChatTurn = {
  id: string;
  sender: Role;
  content: string;
  scorecard?: FutbolpediaScorecard | null;
};

export type FutbolpediaScorecard = {
  outgoing: string;
  incoming: string;
  incoming_cash_eur_m: number;
  outgoing_club: string;
  incoming_club: string;
  replacement: number;
  coverage: number;
  cash_deployable: number;
  starter_leverage: number;
  verdict: string;
  confidence: string;
  what_would_flip?: string;
};

interface Props {
  leagueId: string;
  teamId: string;
  clubName: string;
  /** Match the host composer: overlay widget vs full chat page. */
  variant?: 'overlay' | 'page';
  active?: boolean;
}

const VERDICT_LABEL: Record<string, string> = {
  hold: 'Hold',
  lean_hold: 'Lean Hold',
  toss_up: 'Toss-Up',
  lean_take: 'Lean Take',
  take: 'Take',
};

function newId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function FutbolpediaChatPanel({
  leagueId,
  teamId,
  clubName,
  variant = 'overlay',
  active = true,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<FutbolpediaChatTurn[]>([]);

  useEffect(() => {
    if (!active) return;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [active, turns, sending]);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [active]);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setError(null);
    const userTurn: FutbolpediaChatTurn = { id: newId(), sender: 'user', content: message };
    const prior = turns.map((t) => ({ sender: t.sender, content: t.content }));
    setTurns((prev) => [...prev, userTurn]);
    setSending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/clubs/${teamId}/futbolpedia-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          speed: 'fast',
          history: prior,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `Chat failed (${res.status})`);
      }
      const prose = typeof data?.prose === 'string' ? data.prose.trim() : '';
      if (!prose) {
        throw new Error('Futbolpedia returned an empty reply');
      }
      setTurns((prev) => [
        ...prev,
        {
          id: newId(),
          sender: 'ai',
          content: prose,
          scorecard: data?.scorecard ?? null,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className={`${styles.embedded} ${variant === 'page' ? styles.page : styles.overlay}`}>
      <div className={styles.body}>
        {turns.length === 0 && !sending && (
          <p className={styles.empty}>
            Ask about {clubName} — rules, trades, or squad shape.
          </p>
        )}
        {turns.map((t) => (
          <article
            key={t.id}
            className={t.sender === 'user' ? styles.bubbleUser : styles.bubbleAi}
          >
            <span className={styles.bubbleWho}>{t.sender === 'user' ? 'You' : 'Futbolpedia'}</span>
            {t.scorecard ? <LockLine card={t.scorecard} /> : null}
            <div className={styles.bubbleText}>
              <FormattedText text={t.content} />
            </div>
          </article>
        ))}
        {sending && <p className={styles.pending}>Gaffa briefing…</p>}
        {error && <p className={styles.error}>{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className={styles.srOnly} htmlFor={inputId}>
          Ask Futbolpedia
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          className={styles.input}
          rows={1}
          value={draft}
          disabled={sending}
          placeholder="Ask about this club"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className={styles.send} disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
      <p className={styles.stub}>You can&apos;t set lineups, bids, or trades from here.</p>
    </div>
  );
}

function LockLine({ card }: { card: FutbolpediaScorecard }) {
  const cash = card.incoming_cash_eur_m > 0 ? ` + €${card.incoming_cash_eur_m}m` : '';
  const verdict = VERDICT_LABEL[card.verdict] ?? card.verdict;
  return (
    <div className={styles.lock}>
      <div className={styles.lockHead}>
        <span className={styles.lockKicker}>Trade Lock</span>
        <span className={styles.lockVerdict}>
          {verdict}
          <span className={styles.lockConf}>{card.confidence} confidence</span>
        </span>
      </div>
      <p className={styles.lockDeal}>
        {card.outgoing} ({card.outgoing_club}) → {card.incoming} ({card.incoming_club}){cash}
      </p>
      <p className={styles.lockScores}>
        Replacement {card.replacement} · Coverage {card.coverage} · Cash {card.cash_deployable} ·
        Leverage {card.starter_leverage}
      </p>
    </div>
  );
}
