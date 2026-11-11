import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getSessionUser } from '../sessionUser';

const URL = 'https://example.supabase.co';
const KID = 'test-key';

const b64url = (input: string | ArrayBuffer) =>
  Buffer.from(typeof input === 'string' ? input : new Uint8Array(input)).toString('base64url');

async function generateKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

async function signJwt(payload: Record<string, unknown>, privateKey: CryptoKey) {
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(sig)}`;
}

type Claims = { sub?: string; email?: string; user_metadata?: Record<string, unknown> };

function fakeClient(result: { data: { claims: Claims } | null; error: unknown }) {
  return {
    auth: { getClaims: async () => result, getUser: async () => ({ data: { user: null } }) },
  } as never;
}

describe('getSessionUser (mocked)', () => {
  it('maps claims to a user', async () => {
    const user = await getSessionUser(
      fakeClient({
        data: { claims: { sub: 'u1', email: 'a@b.co', user_metadata: { username: 'duke' } } },
        error: null,
      }),
    );
    expect(user).toEqual({ id: 'u1', email: 'a@b.co', user_metadata: { username: 'duke' } });
  });

  it('defaults missing metadata to an empty object', async () => {
    const user = await getSessionUser(fakeClient({ data: { claims: { sub: 'u1' } }, error: null }));
    expect(user?.user_metadata).toEqual({});
  });

  it('returns null on error or when there is no subject', async () => {
    expect(await getSessionUser(fakeClient({ data: null, error: new Error('x') }))).toBeNull();
    expect(await getSessionUser(fakeClient({ data: null, error: null }))).toBeNull();
    expect(await getSessionUser(fakeClient({ data: { claims: {} }, error: null }))).toBeNull();
  });
});

describe('getSessionUser fallback', () => {
  function client(claims: { data: unknown; error: unknown }, getUser: () => Promise<unknown>) {
    return { auth: { getClaims: async () => claims, getUser } } as never;
  }

  it('asks the Auth server when verification errors, and uses its answer', async () => {
    let calls = 0;
    const user = await getSessionUser(
      client({ data: null, error: new Error('jwks fetch failed') }, async () => {
        calls++;
        return { data: { user: { id: 'u9', email: 'x@y.co', user_metadata: { username: 'x' } } } };
      }),
    );
    expect(calls).toBe(1);
    expect(user).toEqual({ id: 'u9', email: 'x@y.co', user_metadata: { username: 'x' } });
  });

  it('returns null when verification errors and the Auth server also rejects', async () => {
    const user = await getSessionUser(
      client({ data: null, error: new Error('bad jwt') }, async () => ({ data: { user: null } })),
    );
    expect(user).toBeNull();
  });

  it('does not call the Auth server when there is simply no session', async () => {
    let calls = 0;
    const user = await getSessionUser(
      client({ data: null, error: null }, async () => {
        calls++;
        return { data: { user: null } };
      }),
    );
    expect(calls).toBe(0);
    expect(user).toBeNull();
  });
});

/**
 * Runs the real supabase-js getClaims against an ES256 token signed here, with
 * fetch counted: a valid session must resolve with no request to /auth/v1/user,
 * and a token signed by any other key must be rejected.
 */
describe('getSessionUser (real getClaims)', () => {
  async function clientFor(signWith: CryptoKey, publishedKey: CryptoKey) {
    const publicJwk = {
      ...(await crypto.subtle.exportKey('jwk', publishedKey)),
      kid: KID,
      alg: 'ES256',
      use: 'sig',
      key_ops: ['verify'],
    };
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        sub: 'user-123',
        aud: 'authenticated',
        iat: now,
        exp: now + 3600,
        email: 'manager@example.com',
        user_metadata: { username: 'duke' },
        role: 'authenticated',
        aal: 'aal1',
        session_id: 's1',
      },
      signWith,
    );

    const session = {
      access_token: token,
      refresh_token: 'r',
      expires_in: 3600,
      expires_at: now + 3600,
      token_type: 'bearer',
      user: { id: 'user-123' },
    };
    const store = new Map<string, string>([['sb-test-auth-token', JSON.stringify(session)]]);
    const requests: string[] = [];
    const client = createClient(URL, 'anon', {
      auth: {
        storageKey: 'sb-test-auth-token',
        autoRefreshToken: false,
        persistSession: true,
        storage: {
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => void store.set(k, v),
          removeItem: (k) => void store.delete(k),
        },
      },
      global: {
        fetch: async (input) => {
          const url = String(input);
          requests.push(url);
          if (url.endsWith('/.well-known/jwks.json')) {
            return new Response(JSON.stringify({ keys: [publicJwk] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }
          return new Response('{}', { status: 500 });
        },
      },
    });
    return { client, requests };
  }

  it('verifies a valid token locally, without calling /auth/v1/user', async () => {
    const { privateKey, publicKey } = await generateKeyPair();
    const { client, requests } = await clientFor(privateKey, publicKey);
    const user = await getSessionUser(client);
    expect(user).toMatchObject({ id: 'user-123', email: 'manager@example.com', user_metadata: { username: 'duke' } });
    expect(requests.some((u) => u.includes('/auth/v1/user'))).toBe(false);
  });

  it('rejects a token signed by a different key', async () => {
    const real = await generateKeyPair();
    const forger = await generateKeyPair();
    const { client } = await clientFor(forger.privateKey, real.publicKey);
    expect(await getSessionUser(client)).toBeNull();
  });
});
