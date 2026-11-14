import { describe, expect, it } from 'vitest';
import { parseBlocks } from '../FutbolpediaProse';

describe('parseBlocks', () => {
  it('reads Futbolpedia replies as paragraphs, bullet and numbered lists, headings and tables', () => {
    const text = [
      '### Recommended XI',
      '* **RB: Timber** (Arsenal) — no OOP penalty.',
      '- **DM: Caicedo** (Chelsea)',
      '',
      '1. DEF: Muharemović',
      '2. MID: Wharton',
      '',
      '| Slot | Player |',
      '| --- | --- |',
      '| RW | Saka |',
      '',
      '*(Note: keep him on the reserves.)*',
      'A second line.',
    ].join('\n');
    expect(parseBlocks(text)).toEqual([
      { kind: 'h', text: 'Recommended XI' },
      { kind: 'ul', items: ['**RB: Timber** (Arsenal) — no OOP penalty.', '**DM: Caicedo** (Chelsea)'] },
      { kind: 'ol', items: ['DEF: Muharemović', 'MID: Wharton'] },
      { kind: 'table', rows: [['Slot', 'Player'], ['RW', 'Saka']] },
      { kind: 'p', lines: ['*(Note: keep him on the reserves.)*', 'A second line.'] },
    ]);
  });
});
