import { describe, expect, it } from 'vitest';
import { clubCodes } from '../clubCodes';

const t = (id: string, name: string) => ({ id, name });

describe('clubCodes', () => {
  it('uses the first three letters of the name', () => {
    const c = clubCodes([t('a', 'Stamford & Sons'), t('b', "United 08' Vol.2"), t('c', 'yang fc'), t('d', "Pizzaking's Club"), t('e', 'Moises FC')]);
    expect(c).toEqual({ a: 'STA', b: 'UNI', c: 'YAN', d: 'PIZ', e: 'MOI' });
  });

  it('never gives two clubs the same code', () => {
    const c = clubCodes([t('a', 'Stamford Sons'), t('b', 'Stamford United'), t('c', 'Stamford Town')]);
    expect(new Set(Object.values(c)).size).toBe(3);
    expect(Object.values(c).every((x) => x.length === 3)).toBe(true);
  });

  it('is stable whatever order the clubs arrive in', () => {
    const teams = [t('a', 'Stamford Sons'), t('b', 'Stamford United')];
    expect(clubCodes(teams)).toEqual(clubCodes([...teams].reverse()));
  });

  it('copes with accents, short names and names with no letters', () => {
    const c = clubCodes([t('a', 'Šeško XI'), t('b', 'AS'), t('c', '08')]);
    expect(c.a).toBe('SES');
    expect(c.b).toHaveLength(3);
    expect(c.c).toBe('CLB');
  });
});
