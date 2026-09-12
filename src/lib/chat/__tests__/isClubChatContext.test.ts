import { describe, expect, it } from 'vitest';
import { isClubChatContext } from '../isClubChatContext';

const LEAGUE = '772588fc-98d3-43d0-a71d-cb8dd17eafcd';

describe('isClubChatContext', () => {
  it('matches Clubs top-bar routes', () => {
    expect(isClubChatContext(`/league/${LEAGUE}/team/roster`, LEAGUE)).toBe(true);
    expect(isClubChatContext(`/league/${LEAGUE}/clubs/b1d3dc70-e60a-4896-a49e-5fff1ead5532`, LEAGUE)).toBe(true);
    expect(isClubChatContext(`/league/${LEAGUE}/team`, LEAGUE)).toBe(true);
    expect(isClubChatContext(`/league/${LEAGUE}/team/lineup`, LEAGUE)).toBe(true);
  });

  it('does not match lobby, home, or chat itself', () => {
    expect(isClubChatContext(`/league/${LEAGUE}`, LEAGUE)).toBe(false);
    expect(isClubChatContext(`/league/${LEAGUE}/chat`, LEAGUE)).toBe(false);
    expect(isClubChatContext(`/league/${LEAGUE}/fixtures`, LEAGUE)).toBe(false);
    expect(isClubChatContext(`/league/${LEAGUE}/transfers`, LEAGUE)).toBe(false);
  });
});
