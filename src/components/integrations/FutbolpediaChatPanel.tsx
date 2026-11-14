'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  futbolpediaCardUrl,
  futbolpediaClubUrl,
  futbolpediaPublicOrigin,
  type FutbolpediaCard,
} from '@/lib/integrations/futbolpediaLinks';
import { readFutbolpediaReply, type FutbolpediaScorecard } from '@/lib/integrations/futbolpediaStream';
import { FutbolpediaMark } from './futbolpediaBrand';
import { fpFontVars } from './futbolpediaFonts';
import FutbolpediaProse from './FutbolpediaProse';
import styles from './FutbolpediaChatPanel.module.css';

type Role = 'user' | 'ai';

export type FutbolpediaChatTurn = {
  id: string;
  sender: Role;
  content: string;
  scorecard?: FutbolpediaScorecard | null;
  cards?: FutbolpediaCard[];
  continueSuggested?: boolean;
  streaming?: boolean;
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

/** Below this many questions left today, the panel says how many remain. */
const TURNS_NOTICE_AT = 3;

function newId(prefix = 'm'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}${Date.now().toString(36)}${random}`;
}

/**
 * Futbolpedia inside Gaffa's league chat. Futbolpedia is a separate product, so the panel wears
 * its type and colours. Each question runs Futbolpedia's full chat with this club attached and
 * streams in; cards it draws on link to Futbolpedia, and Continue in Futbolpedia carries the
 * thread there (also the way on once the day's questions here are used up).
 */
export default function FutbolpediaChatPanel({
  leagueId,
  teamId,
  clubName,
  variant = 'overlay',
  active = true,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conversationId = useRef(newId('g'));
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<FutbolpediaChatTurn[]>([]);
  const [turnsLeft, setTurnsLeft] = useState<number | null>(null);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (!active) return;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [active, turns, sending]);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [active]);

  const outOfTurns = turnsLeft === 0;
  const hasReply = turns.some((t) => t.sender === 'ai' && t.content.trim());

  const updateTurn = (id: string, patch: Partial<FutbolpediaChatTurn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function send() {
    const message = draft.trim();
    if (!message || sending || outOfTurns) return;
    setDraft('');
    setError(null);
    setStage(null);
    const prior = turns.filter((t) => t.content.trim()).map((t) => ({ sender: t.sender, content: t.content }));
    const replyId = newId();
    const questionId = newId();
    setTurns((prev) => [
      ...prev,
      { id: questionId, sender: 'user', content: message },
      { id: replyId, sender: 'ai', content: '', streaming: true },
    ]);
    setSending(true);
    let answered = false;
    try {
      const res = await fetch(`/api/leagues/${leagueId}/clubs/${teamId}/futbolpedia-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: prior, conversationId: conversationId.current }),
      });
      await readFutbolpediaReply(res, (event) => {
        if (event.type === 'stage') setStage(event.label);
        else if (event.type === 'text') updateTurn(replyId, { content: event.text });
        else if (event.type === 'scorecard') updateTurn(replyId, { scorecard: event.scorecard });
        else if (event.type === 'done') {
          answered = Boolean(event.prose.trim());
          updateTurn(replyId, {
            content: event.prose,
            scorecard: event.scorecard ?? undefined,
            cards: event.cards,
            continueSuggested: event.continueSuggested,
            streaming: false,
          });
          if (event.turnsLeft != null) setTurnsLeft(event.turnsLeft);
        } else if (event.type === 'error') {
          if (event.turnsLeft != null) setTurnsLeft(event.turnsLeft);
          setError(event.message);
        }
      });
      if (!answered) setError((e) => e ?? 'Futbolpedia stopped before finishing. Try again.');
    } catch {
      setError('Could not reach Futbolpedia');
    } finally {
      // A question that got no full answer leaves the thread with any partial reply (neither is
      // sent back as history) and goes back in the box to try again.
      if (!answered) {
        setTurns((prev) => prev.filter((t) => t.id !== questionId && t.id !== replyId));
        setDraft((d) => d || message);
      }
      updateTurn(replyId, { streaming: false });
      setSending(false);
      setStage(null);
      inputRef.current?.focus();
    }
  }

  /** Carries the thread to Futbolpedia as a shared conversation with this club attached. */
  async function continueInFutbolpedia() {
    if (continuing) return;
    if (!hasReply) {
      window.open(futbolpediaClubUrl(leagueId, teamId), '_blank', 'noopener');
      return;
    }
    // Opened inside the click, so the browser doesn't block it; pointed at the thread once it exists.
    const win = window.open('', '_blank');
    setContinuing(true);
    setError(null);
    try {
      const history = turns.filter((t) => t.content.trim()).map((t) => ({ sender: t.sender, content: t.content }));
      const res = await fetch(`/api/leagues/${leagueId}/clubs/${teamId}/futbolpedia-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.path !== 'string' || !data.path.startsWith('/#/c/')) {
        throw new Error(data?.error || 'Could not open Futbolpedia');
      }
      const url = `${futbolpediaPublicOrigin()}${data.path}`;
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : 'Could not open Futbolpedia');
    } finally {
      setContinuing(false);
    }
  }

  return (
    <div className={`${fpFontVars} ${styles.embedded} ${variant === 'page' ? styles.page : styles.overlay}`}>
      <div className={styles.brand}>
        <FutbolpediaMark size={26} />
        <div className={styles.brandText}>
          <span className={styles.brandName}>Futbolpedia</span>
          <span className={styles.brandLine}>Football analysis, with {clubName} in mind</span>
        </div>
        <button type="button" className={styles.brandAction} onClick={continueInFutbolpedia} disabled={continuing}>
          {hasReply ? 'Continue in Futbolpedia' : 'Open Futbolpedia'}
          <Icon name="external-link" size={13} strokeWidth={2} />
        </button>
      </div>

      <div className={styles.body}>
        {turns.length === 0 && !sending && (
          <div className={styles.empty}>
            <p className={styles.emptyLead}>Ask about {clubName}: your XI, a trade or the market.</p>
            <p className={styles.emptyNote}>
              Futbolpedia is a separate app, built on live Premier League data and its own scouting cards.
              You can carry any conversation over to{' '}
              <a href={futbolpediaPublicOrigin()} target="_blank" rel="noopener noreferrer">
                futbolpedia.ai.studio
              </a>
              .
            </p>
          </div>
        )}
        {turns.map((t) =>
          t.sender === 'user' ? (
            <article key={t.id} className={styles.user}>
              <div className={styles.userText}>{t.content}</div>
            </article>
          ) : (
            <article key={t.id} className={styles.ai}>
              <div className={styles.aiWho}>
                <FutbolpediaMark size={18} />
                <span>Futbolpedia</span>
              </div>
              {t.scorecard ? <LockLine card={t.scorecard} /> : null}
              {t.content ? (
                <div className={styles.aiText}>
                  <FutbolpediaProse text={t.content} />
                </div>
              ) : (
                <p className={styles.pending}>{stage ?? 'Reading your club…'}</p>
              )}
              {t.cards && t.cards.length > 0 && (
                <div className={styles.cards}>
                  {t.cards.map((c) => (
                    <a
                      key={c.slug}
                      className={styles.card}
                      href={futbolpediaCardUrl(c.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.cardName}>{c.name}</span>
                      <span className={styles.cardLabel}>{c.label}</span>
                      <Icon name="external-link" size={12} strokeWidth={2} />
                    </a>
                  ))}
                </div>
              )}
              {t.continueSuggested && !t.streaming && (
                <button type="button" className={styles.inlineContinue} onClick={continueInFutbolpedia} disabled={continuing}>
                  Rate Players in Futbolpedia
                  <Icon name="external-link" size={12} strokeWidth={2} />
                </button>
              )}
            </article>
          ),
        )}
        {error && <p className={styles.error}>{error}</p>}
        <div ref={endRef} />
      </div>

      {outOfTurns ? (
        <div className={styles.limit}>
          <p>You&apos;ve used today&apos;s Futbolpedia questions in Gaffa. Continue in Futbolpedia to keep going.</p>
          <button type="button" className={styles.limitAction} onClick={continueInFutbolpedia} disabled={continuing}>
            Continue in Futbolpedia
          </button>
        </div>
      ) : (
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
            placeholder={`Ask about ${clubName}`}
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
      )}
      <p className={styles.stub}>
        {turnsLeft != null && turnsLeft > 0 && turnsLeft <= TURNS_NOTICE_AT
          ? `${turnsLeft} ${turnsLeft === 1 ? 'question' : 'questions'} left today. `
          : ''}
        You can&apos;t set lineups, bids, or trades from here.
      </p>
    </div>
  );
}

function LockLine({ card }: { card: FutbolpediaScorecard }) {
  const cash = card.incoming_cash_eur_m > 0 ? ` + €${card.incoming_cash_eur_m}m` : '';
  const verdict = VERDICT_LABEL[card.verdict] ?? card.verdict;
  return (
    <div className={styles.lock}>
      <div className={styles.lockHead}>
        <span className={styles.lockName}>Trade Lock</span>
        <span className={styles.lockVerdict}>
          {verdict}
          <span className={styles.lockConf}>{card.confidence} confidence</span>
        </span>
      </div>
      <p className={styles.lockDeal}>
        {card.outgoing} ({card.outgoing_club}) → {card.incoming} ({card.incoming_club}){cash}
      </p>
      <p className={styles.lockScores}>
        Replacement {card.replacement} · Coverage {card.coverage} · Cash {card.cash_deployable} · Leverage{' '}
        {card.starter_leverage}
      </p>
    </div>
  );
}
