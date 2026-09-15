import { describe, it, expect } from 'vitest';
import { getPlayerDisplayName, playerInitial } from '../displayName';

describe('getPlayerDisplayName', () => {
  it('formats Savio mononym correctly for all name variants', () => {
    // Current 2026-27 Tottenham / PL format
    expect(
      getPlayerDisplayName({
        name: 'Sávio Moreira de Oliveira',
        web_name: 'Sávio',
      }),
    ).toBe('Sávio');

    expect(
      getPlayerDisplayName(
        {
          name: 'Sávio Moreira de Oliveira',
          web_name: 'Sávio',
        },
        'full',
      ),
    ).toBe('Sávio');

    expect(
      getPlayerDisplayName(
        {
          name: 'Sávio Moreira de Oliveira',
          web_name: 'Sávio',
        },
        'split',
      ),
    ).toEqual({ first: '', last: 'Sávio' });

    // Historical 2024-26 Savinho web_name
    expect(
      getPlayerDisplayName({
        name: 'Sávio Moreira de Oliveira',
        web_name: 'Savinho',
      }),
    ).toBe('Sávio');

    // Passing just "Savinho" or "Savio"
    expect(getPlayerDisplayName({ name: 'Savinho' })).toBe('Sávio');
    expect(getPlayerDisplayName({ web_name: 'Savinho' })).toBe('Sávio');
    expect(getPlayerDisplayName({ name: 'Savio' })).toBe('Sávio');
    expect(getPlayerDisplayName({ web_name: 'Savio' })).toBe('Sávio');
  });

  it('computes playerInitial for Savio', () => {
    expect(
      playerInitial({
        name: 'Sávio Moreira de Oliveira',
        web_name: 'Sávio',
      }),
    ).toBe('S');
  });

  it('resolves other mononyms correctly', () => {
    expect(
      getPlayerDisplayName({
        name: 'Rodrigo Hernandez Cascante',
        web_name: 'Rodri',
      }),
    ).toBe('Rodri');

    expect(
      getPlayerDisplayName({
        name: 'Estêvão Almeida de Oliveira Gonçalves',
        web_name: 'Estêvão',
      }),
    ).toBe('Estêvão');

    expect(
      getPlayerDisplayName({
        name: 'Norberto Bercique Gomes Betuncal',
        web_name: 'Beto',
      }),
    ).toBe('Beto');
  });

  it('formats standard two-part names correctly', () => {
    expect(
      getPlayerDisplayName({
        name: 'Erling Haaland',
        web_name: 'Haaland',
      }),
    ).toBe('E. Haaland');

    expect(
      getPlayerDisplayName(
        {
          name: 'Erling Haaland',
          web_name: 'Haaland',
        },
        'full',
      ),
    ).toBe('Erling Haaland');
  });
});
