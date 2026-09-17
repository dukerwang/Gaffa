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

  it('formats names with smart budget-driven fallback', () => {
    // Mononyms remain mononyms
    expect(
      getPlayerDisplayName(
        {
          name: 'Rodrigo Hernandez Cascante',
          web_name: 'Rodri',
        },
        'smart',
      ),
    ).toBe('Rodri');

    // Short full names (<= 14 chars) remain full names
    expect(
      getPlayerDisplayName(
        {
          name: 'Cole Palmer',
          web_name: 'Palmer',
        },
        'smart',
      ),
    ).toBe('Cole Palmer');

    expect(
      getPlayerDisplayName(
        {
          name: 'Bukayo Saka',
          web_name: 'Saka',
        },
        'smart',
      ),
    ).toBe('Bukayo Saka');

    expect(
      getPlayerDisplayName(
        {
          name: 'Erling Haaland',
          web_name: 'Haaland',
        },
        'smart',
      ),
    ).toBe('Erling Haaland');

    expect(
      getPlayerDisplayName(
        {
          name: 'Alexander Isak',
          web_name: 'Isak',
        },
        'smart',
      ),
    ).toBe('Alexander Isak');

    // Long names (> 14 chars) fall back to initial_last ("F. Last")
    expect(
      getPlayerDisplayName(
        {
          name: 'Dominic Calvert-Lewin',
          web_name: 'Calvert-Lewin',
        },
        'smart',
      ),
    ).toBe('D. Calvert-Lewin');

    expect(
      getPlayerDisplayName(
        {
          name: 'Trent Alexander-Arnold',
          web_name: 'Alexander-Arnold',
        },
        'smart',
      ),
    ).toBe('T. Alexander-Arnold');

    expect(
      getPlayerDisplayName(
        {
          name: 'Martin Ødegaard',
          web_name: 'Ødegaard',
        },
        'smart',
      ),
    ).toBe('M. Ødegaard');

    expect(
      getPlayerDisplayName(
        {
          name: 'Bruno Fernandes',
          web_name: 'B.Fernandes',
        },
        'smart',
      ),
    ).toBe('B. Fernandes');

    // Accepts raw strings as well
    expect(getPlayerDisplayName('Cole Palmer', 'smart')).toBe('Cole Palmer');
    expect(getPlayerDisplayName('Dominic Calvert-Lewin', 'smart')).toBe('D. Calvert-Lewin');

    // Custom threshold
    expect(
      getPlayerDisplayName(
        {
          name: 'Erling Haaland',
          web_name: 'Haaland',
        },
        'smart',
        10,
      ),
    ).toBe('E. Haaland');
  });
});
