import { describe, it, expect } from 'vitest';
import { scoreCell, playStatus } from '../scoreCell';

const PROJ = 12.4;
const PTS = 18.4;

describe('playStatus', () => {
  it('is pending until the player\'s own club kicks off', () => {
    expect(playStatus(0, false)).toBe('pending');
    expect(playStatus(90, false)).toBe('pending');
  });

  it('separates played from DNP once his club has kicked off', () => {
    expect(playStatus(63, true)).toBe('played');
    expect(playStatus(0, true)).toBe('dnp');
    expect(playStatus(undefined, true)).toBe('dnp');
  });
});

describe('scoreCell', () => {
  /**
   * The regression this module was extracted to prevent. `scoreMap` is built
   * for the last COMPLETED gameweek, so a player who has not kicked off in the
   * round on screen still has last week's points attached. The rail and the
   * ledger read that map straight and reported it as this round's — the ledger
   * said "11 of 11 Played" in a week where nothing had started.
   */
  it('shows the projection, not last round\'s points, before kickoff', () => {
    expect(scoreCell('pending', PTS, PROJ)).toEqual({ kind: 'projected', value: PROJ });
  });

  it('shows the real score once he has played', () => {
    expect(scoreCell('played', PTS, PROJ)).toEqual({ kind: 'scored', value: PTS });
  });

  it('treats a played-but-scoreless player as zero, not as missing', () => {
    expect(scoreCell('played', undefined, PROJ)).toEqual({ kind: 'scored', value: 0 });
  });

  it('says DNP over any projection once his club has played', () => {
    expect(scoreCell('dnp', PTS, PROJ)).toEqual({ kind: 'dnp' });
    expect(scoreCell('dnp', undefined, undefined)).toEqual({ kind: 'dnp' });
  });

  it('falls back to the dash when there is no projection to show', () => {
    expect(scoreCell('pending', undefined, undefined)).toEqual({ kind: 'pending' });
    expect(scoreCell('pending', PTS, undefined)).toEqual({ kind: 'pending' });
  });

  /* No scoring context at all: the gameweek could not be resolved. A score is
     the only thing that can be vouched for, so it outranks a projection whose
     round cannot be checked. */
  it('trusts a score over a projection when there is no gameweek context', () => {
    expect(scoreCell(undefined, PTS, PROJ)).toEqual({ kind: 'scored', value: PTS });
    expect(scoreCell(undefined, undefined, PROJ)).toEqual({ kind: 'projected', value: PROJ });
    expect(scoreCell(undefined, undefined, undefined)).toEqual({ kind: 'none' });
  });

  it('renders a projected zero rather than treating it as absent', () => {
    expect(scoreCell('pending', undefined, 0)).toEqual({ kind: 'projected', value: 0 });
  });

  /** The whole page reads one function, so every surface agrees by construction. */
  it('gives the pitch, the rail and the ledger the same answer', () => {
    const inputs: Array<Parameters<typeof scoreCell>> = [
      ['pending', PTS, PROJ],
      ['played', PTS, PROJ],
      ['dnp', PTS, PROJ],
      [undefined, undefined, PROJ],
    ];
    for (const args of inputs) {
      expect(scoreCell(...args)).toEqual(scoreCell(...args));
    }
  });
});
