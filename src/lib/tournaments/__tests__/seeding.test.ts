import { describe, it, expect } from 'vitest';
import { cupDrawGameweek, orderForSeeding, tableThrough, type SeedMatchup } from '../seeding';

const teams = [
  { id: 'a', team_name: 'A' },
  { id: 'b', team_name: 'B' },
  { id: 'c', team_name: 'C' },
];
const fm = (gameweek: number, a: string, b: string, sa: number, sb: number, status = 'completed'): SeedMatchup =>
  ({ gameweek, status, team_a_id: a, team_b_id: b, score_a: sa, score_b: sb });

describe('cupDrawGameweek', () => {
  it('is the matchweek before the first round: League Cup MW15, Champions Cup MW31 in a 6-club league', () => {
    expect(cupDrawGameweek('secondary_cup', 6)).toBe(15);
    expect(cupDrawGameweek('primary_cup', 6)).toBe(31);
  });

  it('draws the Consolation Cup with the Champions Cup so one table splits both', () => {
    expect(cupDrawGameweek('consolation_cup', 6)).toBe(31);
    expect(cupDrawGameweek('consolation_cup', 10)).toBe(cupDrawGameweek('primary_cup', 10));
  });

  it('follows the round schedule in a bigger league', () => {
    // 12 clubs: a 10-club Champions Cup in a 16 bracket starts at MW30; a 16-bracket League Cup at MW9.
    expect(cupDrawGameweek('primary_cup', 12)).toBe(29);
    expect(cupDrawGameweek('secondary_cup', 12)).toBe(8);
  });
});

describe('tableThrough', () => {
  it('is not ready until the draw gameweek has results', () => {
    expect(tableThrough([fm(6, 'a', 'b', 90, 80)], teams, 7).size).toBe(0);
  });

  it('is not ready while any matchup up to the draw gameweek is unfinished', () => {
    const live = [fm(7, 'a', 'b', 120, 100, 'live'), fm(6, 'a', 'c', 90, 80)];
    expect(tableThrough(live, teams, 7).size).toBe(0);
    const stuckEarlier = [fm(7, 'a', 'b', 120, 100), fm(5, 'a', 'c', 90, 80, 'scheduled')];
    expect(tableThrough(stuckEarlier, teams, 7).size).toBe(0);
  });

  it('is ready past a blank draw gameweek once a later one has finished', () => {
    expect(tableThrough([fm(6, 'a', 'b', 90, 80)], teams, 7, new Map(), true).size).toBe(3);
  });

  it('ignores gameweeks after the draw gameweek, finished or not', () => {
    const table = tableThrough([fm(7, 'a', 'b', 120, 100), fm(8, 'b', 'a', 900, 100), fm(9, 'b', 'a', 900, 100, 'live')], teams, 7);
    expect(table.get('a')?.rank).toBe(1);
    expect(table.get('b')?.rank).toBe(3);
  });

  it('scores a margin inside the draw band as a draw', () => {
    const table = tableThrough([fm(7, 'a', 'b', 105, 100)], teams, 7);
    expect(table.get('a')).toEqual({ rank: 1, played: 1 });
    expect(table.get('b')).toEqual({ rank: 2, played: 1 });
    expect(table.get('c')).toEqual({ rank: 3, played: 0 });
  });

  it('breaks a points tie on goal difference, not on last season', () => {
    // a and b each win once; b by more. Last season a finished above b.
    const m = [fm(7, 'a', 'c', 130, 100), fm(7, 'b', 'c', 160, 100)];
    const table = tableThrough(m, teams, 7, new Map([['a', 1], ['b', 2], ['c', 3]]));
    expect(table.get('b')?.rank).toBe(1);
    expect(table.get('a')?.rank).toBe(2);
  });

  it('uses last season only between clubs level on points, goal difference and points for', () => {
    // a v b is level at 100-100, a draw: identical rows for a and b. c did not play.
    const level = [fm(7, 'a', 'b', 100, 100)];
    const lastYear = new Map([['a', 5], ['b', 2], ['c', 1]]);
    const table = tableThrough(level, teams, 7, lastYear);
    expect(table.get('b')?.rank).toBe(1);
    expect(table.get('a')?.rank).toBe(2);
  });

  it('puts a club missing from last season below the clubs that have a rank', () => {
    const level = [fm(7, 'a', 'b', 100, 100)];
    const table = tableThrough(level, teams, 7, new Map([['a', 9]]));
    expect(table.get('a')?.rank).toBe(1);
    expect(table.get('b')?.rank).toBe(2);
  });
});

describe('orderForSeeding', () => {
  it('is not ready without a table, whatever last season says', () => {
    expect(orderForSeeding(teams, new Map())).toEqual({ ready: false, ordered: [] });
  });

  it('orders by table position', () => {
    const table = new Map([['c', { rank: 1, played: 7 }], ['a', { rank: 2, played: 7 }], ['b', { rank: 3, played: 7 }]]);
    const { ready, ordered } = orderForSeeding(teams, table);
    expect(ready).toBe(true);
    expect(ordered.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });
});
