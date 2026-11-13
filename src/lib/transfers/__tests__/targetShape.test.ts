import { describe, it, expect } from 'vitest';
import { isTargetPosition, parseVisibility } from '../targetShape';

describe('isTargetPosition', () => {
  it('accepts the 12 tactical positions and nothing else', () => {
    for (const p of ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']) {
      expect(isTargetPosition(p)).toBe(true);
    }
    for (const p of ['DEF', 'LM', 'lb', '', null, undefined, 7]) expect(isTargetPosition(p)).toBe(false);
  });
});

describe('parseVisibility', () => {
  it('passes the three audiences through', () => {
    expect(parseVisibility('public')).toBe('public');
    expect(parseVisibility('direct')).toBe('direct');
    expect(parseVisibility('private')).toBe('private');
  });

  it('defaults an omitted value to public', () => {
    expect(parseVisibility(undefined)).toBe('public');
    expect(parseVisibility(null)).toBe('public');
  });

  it('refuses anything else, so a typo cannot broadcast a private target', () => {
    expect(parseVisibility('priavte')).toBeNull();
    expect(parseVisibility('')).toBeNull();
    expect(parseVisibility(3)).toBeNull();
  });
});
