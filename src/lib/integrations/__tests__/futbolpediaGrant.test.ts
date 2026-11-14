import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  allowedFutbolpediaOrigins,
  bearerToken,
  CODE_TTL_MS,
  exchangeCode,
  GrantError,
  hashSecret,
  isAllowedReturnOrigin,
  issueCode,
  pkceChallenge,
  resolveGrant,
  type CodeRow,
  type GrantStore,
} from '../futbolpediaGrant';
import { futbolpediaConnectReturnUrl } from '../futbolpediaConnectUrl';
import { nextPathFromCookie, safeNextPath } from '../../auth/nextPath';

const ORIGIN = 'https://futbolpedia.ai.studio';
const NOW = new Date('2026-11-13T12:00:00Z');

/** An in-memory GrantStore with the same contract as the Supabase one. */
function memoryStore() {
  const codes = new Map<string, CodeRow & { used_at: string | null }>();
  const grants: Array<{ id: string; user_id: string; token_hash: string; last_used_at: string | null; revoked_at: string | null }> = [];
  let touches = 0;
  const store: GrantStore = {
    async insertCode(row) {
      codes.set(row.code_hash, { ...row, used_at: null });
    },
    async consumeCode(codeHash, now) {
      const row = codes.get(codeHash);
      if (!row || row.used_at || Date.parse(row.expires_at) <= now.getTime()) return null;
      row.used_at = now.toISOString();
      return row;
    },
    async insertGrant(row) {
      grants.push({ id: `g${grants.length + 1}`, user_id: row.user_id, token_hash: row.token_hash, last_used_at: null, revoked_at: null });
    },
    async findActiveGrant(tokenHash) {
      const g = grants.find((x) => x.token_hash === tokenHash && !x.revoked_at);
      return g ? { id: g.id, user_id: g.user_id, last_used_at: g.last_used_at } : null;
    },
    async touchGrant(id, now) {
      touches += 1;
      const g = grants.find((x) => x.id === id);
      if (g) g.last_used_at = now.toISOString();
    },
    async revokeGrant(id, userId, now) {
      const g = grants.find((x) => x.id === id && x.user_id === userId && !x.revoked_at);
      if (!g) return false;
      g.revoked_at = now.toISOString();
      return true;
    },
  };
  return { store, codes, grants, touches: () => touches };
}

function verifier(): string {
  return randomBytes(32).toString('base64url');
}

async function connect(store: GrantStore, v = verifier()) {
  const code = await issueCode(store, { userId: 'u1', codeChallenge: pkceChallenge(v), returnOrigin: ORIGIN, now: NOW });
  return { code, v };
}

describe('return origins', () => {
  it('accepts only exact origins on the allowlist', () => {
    const allowed = allowedFutbolpediaOrigins('https://futbolpedia.ai.studio, http://localhost:3000/');
    expect(allowed).toEqual(['https://futbolpedia.ai.studio', 'http://localhost:3000']);
    expect(isAllowedReturnOrigin('https://futbolpedia.ai.studio', allowed)).toBe(true);
    expect(isAllowedReturnOrigin('http://localhost:3000', allowed)).toBe(true);
    expect(isAllowedReturnOrigin('https://futbolpedia.ai.studio/', allowed)).toBe(false);
    expect(isAllowedReturnOrigin('https://futbolpedia.ai.studio.evil.com', allowed)).toBe(false);
    expect(isAllowedReturnOrigin('https://evil.com', allowed)).toBe(false);
    expect(isAllowedReturnOrigin('javascript:alert(1)', allowed)).toBe(false);
    expect(isAllowedReturnOrigin(undefined, allowed)).toBe(false);
  });

  it('falls back to the defaults when the variable is empty', () => {
    expect(allowedFutbolpediaOrigins('')).toContain('https://futbolpedia.ai.studio');
    // Production never returns a code to a local build unless the variable says so.
    expect(allowedFutbolpediaOrigins('', true)).toEqual(['https://futbolpedia.ai.studio']);
  });
});

describe('issueCode', () => {
  it('stores only the hash, bound to the manager, challenge and origin, for five minutes', async () => {
    const { store, codes } = memoryStore();
    const { code, v } = await connect(store);
    expect(codes.has(code)).toBe(false);
    const row = codes.get(hashSecret(code))!;
    expect(row.user_id).toBe('u1');
    expect(row.code_challenge).toBe(pkceChallenge(v));
    expect(row.return_origin).toBe(ORIGIN);
    expect(Date.parse(row.expires_at) - NOW.getTime()).toBe(CODE_TTL_MS);
  });

  it('refuses an unknown origin or a malformed challenge', async () => {
    const { store } = memoryStore();
    await expect(
      issueCode(store, { userId: 'u1', codeChallenge: pkceChallenge(verifier()), returnOrigin: 'https://evil.com' }),
    ).rejects.toBeInstanceOf(GrantError);
    await expect(
      issueCode(store, { userId: 'u1', codeChallenge: 'short', returnOrigin: ORIGIN }),
    ).rejects.toThrow('Invalid code challenge');
  });
});

describe('exchangeCode', () => {
  it('returns a token whose hash, not the token, is stored', async () => {
    const { store, grants } = memoryStore();
    const { code, v } = await connect(store);
    const token = await exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: NOW });
    expect(token.startsWith('fpg_')).toBe(true);
    expect(grants).toHaveLength(1);
    expect(grants[0].token_hash).toBe(hashSecret(token));
    expect(grants[0].user_id).toBe('u1');
  });

  it('refuses a second use of the same code', async () => {
    const { store } = memoryStore();
    const { code, v } = await connect(store);
    await exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: NOW });
    await expect(exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: NOW })).rejects.toThrow(
      'already used',
    );
  });

  it('refuses an expired code', async () => {
    const { store } = memoryStore();
    const { code, v } = await connect(store);
    const later = new Date(NOW.getTime() + CODE_TTL_MS + 1);
    await expect(exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: later })).rejects.toThrow(
      'expired',
    );
  });

  it('burns the code on a wrong verifier, so the right one fails afterwards too', async () => {
    const { store, grants } = memoryStore();
    const { code, v } = await connect(store);
    await expect(
      exchangeCode(store, { code, codeVerifier: verifier(), returnOrigin: ORIGIN, now: NOW }),
    ).rejects.toThrow('does not match');
    await expect(exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: NOW })).rejects.toThrow();
    expect(grants).toHaveLength(0);
  });

  it('refuses a different return origin than the code was issued for', async () => {
    const { store, grants } = memoryStore();
    const { code, v } = await connect(store);
    await expect(
      exchangeCode(store, { code, codeVerifier: v, returnOrigin: 'http://localhost:3000', now: NOW }),
    ).rejects.toThrow('origin');
    expect(grants).toHaveLength(0);
  });
});

describe('resolveGrant', () => {
  it('resolves a live token to its manager and stops after revoke', async () => {
    const { store } = memoryStore();
    const { code, v } = await connect(store);
    const token = await exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: NOW });
    const grant = await resolveGrant(store, `Bearer ${token}`, NOW);
    expect(grant?.userId).toBe('u1');
    expect(await store.revokeGrant(grant!.grantId, 'someone-else', NOW)).toBe(false);
    expect(await store.revokeGrant(grant!.grantId, 'u1', NOW)).toBe(true);
    expect(await resolveGrant(store, `Bearer ${token}`, NOW)).toBeNull();
  });

  it('ignores missing, malformed and unknown tokens', async () => {
    const { store } = memoryStore();
    expect(await resolveGrant(store, null, NOW)).toBeNull();
    expect(await resolveGrant(store, 'Basic abc', NOW)).toBeNull();
    expect(await resolveGrant(store, 'Bearer not-a-grant', NOW)).toBeNull();
    expect(await resolveGrant(store, `Bearer fpg_${'x'.repeat(43)}`, NOW)).toBeNull();
    expect(bearerToken('bearer fpg_abc')).toBe('fpg_abc');
  });

  it('writes last_used_at at most once an hour', async () => {
    const { store, touches } = memoryStore();
    const { code, v } = await connect(store);
    const token = await exchangeCode(store, { code, codeVerifier: v, returnOrigin: ORIGIN, now: NOW });
    await resolveGrant(store, `Bearer ${token}`, NOW);
    await resolveGrant(store, `Bearer ${token}`, new Date(NOW.getTime() + 10 * 60 * 1000));
    expect(touches()).toBe(1);
    await resolveGrant(store, `Bearer ${token}`, new Date(NOW.getTime() + 61 * 60 * 1000));
    expect(touches()).toBe(2);
  });
});

describe('futbolpediaConnectReturnUrl', () => {
  it('puts the answer on Futbolpedia’s hash route', () => {
    expect(futbolpediaConnectReturnUrl(ORIGIN, { code: 'abc', state: 's1' })).toBe(
      `${ORIGIN}/#/gaffa/connected?code=abc&state=s1`,
    );
    expect(futbolpediaConnectReturnUrl(ORIGIN, { error: 'access_denied', state: 's1' })).toBe(
      `${ORIGIN}/#/gaffa/connected?error=access_denied&state=s1`,
    );
  });
});

describe('safeNextPath', () => {
  it('keeps same-site paths and drops anything that could leave the site', () => {
    expect(safeNextPath('/connect/futbolpedia?state=a&code_challenge=b')).toBe(
      '/connect/futbolpedia?state=a&code_challenge=b',
    );
    expect(safeNextPath('//evil.com')).toBeNull();
    expect(safeNextPath('/\\evil.com')).toBeNull();
    expect(safeNextPath('https://evil.com')).toBeNull();
    expect(safeNextPath('/ok\n')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(nextPathFromCookie('/settings?q=Rice %26 Saka')).toBe('/settings?q=Rice %26 Saka');
    expect(nextPathFromCookie('%E0%A4%A')).toBeNull();
    expect(nextPathFromCookie(undefined)).toBeNull();
  });
});
