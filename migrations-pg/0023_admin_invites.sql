-- 0023_admin_invites.sql — letting a second human into a programme.
--
--   npm run db:migrate
--
-- The operator invites another operator. This is the first thing in the codebase
-- that admits anyone but the person who created the programme, which makes it the
-- first real test of the tenant model: the invitee must JOIN the operator's programme,
-- not be minted a fresh empty one of her own.
--
-- ── The token is the credential ──────────────────────────────────────────────
--
-- There is no email configured, so an invite is a LINK the operator sends however
-- he likes — WhatsApp, in person, however people actually reach each other. That
-- makes the token a bearer credential: whoever holds the link becomes an admin of
-- this programme. So it is single-use (redeemed_at), short-lived (expires_at), and
-- every redemption is recorded against the human who used it.
--
-- Deliberately NOT an email invite table: no `invited_email` column, because we do
-- not know who he is sending it to and should not pretend to. The link is the
-- invitation; the trust is his, exercised outside this system — which is the same
-- shape as the rest of the product (the group's rules, recorded not enforced).

CREATE TABLE IF NOT EXISTS admin_invites (
    -- The bearer token, base64url. Primary key because it IS the lookup.
    token       TEXT        PRIMARY KEY,
    tenant_id   TEXT        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
    -- Who issued it. An invite outlives nothing: if the issuer's account goes, so
    -- does the invite.
    created_by  TEXT        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    -- Single-use. Set on redemption; a non-null value means the link is spent.
    redeemed_at TIMESTAMPTZ,
    -- Who used it. ON DELETE SET NULL so the record that it WAS redeemed survives
    -- the redeemer's erasure — the programme's book stays whole, the person becomes
    -- unfindable. Same shape as a departed member's row.
    redeemed_by TEXT        REFERENCES auth_users(id) ON DELETE SET NULL
);

-- "Show me the live invites for this programme" — the only query the UI needs.
CREATE INDEX IF NOT EXISTS admin_invites_tenant_idx
    ON admin_invites (tenant_id, created_at DESC);

-- An unredeemed, unexpired invite per programme is the interesting set; this keeps
-- that scan cheap without pretending there is a uniqueness rule (there isn't — an
-- operator may have several outstanding at once, for several people).
CREATE INDEX IF NOT EXISTS admin_invites_live_idx
    ON admin_invites (tenant_id) WHERE redeemed_at IS NULL;
