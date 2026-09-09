import { describe, it, expect } from 'vitest';
import { formatLocalKickoff } from '../formatKickoff';

describe('formatLocalKickoff', () => {
  it('returns empty string for null, undefined, or empty values', () => {
    expect(formatLocalKickoff(null)).toBe('');
    expect(formatLocalKickoff(undefined)).toBe('');
    expect(formatLocalKickoff('')).toBe('');
    expect(formatLocalKickoff('invalid-date')).toBe('');
  });

  it('formats valid ISO date strings with day and time', () => {
    const result = formatLocalKickoff('2026-09-13T15:30:00Z');
    expect(result).toBeTruthy();
    // In any timezone, should include weekday prefix and numbers
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
