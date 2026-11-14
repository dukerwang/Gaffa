import { describe, expect, it } from 'vitest';
import { doneFromJson, readFutbolpediaReply, takeEvents, type FutbolpediaEvent } from '../futbolpediaStream';
import { futbolpediaCardUrl, futbolpediaClubUrl, futbolpediaScoutUrl } from '../futbolpediaLinks';

const LEAGUE = '11111111-1111-4111-8111-111111111111';
const CLUB = '22222222-2222-4222-8222-222222222222';

function streamOf(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

async function eventsOf(res: Response): Promise<FutbolpediaEvent[]> {
  const out: FutbolpediaEvent[] = [];
  await readFutbolpediaReply(res, (e) => out.push(e));
  return out;
}

describe('takeEvents', () => {
  it('splits complete lines, keeps the unfinished tail and skips malformed ones', () => {
    const { events, rest } = takeEvents('{"type":"stage","label":"a"}\nnot json\n{"type":"text","text":"Sa');
    expect(events).toEqual([{ type: 'stage', label: 'a' }]);
    expect(rest).toBe('{"type":"text","text":"Sa');
  });
});

describe('readFutbolpediaReply', () => {
  it('reads a stream whose lines are split across chunks', async () => {
    const events = await eventsOf(
      streamOf([
        '{"type":"stage","label":"Reading your Gaffa club..."}\n{"type":"te',
        'xt","text":"Saka"}\n',
        '{"type":"done","prose":"Saka starts.","scorecard":null,"cards":[],"turnsLeft":9,"continueSuggested":false}',
      ]),
    );
    expect(events.map((e) => e.type)).toEqual(['stage', 'text', 'done']);
    expect(events[2]).toMatchObject({ prose: 'Saka starts.', turnsLeft: 9 });
  });

  it('reads a single JSON reply from a Futbolpedia that does not stream yet', async () => {
    const res = new Response(JSON.stringify({ prose: 'Hold.', scorecard: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const [event] = await eventsOf(res);
    expect(event).toMatchObject({ type: 'done', prose: 'Hold.', cards: [], turnsLeft: null, continueSuggested: false });
  });

  it('turns a refusal into an error, keeping the turns left', async () => {
    const res = new Response(JSON.stringify({ error: 'Used up', turnsLeft: 0 }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
    const [event] = await eventsOf(res);
    expect(event).toEqual({ type: 'error', message: 'Used up', status: 502, turnsLeft: 0 });
    expect(doneFromJson({ prose: 'x', continueSuggested: true })).toMatchObject({ continueSuggested: true });
  });
});

describe('Futbolpedia links', () => {
  it('point at a card, at Scout with the name, and at a club conversation', () => {
    expect(futbolpediaCardUrl('bukayo-saka--current--2026-11-04')).toMatch(/\/#\/p\/bukayo-saka--current--2026-11-04$/);
    expect(futbolpediaScoutUrl('Cole Palmer')).toMatch(/\/#\/scout\?name=Cole\+Palmer$/);
    expect(futbolpediaClubUrl(LEAGUE, CLUB)).toMatch(new RegExp(`/#/gaffa/${LEAGUE}/${CLUB}$`));
    expect(futbolpediaClubUrl(LEAGUE, CLUB, 'Who starts?')).toMatch(/\?q=Who\+starts%3F$/);
  });
});
