import { describe, it, expect } from 'vitest';
import { demandLine, type DemandTarget } from '../demandLine';

const SELLER = 'team-seller';

const base = {
  open_to_sale: false,
  open_to_trade: false,
  open_to_loan: false,
  budget: null as number | null,
};

const namedTarget = (teamId: string, teamName: string, playerId: string, over: Partial<DemandTarget> = {}): DemandTarget => ({
  ...base, team_id: teamId, team_name: teamName,
  target_kind: 'player', player_id: playerId, position: null, ...over,
});

const profileTarget = (teamId: string, teamName: string, position: string, over: Partial<DemandTarget> = {}): DemandTarget => ({
  ...base, team_id: teamId, team_name: teamName,
  target_kind: 'profile', player_id: null, position, ...over,
});

const saliba = { id: 'p1', primary_position: 'CB', secondary_positions: ['LB'] };

describe('demandLine', () => {
  it('is null when nobody is asking', () => {
    expect(demandLine([], saliba, SELLER)).toBeNull();
  });

  it('names the single club that named him, with its budget', () => {
    const line = demandLine(
      [namedTarget('t1', 'Matchday Militia', 'p1', { open_to_sale: true, budget: 62 })],
      saliba,
      SELLER,
    );
    expect(line).toEqual({
      title: 'Matchday Militia want him',
      detail: "They'll pay cash, up to €62m",
      clubs: 1,
      named: true,
    });
  });

  it('counts clubs in words up to three', () => {
    const line = demandLine(
      [
        namedTarget('t1', 'A', 'p1', { open_to_sale: true }),
        namedTarget('t2', 'B', 'p1', { open_to_trade: true }),
      ],
      saliba,
      SELLER,
    );
    expect(line?.title).toBe('Two clubs want him');
    expect(line?.detail).toBe('One club will pay cash, one club is offering players');
  });

  it('switches to numerals past three', () => {
    const many = ['t1', 't2', 't3', 't4'].map((id, i) =>
      namedTarget(id, `Club ${i}`, 'p1', { open_to_sale: true }),
    );
    expect(demandLine(many, saliba, SELLER)?.title).toBe('4 clubs want him');
  });

  it('prefers a named target over a positional one', () => {
    const line = demandLine(
      [
        profileTarget('t1', 'A', 'CB', { open_to_sale: true }),
        namedTarget('t2', 'Vardy Party', 'p1', { open_to_trade: true }),
      ],
      saliba,
      SELLER,
    );
    expect(line?.named).toBe(true);
    expect(line?.title).toBe('Vardy Party want him');
  });

  it('falls back to the position, spoken as the player actually plays it', () => {
    const line = demandLine(
      [
        profileTarget('t1', 'A', 'CB', { open_to_sale: true }),
        profileTarget('t2', 'B', 'LB', { open_to_trade: true }),
      ],
      saliba,
      SELLER,
    );
    // He is a centre-back who also plays left-back — the line says centre-back.
    expect(line?.title).toBe('Two clubs are looking for a centre-back');
    expect(line?.named).toBe(false);
  });

  it('matches a profile on a secondary position when that is the only hit', () => {
    const line = demandLine([profileTarget('t1', 'A', 'LB', { open_to_sale: true })], saliba, SELLER);
    expect(line?.title).toBe('One club is looking for a left-back');
  });

  it('ignores a profile for a position he does not play', () => {
    expect(demandLine([profileTarget('t1', 'A', 'ST')], saliba, SELLER)).toBeNull();
  });

  it('never reports the holder to himself', () => {
    const own = namedTarget(SELLER, 'Me', 'p1', { open_to_sale: true });
    expect(demandLine([own], saliba, SELLER)).toBeNull();
  });

  it('counts one club once even when it holds several matching profiles', () => {
    const line = demandLine(
      [
        profileTarget('t1', 'A', 'CB', { open_to_sale: true }),
        profileTarget('t1', 'A', 'LB', { open_to_sale: true }),
      ],
      saliba,
      SELLER,
    );
    expect(line?.clubs).toBe(1);
    expect(line?.title).toBe('One club is looking for a centre-back');
  });

  it('reads a stated nothing as open to approaches', () => {
    const line = demandLine([namedTarget('t1', 'A', 'p1')], saliba, SELLER);
    expect(line?.detail).toBe('Open to approaches');
  });

  it('keeps a budget on an otherwise open stance', () => {
    const line = demandLine(
      [namedTarget('t1', 'A', 'p1', { open_to_sale: true, open_to_trade: true, budget: 40 })],
      saliba,
      SELLER,
    );
    expect(line?.detail).toBe('Open to approaches, up to €40m');
  });

  it('treats a budget of zero as unstated', () => {
    const line = demandLine(
      [namedTarget('t1', 'A', 'p1', { open_to_sale: true, budget: 0 })],
      saliba,
      SELLER,
    );
    expect(line?.detail).toBe("They'll pay cash");
  });
});
