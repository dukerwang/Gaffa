import { describe, it, expect } from 'vitest';
import { orderForSeeding, tableThrough } from '../seeding';
import { isUnplayed } from '../reseedCups';

// Dynasty Dragoon on 2026-08-21: six clubs, nobody had played, so the table
// sorted them by name and the first two took the byes.
const dragoon = [
  { id: 'stamford', team_name: 'Stamford & Sons' },
  { id: 'moises', team_name: 'Moises FC' },
  { id: 'pizza', team_name: "Pizzaking's Club" },
  { id: 'yang', team_name: 'yang fc' },
  { id: 'united', team_name: "United 08' Vol.2" },
  { id: 'sesko', team_name: 'Sesko Fender' },
];
const table = (rows: [string, number, number][]) =>
  new Map(rows.map(([id, rank, played]) => [id, { rank, played }]));

describe('orderForSeeding', () => {
  it('refuses to seed without an archive or a table', () => {
    expect(orderForSeeding(dragoon, new Map(), new Map()).basis).toBe('none');
  });

  it('seeds from the table once clubs have played', () => {
    const real = table([['stamford', 1, 10], ['moises', 2, 10], ['pizza', 3, 10], ['yang', 4, 10], ['united', 5, 10], ['sesko', 6, 10]]);
    const { basis, ordered } = orderForSeeding(dragoon, new Map(), real);
    expect(basis).toBe('standings');
    expect(ordered.map((t) => t.id)).toEqual(['stamford', 'moises', 'pizza', 'yang', 'united', 'sesko']);
  });

  it('prefers the archived table over the current one', () => {
    const real = table([['stamford', 1, 10], ['moises', 2, 10], ['pizza', 3, 10], ['yang', 4, 10], ['united', 5, 10], ['sesko', 6, 10]]);
    const archive = new Map([['sesko', 1], ['united', 2], ['yang', 3], ['pizza', 4], ['moises', 5], ['stamford', 6]]);
    const { basis, ordered } = orderForSeeding(dragoon, archive, real);
    expect(basis).toBe('archive');
    expect(ordered[0].id).toBe('sesko');
  });

  it('puts a club missing from the archive below the archived ones, by the current table', () => {
    const real = table([['stamford', 1, 10], ['moises', 2, 10], ['pizza', 3, 10], ['yang', 4, 10], ['united', 5, 10], ['sesko', 6, 10]]);
    const archive = new Map([['sesko', 1], ['united', 2], ['yang', 3], ['pizza', 4]]);
    const { ordered } = orderForSeeding(dragoon, archive, real);
    expect(ordered.map((t) => t.id)).toEqual(['sesko', 'united', 'yang', 'pizza', 'stamford', 'moises']);
  });
});

describe('isUnplayed', () => {
  const bye = { team_a_id: 'a', team_b_id: null, status: 'completed' };
  const live = { team_a_id: 'b', team_b_id: 'c', status: 'active' };

  it('treats a round of byes and waiting ties as unplayed', () => {
    expect(isUnplayed([bye, live], [{ drawn_at: null }])).toBe(true);
  });

  it('is played once a real tie is complete', () => {
    expect(isUnplayed([bye, { ...live, status: 'completed' }], [{ drawn_at: null }])).toBe(false);
  });

  it('is played once a later round has been drawn', () => {
    expect(isUnplayed([bye, live], [{ drawn_at: null }, { drawn_at: '2027-02-01' }])).toBe(false);
  });
});

describe('tableThrough', () => {
  const t = [{ id: 'a', team_name: 'A' }, { id: 'b', team_name: 'B' }, { id: 'c', team_name: 'C' }];
  const fm = (gameweek: number, a: string, b: string, sa: number, sb: number) =>
    ({ gameweek, team_a_id: a, team_b_id: b, score_a: sa, score_b: sb });

  it('is empty until the seeding gameweek has finished', () => {
    expect(tableThrough([fm(6, 'a', 'b', 90, 80)], t, 7).size).toBe(0);
  });

  it('ignores gameweeks after the seeding gameweek', () => {
    const table = tableThrough([fm(7, 'a', 'b', 120, 100), fm(8, 'b', 'a', 900, 100)], t, 7);
    expect(table.get('a')?.rank).toBe(1);
    expect(table.get('b')?.rank).toBe(3);
  });

  it('scores a margin inside the draw band as a draw, and breaks ties on goal difference', () => {
    // a v b: 105-100 is a draw (1 point each). c has no game, so 0 points.
    const table = tableThrough([fm(7, 'a', 'b', 105, 100)], t, 7);
    expect(table.get('a')).toEqual({ rank: 1, played: 1 });
    expect(table.get('b')).toEqual({ rank: 2, played: 1 });
    expect(table.get('c')).toEqual({ rank: 3, played: 0 });
  });
});
