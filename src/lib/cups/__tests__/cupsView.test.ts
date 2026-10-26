import { describe, it, expect } from 'vitest';
import { buildCupsModel, dayLabel, roundShort, type CupsInput, type RoundRow, type TieRow } from '../cupsView';

// Matchday Militia on 2026-10-25 (MW8), seen as Not Too Xabi.
const CLUBS = {
  chelsz: 'ChelsZ FC', pizza: "Pizzaking's Club", spurs: 'tottenyang FC', xabi: 'Not Too Xabi', hayden: 'Hayden FC', tea: 'Tea FC',
};
const clubs = Object.fromEntries(Object.entries(CLUBS).map(([id, name]) => [id, { id, name, crest: null }]));

const round = (id: string, cup: string, name: string, n: number, start: number, end = start, drawn_at: string | null = null): RoundRow => ({
  id, tournament_id: cup, name, round_number: n, start_gameweek: start, end_gameweek: end, is_two_leg: start !== end, drawn_at,
});
const tie = (id: string, round_id: string, pos: number, a: string | null, b: string | null, extra: Partial<TieRow> = {}): TieRow => ({
  id, round_id, bracket_position: pos, team_a_id: a, team_b_id: b,
  team_a_score_leg1: 0, team_b_score_leg1: 0, team_a_score_leg2: 0, team_b_score_leg2: 0,
  winner_id: null, decided_by: null, next_matchup_id: null, status: 'pending', ...extra,
});

function militia(over: Partial<CupsInput> = {}): CupsInput {
  return {
    leagueId: 'L',
    myTeamId: 'xabi',
    myCrest: { primaryColor: '#4338CA', secondaryColor: '#4338CA' } as any,
    clubs,
    clubCount: 6,
    cups: [
      { id: 'cc', type: 'primary_cup', name: 'Champions Cup', status: 'active' },
      { id: 'lc', type: 'secondary_cup', name: 'League Cup', status: 'active' },
      { id: 'con', type: 'consolation_cup', name: 'Consolation Cup', status: 'active' },
    ],
    rounds: [
      round('cc-qf', 'cc', 'Quarter-Final', 1, 32, 33),
      round('cc-sf', 'cc', 'Semi-Final', 2, 34, 35),
      round('cc-f', 'cc', 'Final', 3, 38),
      round('lc-qf', 'lc', 'Quarter-Final', 1, 16),
      round('lc-sf', 'lc', 'Semi-Final', 2, 21, 24),
      round('lc-f', 'lc', 'Final', 3, 31),
      round('con-sf', 'con', 'Semi-Final', 1, 36, 37),
      round('con-f', 'con', 'Final', 2, 38),
    ],
    ties: [
      tie('cq0', 'cc-qf', 0, 'chelsz', null, { status: 'completed', winner_id: 'chelsz', next_matchup_id: 'cs0' }),
      tie('cq1', 'cc-qf', 1, 'pizza', 'tea', { next_matchup_id: 'cs0' }),
      tie('cq2', 'cc-qf', 2, 'hayden', null, { status: 'completed', winner_id: 'hayden', next_matchup_id: 'cs1' }),
      tie('cq3', 'cc-qf', 3, 'xabi', 'spurs', { next_matchup_id: 'cs1' }),
      tie('cs0', 'cc-sf', 0, 'chelsz', null, { next_matchup_id: 'cf' }),
      tie('cs1', 'cc-sf', 1, 'hayden', null, { next_matchup_id: 'cf' }),
      tie('cf', 'cc-f', 0, null, null),
      tie('lq0', 'lc-qf', 0, 'chelsz', null, { status: 'completed', winner_id: 'chelsz' }),
      tie('lq1', 'lc-qf', 1, 'pizza', 'tea'),
      tie('lq2', 'lc-qf', 2, 'hayden', null, { status: 'completed', winner_id: 'hayden' }),
      tie('lq3', 'lc-qf', 3, 'xabi', 'spurs'),
      tie('ls0', 'lc-sf', 0, null, null),
      tie('ls1', 'lc-sf', 1, null, null),
      tie('lf', 'lc-f', 0, null, null),
      tie('ks0', 'con-sf', 0, null, null, { next_matchup_id: 'kf' }),
      tie('ks1', 'con-sf', 1, null, null, { next_matchup_id: 'kf' }),
      tie('kf', 'con-f', 0, null, null),
    ],
    deadlines: { 16: '2026-12-19T11:00:00Z', 21: '2027-01-16T13:30:00Z', 24: '2027-02-06T13:30:00Z', 31: '2027-04-10T12:30:00Z', 32: '2027-04-17T12:30:00Z' },
    currentGw: 8,
    currentGwFinished: false,
    liveScores: {},
    prizes: { secondary_cup: { winner: 25, runnerUp: 10 }, primary_cup: { winner: 50, runnerUp: 20 } },
    selectedCupId: null,
    ...over,
  };
}

const lineText = (l: { club: { name: string } | null; label: string | null; tag: string | null }) => `${l.club?.name ?? l.label}${l.tag ? ` (${l.tag})` : ''}`;

describe('helpers', () => {
  it('abbreviates rounds', () => {
    expect(['Quarter-Final', 'Semi-Final', 'Final', 'Round of 16'].map(roundShort)).toEqual(['QF', 'SF', 'Final', 'R16']);
  });
  it('dates a matchweek in UK time', () => {
    expect(dayLabel('2026-12-19T11:00:00Z')).toBe('Sat 19 Dec');
  });
});

describe('Matchday Militia today', () => {
  const m = buildCupsModel(militia());

  it('shows each cup with your status in it', () => {
    expect(m.shelf.map((s) => [s.short, s.status])).toEqual([
      ['Champions', 'QF · MW32'],
      ['League Cup', 'QF · MW16'],
      ['Consolation', 'From MW36'],
    ]);
    for (const s of m.shelf) expect(s.status.length).toBeLessThanOrEqual(12);
  });

  it('opens on the League Cup, your soonest tie', () => {
    expect(m.selected?.name).toBe('League Cup');
    expect(m.shelf.find((s) => s.selected)?.short).toBe('League Cup');
    expect(m.initialRound).toBe(0);
  });

  it('puts your tie in the Next Tie card', () => {
    expect(m.next).toMatchObject({ kind: 'tie', round: 'Quarter-Final', mw: 'MW16', when: 'Sat 19 Dec' });
    if (m.next?.kind !== 'tie') throw new Error();
    expect([m.next.tie.a.club?.name, m.next.tie.b.club?.name]).toEqual(['Not Too Xabi', 'tottenyang FC']);
  });

  it('shows byes as their own lines, not as ties against nobody', () => {
    const qf = m.rounds[0];
    const byes = qf.ties.filter((t) => t.bye);
    expect(byes.map((t) => lineText(t.a))).toEqual(['ChelsZ FC (Bye)', 'Hayden FC (Bye)']);
    expect(byes.every((t) => t.href === null)).toBe(true);
    expect(qf.ties.find((t) => t.mine)?.href).toBe('/league/L/tournaments/lq3');
  });

  it('shows the undrawn semi-final as the clubs through and the places to come', () => {
    const sf = m.rounds[1];
    expect(sf.ties.flatMap((t) => [lineText(t.a), lineText(t.b)])).toEqual([
      'ChelsZ FC (In)', 'Hayden FC (In)', "Pizzaking's Club or Tea FC", 'Not Too Xabi or tottenyang FC',
    ]);
    expect(sf.note).toBe('Drawn at random once the quarter-finals finish.');
    expect(sf.when).toBe('Two Legs · Sat 16 Jan & Sat 6 Feb');
    expect(sf.mw).toBe('MW21 · 24');
  });

  it('carries no seeds in the League Cup, and the prize on the final', () => {
    expect(m.rounds.flatMap((r) => r.ties).every((t) => t.a.seed === null && t.b.seed === null)).toBe(true);
    expect(m.rounds[2].prize).toEqual({ winner: 25, runnerUp: 10 });
    expect(m.rounds[0].prize).toBeNull();
  });
});

describe('the Champions Cup', () => {
  const m = buildCupsModel(militia({ selectedCupId: 'cc' }));

  it('is seeded, with the seed on each line', () => {
    expect(m.selected?.seeded).toBe(true);
    const mine = m.rounds[0].ties.find((t) => t.mine)!;
    expect([mine.a.seed, mine.b.seed]).toEqual([3, 6]);
  });

  it('names the place a bye club waits for in the semi-final', () => {
    const sf = m.rounds[1].ties;
    expect(sf.map((t) => `${lineText(t.a)} v ${lineText(t.b)}`)).toEqual([
      "ChelsZ FC v Pizzaking's Club or Tea FC",
      'Hayden FC v Not Too Xabi or tottenyang FC',
    ]);
  });
});

describe('statuses', () => {
  it('reads Bye to SF for a League Cup bye club', () => {
    const m = buildCupsModel(militia({ myTeamId: 'chelsz' }));
    expect(m.shelf[1].status).toBe('Bye to SF');
    expect(m.shelf[0].status).toBe('SF · MW34');
  });

  it('reads Out · QF once you lose, and shows the tie that put you out', () => {
    const input = militia({ currentGw: 17 });
    Object.assign(input.ties.find((t) => t.id === 'lq3')!, { status: 'completed', winner_id: 'spurs', team_a_score_leg1: 40, team_b_score_leg1: 52.5, decided_by: 'score' });
    const m = buildCupsModel({ ...input, selectedCupId: 'lc' });
    expect(m.shelf[1].status).toBe('Out · QF');
    expect(m.next).toMatchObject({ kind: 'out', round: 'Quarter-Final' });
    if (m.next?.kind !== 'out') throw new Error();
    expect([m.next.tie.a.score, m.next.tie.b.score, m.next.tie.b.won]).toEqual([40, 52.5, true]);
  });

  it('shows you through after a win, waiting for the draw', () => {
    const input = militia({ currentGw: 17 });
    Object.assign(input.ties.find((t) => t.id === 'lq3')!, { status: 'completed', winner_id: 'xabi', team_a_score_leg1: 61, team_b_score_leg1: 40, decided_by: 'score' });
    const m = buildCupsModel(input);
    expect(m.selected?.name).toBe('League Cup');
    expect(m.shelf[1].status).toBe('SF · MW21');
    expect(m.next).toEqual({ kind: 'through', bye: false, cupName: 'League Cup', round: 'Quarter-Final', next: 'Semi-Final', note: 'Drawn after MW16' });
    expect(m.initialRound).toBe(1);
  });

  it('reads Winner and Runner-Up after the final', () => {
    const input = militia({ currentGw: 32, myTeamId: 'xabi' });
    const f = input.ties.find((t) => t.id === 'lf')!;
    Object.assign(f, { team_a_id: 'xabi', team_b_id: 'hayden', status: 'completed', winner_id: 'xabi', decided_by: 'score' });
    expect(buildCupsModel(input).shelf[1].status).toBe('Winner');
    expect(buildCupsModel({ ...input, myTeamId: 'hayden' }).shelf[1].status).toBe('Runner-Up');
  });

  it('never treats a finished cup as your next tie', () => {
    const input = militia({ myTeamId: 'chelsz' });
    input.cups.find((c) => c.id === 'lc')!.status = 'completed';
    const m = buildCupsModel(input);
    expect(m.selected?.name).not.toBe('League Cup');
    expect(buildCupsModel({ ...input, selectedCupId: 'lc' }).next).toBeNull();
  });

  it('keeps a past season’s scores but not its dates', () => {
    const input = militia({ currentSeason: '2027-28' });
    input.cups.forEach((c) => { c.season = '2026-27'; });
    Object.assign(input.ties.find((t) => t.id === 'lq3')!, { status: 'completed', winner_id: 'xabi', team_a_score_leg1: 61, team_b_score_leg1: 40, decided_by: 'score' });
    const qf = buildCupsModel({ ...input, selectedCupId: 'lc' }).rounds[0];
    const mine = qf.ties.find((t) => t.mine)!;
    expect([mine.a.score, mine.b.score]).toEqual([61, 40]);
    expect(qf.when).toBe('');
  });

  it('reads Not Entered for a cup you are not in, in a larger league', () => {
    const m = buildCupsModel(militia({ myTeamId: 'nobody', clubCount: 8 }));
    expect(m.shelf.map((s) => s.status)).toEqual(['Not Entered', 'Not Entered', 'Not Entered']);
  });

  it('reads Drawn at MW7 before the first season has any cups', () => {
    const m = buildCupsModel(militia({ cups: [], rounds: [], ties: [] }));
    expect(m.shelf.map((s) => s.status)).toEqual(['Drawn at MW7', 'Drawn at MW7', 'Drawn at MW7']);
    expect(m.selected).toBeNull();
  });
});

describe('the Consolation Cup before its draw', () => {
  it('lists the Champions Cup losers in and the places to come', () => {
    const input = militia({ selectedCupId: 'con' });
    input.ties.find((t) => t.id === 'ks0')!.team_a_id = 'tea';
    const m = buildCupsModel(input);
    expect(m.rounds[0].ties.flatMap((t) => [lineText(t.a), lineText(t.b)])).toEqual([
      'Tea FC (In)', 'Champions Cup QF Loser', 'Champions Cup SF Loser', 'Champions Cup SF Loser',
    ]);
    expect(m.rounds[0].note).toBe('Drawn at random once the Champions Cup semi-finals finish.');
  });
});

describe('decided ties and live scores', () => {
  it('labels a level tie by how it went through', () => {
    const input = militia({ currentGw: 17 });
    Object.assign(input.ties.find((t) => t.id === 'lq1')!, { status: 'completed', winner_id: 'pizza', decided_by: 'position' });
    Object.assign(input.ties.find((t) => t.id === 'lq3')!, { status: 'completed', winner_id: 'xabi', decided_by: 'best_performer', team_a_score_leg1: 50, team_b_score_leg1: 50 });
    const qf = buildCupsModel(input).rounds[0].ties;
    expect(qf.find((t) => t.id === 'lq1')!.decidedLabel).toBe('Seeding');
    expect(qf.find((t) => t.id === 'lq3')!.decidedLabel).toBe('Best Performer');

    const drawn = militia({ currentGw: 22 });
    drawn.rounds.find((r) => r.id === 'lc-sf')!.drawn_at = '2026-12-21T00:00:00Z';
    Object.assign(drawn.ties.find((t) => t.id === 'ls0')!, { team_a_id: 'chelsz', team_b_id: 'xabi', status: 'completed', winner_id: 'chelsz', decided_by: 'position' });
    expect(buildCupsModel({ ...drawn, selectedCupId: 'lc' }).rounds[1].ties[0].decidedLabel).toBe('League Position');
  });

  it('reads a live tie from the clubs’ league scores', () => {
    const m = buildCupsModel(militia({ currentGw: 16, liveScores: { xabi: 31.4, spurs: 22.05 } }));
    const mine = m.rounds[0].ties.find((t) => t.mine)!;
    expect(mine.state).toBe('live');
    expect([mine.a.score, mine.b.score]).toEqual([31.4, 22.05]);
    expect(m.rounds[0].live).toBe(true);
  });
});
