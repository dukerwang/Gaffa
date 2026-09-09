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

  it('formats correctly for specific timezones like America/New_York (EDT)', () => {
    // 2026-09-12 14:00 UTC = 10:00 AM EDT (UTC-4)
    const resultNYC = formatLocalKickoff('2026-09-12T14:00:00Z', 'America/New_York');
    expect(resultNYC).toBe('Sat 10:00 AM');

    // 2026-09-12 14:00 UTC = 7:00 AM PDT (UTC-7)
    const resultLA = formatLocalKickoff('2026-09-12T14:00:00Z', 'America/Los_Angeles');
    expect(resultLA).toBe('Sat 7:00 AM');
  });
});
