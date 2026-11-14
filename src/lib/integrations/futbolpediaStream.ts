import type { FutbolpediaCard } from './futbolpediaLinks';

/** Futbolpedia's trade scorecard, shown above a trade reply. */
export interface FutbolpediaScorecard {
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
}

export interface FutbolpediaDone {
  prose: string;
  scorecard: FutbolpediaScorecard | null;
  cards: FutbolpediaCard[];
  turnsLeft: number | null;
  continueSuggested: boolean;
}

/** The events Futbolpedia streams for one turn (`/api/gaffa/chat` with `stream: true`). */
export type FutbolpediaEvent =
  | { type: 'stage'; label: string }
  | { type: 'text'; text: string }
  | { type: 'scorecard'; scorecard: FutbolpediaScorecard }
  | ({ type: 'done' } & FutbolpediaDone)
  | { type: 'error'; message: string; status: number; turnsLeft?: number };

/** Splits complete lines off a buffer of newline-delimited JSON; the unfinished tail is kept. */
export function takeEvents(buffer: string): { events: FutbolpediaEvent[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events: FutbolpediaEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.type === 'string') events.push(parsed as FutbolpediaEvent);
    } catch {
      /* a malformed line is skipped, never fatal */
    }
  }
  return { events, rest };
}

/** A reply in Futbolpedia's older single-JSON shape, read as a finished turn. */
export function doneFromJson(data: Record<string, unknown>): FutbolpediaEvent {
  if (typeof data.error === 'string') {
    return { type: 'error', message: data.error, status: 502, turnsLeft: typeof data.turnsLeft === 'number' ? data.turnsLeft : undefined };
  }
  return {
    type: 'done',
    prose: typeof data.prose === 'string' ? data.prose : '',
    scorecard: (data.scorecard as FutbolpediaScorecard | null) ?? null,
    cards: Array.isArray(data.cards) ? (data.cards as FutbolpediaCard[]) : [],
    turnsLeft: typeof data.turnsLeft === 'number' ? data.turnsLeft : null,
    continueSuggested: data.continueSuggested === true,
  };
}

/**
 * Reads a panel response to the end, handing each event to `onEvent`: a stream line by line, or
 * a single JSON reply (a Futbolpedia that doesn't stream yet, or an error before streaming began).
 */
export async function readFutbolpediaReply(res: Response, onEvent: (event: FutbolpediaEvent) => void): Promise<void> {
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.includes('application/json')) {
    const data = await res.json().catch(() => ({}));
    const event = doneFromJson(data as Record<string, unknown>);
    onEvent(!res.ok && event.type === 'done' ? { type: 'error', message: `Futbolpedia error (${res.status})`, status: res.status } : event);
    return;
  }
  if (!res.body) {
    onEvent({ type: 'error', message: 'Futbolpedia sent nothing back', status: 502 });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = takeEvents(buffer);
    buffer = rest;
    events.forEach(onEvent);
  }
  takeEvents(`${buffer}\n`).events.forEach(onEvent);
}
