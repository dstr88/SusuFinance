-- 0022_auth.sql — the auth tables, ported to Postgres so people can sign in.
--
-- Apply with:  npm run db:migrate
--
-- Sign-in is Google · GitHub · magic link · email — the same as Almstins (decided
-- Jul 15). Auth.js (@auth/core) is already wired at src/pages/api/auth/[...auth].ts
-- and src/lib/authAdapter.ts already speaks to these tables through the db shim.
-- They have simply never existed in susufinancedata, which is the entire reason
-- nobody can log in.
--
-- ── Ported, not copied ───────────────────────────────────────────────────────
--
-- Source: migrations/0005_auth.sql + 0007_auth_credentials.sql + the
-- tenant_memberships block of 0006_tenants.sql — all SQLite, Turso-era, never
-- applied to Postgres.
--
-- Deliberately NOT porting the rest of 0006_tenants.sql: it carries eleven ALTER
-- TABLE statements against `wallets`, `transactions`, `import_transactions`,
-- `tradfi_loan_payments` and friends — Almstins tables that do not exist here. It
-- would fail on the first one. And `tenants` already exists (0021 created it, with
-- settings JSONB), so this file leaves it alone and takes only the membership join.
--
-- SQLite → pg changes: TEXT timestamps become TIMESTAMPTZ; expires_at stays an
-- INTEGER because Auth.js hands it over as a unix epoch, not a date.

-- ── auth_users ───────────────────────────────────────────────────────────────
-- The human. `email` is how she signs in and how she gets back in — required in
-- practice, though the column stays nullable because Auth.js creates the row from
-- an OAuth profile before it necessarily has one, and because erasure nulls it.
CREATE TABLE IF NOT EXISTS auth_users (
    id             TEXT PRIMARY KEY,
    name           TEXT,
    email          TEXT,
    email_verified TIMESTAMPTZ,
    image          TEXT
);
-- One account per address. Partial: several rows may legitimately have no email
-- yet (an OAuth profile mid-creation, or an erased account), and NULLs must not
-- collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_idx
    ON auth_users (lower(email)) WHERE email IS NOT NULL;

-- ── auth_accounts ────────────────────────────────────────────────────────────
-- One row per linked provider (Google, GitHub). Tokens live here; nothing else
-- reads them.
CREATE TABLE IF NOT EXISTS auth_accounts (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    provider            TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    access_token        TEXT,
    token_type          TEXT,
    scope               TEXT,
    expires_at          BIGINT,   -- unix epoch, straight from the provider
    refresh_token       TEXT,
    id_token            TEXT,
    session_state       TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_idx
    ON auth_accounts (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);

-- ── auth_sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
    session_token TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    expires       TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);

-- ── auth_verification_tokens ─────────────────────────────────────────────────
-- Magic-link tokens.
CREATE TABLE IF NOT EXISTS auth_verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT NOT NULL,
    expires    TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_verification_tokens_idx
    ON auth_verification_tokens (identifier, token);

-- ── auth_credentials ─────────────────────────────────────────────────────────
-- The email+password path (the Credentials provider). Only a hash is ever stored.
CREATE TABLE IF NOT EXISTS auth_credentials (
    user_id       TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signup_verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT NOT NULL,
    expires    TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS signup_verification_tokens_idx
    ON signup_verification_tokens (identifier, token);

-- ── tenant_memberships ───────────────────────────────────────────────────────
-- Which human belongs to which programme, and as what. `tenants` already exists
-- (0021) — this is only the join.
--
-- requireActiveTenantId() auto-creates a tenant + an 'owner' membership for any
-- signed-in user without one. That is right for the operator: he logs in first, and
-- the programme is his. It is the wrong shape for a member, who must BELONG to a
-- programme rather than own one — but no member can sign in yet, so nothing is
-- broken today. Worth knowing before the first one can.
CREATE TABLE IF NOT EXISTS tenant_memberships (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_memberships_unique
    ON tenant_memberships (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx ON tenant_memberships (user_id);

-- ── auth_users columns the app expects beyond the Auth.js core ───────────────
-- requireActiveTenantId() reads active_tenant_id; the onboarding flags are read by
-- the inherited dashboard.
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS active_tenant_id   TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_onboarded       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS auth_users_active_tenant_idx ON auth_users (active_tenant_id);
