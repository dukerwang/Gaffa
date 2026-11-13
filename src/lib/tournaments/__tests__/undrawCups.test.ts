import { describe, it, expect } from 'vitest';
import { isUnplayed } from '../undrawCups';

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
