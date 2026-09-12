'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import FormattedText from '@/components/ui/FormattedText';
import styles from './FutbolpediaChatDrawer.module.css';

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
  open: boolean;
  onClose: () => void;
  leagueId: string;
  teamId: string;
  clubName: string;
  leagueName: string;
  crestConfig: CrestConfig | null;
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

export default function FutbolpediaChatDrawer({
  open,
  onClose,
  leagueId,
  teamId,
  clubName,
  leagueName,
  crestConfig,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<FutbolpediaChatTurn[]>([]);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.futbolpediaChatOpen = 'true';
    panelRef.current?.focus();
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      delete document.body.dataset.futbolpediaChatOpen;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, turns, sending]);

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

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Futbolpedia chat for ${clubName}`}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <CrestBadge
            config={crestConfig ?? undefined}
            teamName={clubName}
            size={44}
            interactive={false}
          />
          <div className={styles.headTitles}>
            <h2 className={styles.headName}>Futbolpedia</h2>
            <p className={styles.headMeta}>
              {clubName}
              <span className={styles.dot}>·</span>
              {leagueName}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {turns.length === 0 && !sending && (
            <p className={styles.empty}>
              Ask about this club — rules, trades, or squad shape. You&apos;re signed in; no IDs to
              paste.
            </p>
          )}
          {turns.map((t) => (
            <article
              key={t.id}
              className={t.sender === 'user' ? styles.bubbleUser : styles.bubbleAi}
            >
              <span className={styles.bubbleWho}>{t.sender === 'user' ? 'You' : 'Futbolpedia'}</span>
              {t.scorecard ? <LockLine card={t.scorecard} /> : null}
              <p className={styles.bubbleText}>
                <FormattedText text={t.content} />
              </p>
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
          <label className={styles.srOnly} htmlFor="futbolpedia-chat-input">
            Ask Futbolpedia
          </label>
          <textarea
            id="futbolpedia-chat-input"
            ref={inputRef}
            className={styles.input}
            rows={2}
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
      </aside>
    </div>,
    document.body,
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
