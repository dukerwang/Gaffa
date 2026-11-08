import { describe, it, expect } from 'vitest';
import { orderForSeeding } from '../seeding';
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
  it('refuses to seed a table nobody has played in', () => {
    const level = table(dragoon.map((t, i) => [t.id, i + 1, 0]));
    expect(orderForSeeding(dragoon, new Map(), level).basis).toBe('none');
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
