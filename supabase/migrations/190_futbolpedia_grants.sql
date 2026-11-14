-- Connect with Gaffa: Futbolpedia reads a manager's clubs with a grant the
-- manager approves on gaffa.live, instead of a shared secret any caller could
-- use with two UUIDs. Spec: Futbolpedia repo,
-- docs/superpowers/specs/2026-11-13-gaffa-integration-rework-design.md.
--
-- Only hashes are stored. Both tables are service-role only: RLS is on and no
-- policy grants anon or authenticated access. The approval page and the
-- integration routes reach them through the admin client after checking the
-- caller.

-- One-time codes from the approval page, exchanged for a grant with the PKCE
-- verifier. Five minutes, single use.
CREATE TABLE IF NOT EXISTS public.futbolpedia_auth_codes (
  code_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_challenge text NOT NULL,
  return_origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS futbolpedia_auth_codes_expires_idx
  ON public.futbolpedia_auth_codes (expires_at);

ALTER TABLE public.futbolpedia_auth_codes ENABLE ROW LEVEL SECURITY;

-- A read-only grant, one per connected browser. Revoking sets revoked_at; the
-- row stays so Settings can show when it was used.
CREATE TABLE IF NOT EXISTS public.futbolpedia_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  return_origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS futbolpedia_grants_user_idx
  ON public.futbolpedia_grants (user_id, created_at DESC);

ALTER TABLE public.futbolpedia_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.futbolpedia_auth_codes FROM anon, authenticated;
REVOKE ALL ON public.futbolpedia_grants FROM anon, authenticated;
