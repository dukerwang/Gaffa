import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Connect with Gaffa: Futbolpedia reads a manager's clubs with a grant the
 * manager approves on /connect/futbolpedia. The flow is OAuth's authorization
 * code with PKCE: the approval page issues a one-time code bound to the
 * manager, a code challenge and Futbolpedia's origin; Futbolpedia's server
 * exchanges it, with the verifier, for an opaque bearer token. Only hashes are
 * stored (migration 190).
 */

export const CODE_TTL_MS = 5 * 60 * 1000;
/** A grant's last_used_at is written at most this often, to keep reads cheap. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const TOKEN_PREFIX = 'fpg_';

const DEFAULT_ALLOWED_ORIGINS = ['https://futbolpedia.ai.studio', 'http://localhost:3000'];

export class GrantError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GrantError';
  }
}

/** Origins a code may be returned to: FUTBOLPEDIA_ALLOWED_ORIGINS (comma-separated) or the defaults. */
export function allowedFutbolpediaOrigins(raw = process.env.FUTBOLPEDIA_ALLOWED_ORIGINS): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS;
}

/** An exact origin (scheme, host, port; no path) on the allowlist. */
export function isAllowedReturnOrigin(origin: unknown, allowed = allowedFutbolpediaOrigins()): origin is string {
  if (typeof origin !== 'string' || !origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  return allowed.includes(origin);
}

/** An S256 challenge: base64url of a SHA-256 digest, 43 characters. */
export function isValidCodeChallenge(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** A PKCE verifier as RFC 7636 defines it. */
export function isValidCodeVerifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

/** The state Futbolpedia sends and gets back unchanged; bounded so it can't carry a payload. */
export function isValidState(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The token from an `Authorization: Bearer fpg_…` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  if (!m || !m[1].startsWith(TOKEN_PREFIX)) return null;
  return m[1];
}

export interface CodeRow {
  code_hash: string;
  user_id: string;
  code_challenge: string;
  return_origin: string;
  expires_at: string;
}

export interface GrantRow {
  id: string;
  user_id: string;
  last_used_at: string | null;
}

/** Storage for codes and grants. The Supabase one is below; tests use an in-memory one. */
export interface GrantStore {
  insertCode(row: CodeRow, now: Date): Promise<void>;
  /** Marks the code used and returns it, only if it was unused and unexpired. Atomic. */
  consumeCode(codeHash: string, now: Date): Promise<CodeRow | null>;
  insertGrant(row: { user_id: string; token_hash: string; return_origin: string }): Promise<void>;
  findActiveGrant(tokenHash: string): Promise<GrantRow | null>;
  touchGrant(id: string, now: Date): Promise<void>;
  /** Revokes a grant, only if it belongs to userId. Returns whether a live grant was revoked. */
  revokeGrant(id: string, userId: string, now: Date): Promise<boolean>;
}

/** Issues a one-time code for a signed-in manager who pressed Allow. */
export async function issueCode(
  store: GrantStore,
  input: { userId: string; codeChallenge: unknown; returnOrigin: unknown; now?: Date },
): Promise<string> {
  if (!isValidCodeChallenge(input.codeChallenge)) throw new GrantError('Invalid code challenge', 400);
  if (!isAllowedReturnOrigin(input.returnOrigin)) throw new GrantError('Unknown return origin', 400);
  const now = input.now ?? new Date();
  const code = randomBytes(32).toString('base64url');
  await store.insertCode(
    {
      code_hash: hashSecret(code),
      user_id: input.userId,
      code_challenge: input.codeChallenge,
      return_origin: input.returnOrigin,
      expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    },
    now,
  );
  return code;
}

/**
 * Exchanges a code for a grant token. The code is burned on the first attempt,
 * right or wrong, so a stolen code can't be retried against the verifier.
 */
export async function exchangeCode(
  store: GrantStore,
  input: { code: unknown; codeVerifier: unknown; returnOrigin: unknown; now?: Date },
): Promise<string> {
  if (typeof input.code !== 'string' || !input.code) throw new GrantError('Missing code', 400);
  if (!isValidCodeVerifier(input.codeVerifier)) throw new GrantError('Invalid code verifier', 400);
  const now = input.now ?? new Date();
  const row = await store.consumeCode(hashSecret(input.code), now);
  if (!row) throw new GrantError('Code is invalid, expired or already used', 400);
  if (!sameString(pkceChallenge(input.codeVerifier), row.code_challenge)) {
    throw new GrantError('Code verifier does not match', 400);
  }
  if (typeof input.returnOrigin !== 'string' || input.returnOrigin !== row.return_origin) {
    throw new GrantError('Return origin does not match', 400);
  }
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  await store.insertGrant({ user_id: row.user_id, token_hash: hashSecret(token), return_origin: row.return_origin });
  return token;
}

/** The live grant behind an Authorization header, or null. Touches last_used_at at most hourly. */
export async function resolveGrant(
  store: GrantStore,
  authorization: string | null | undefined,
  now = new Date(),
): Promise<{ grantId: string; userId: string } | null> {
  const token = bearerToken(authorization);
  if (!token) return null;
  const grant = await store.findActiveGrant(hashSecret(token));
  if (!grant) return null;
  const last = grant.last_used_at ? Date.parse(grant.last_used_at) : 0;
  if (!(now.getTime() - last < TOUCH_INTERVAL_MS)) {
    await store.touchGrant(grant.id, now).catch(() => undefined);
  }
  return { grantId: grant.id, userId: grant.user_id };
}

/** The store over the service-role client. Server-only: the tables have no RLS policies. */
export function adminGrantStore(admin: SupabaseClient): GrantStore {
  return {
    async insertCode(row, now) {
      // Clear codes that expired more than a day ago; there are only ever a handful.
      await admin
        .from('futbolpedia_auth_codes')
        .delete()
        .lt('expires_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      const { error } = await admin.from('futbolpedia_auth_codes').insert(row);
      if (error) throw new GrantError('Could not issue a code', 500);
    },
    async consumeCode(codeHash, now) {
      const { data, error } = await admin
        .from('futbolpedia_auth_codes')
        .update({ used_at: now.toISOString() })
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .gt('expires_at', now.toISOString())
        .select('code_hash, user_id, code_challenge, return_origin, expires_at')
        .maybeSingle();
      if (error) throw new GrantError('Could not read the code', 500);
      return (data as CodeRow | null) ?? null;
    },
    async insertGrant(row) {
      const { error } = await admin.from('futbolpedia_grants').insert(row);
      if (error) throw new GrantError('Could not create the grant', 500);
    },
    async findActiveGrant(tokenHash) {
      const { data, error } = await admin
        .from('futbolpedia_grants')
        .select('id, user_id, last_used_at')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .maybeSingle();
      if (error) throw new GrantError('Could not read the grant', 500);
      return (data as GrantRow | null) ?? null;
    },
    async touchGrant(id, now) {
      await admin.from('futbolpedia_grants').update({ last_used_at: now.toISOString() }).eq('id', id);
    },
    async revokeGrant(id, userId, now) {
      const { data, error } = await admin
        .from('futbolpedia_grants')
        .update({ revoked_at: now.toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .is('revoked_at', null)
        .select('id');
      if (error) throw new GrantError('Could not revoke the grant', 500);
      return (data?.length ?? 0) > 0;
    },
  };
}
