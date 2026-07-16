-- 0025_member_claims.sql — a seeded member logs in as herself.
--
--   npm run db:migrate
--
-- Two ways a member row gets a login:
--   1. The candidate path (join.ts) creates her row already linked — new people
--      arrive logged-in.
--   2. THIS — a member the organizer SEEDED (a row with user_id NULL: the 26 demo
--      women, or real members added while a circle is forming, §5a) needs to bind
--      her login to that existing row, not mint a duplicate. The organizer hands her
--      a claim link; she opens it, signs in, and members.user_id is set to her.
--
-- The same shape as admin_invites (0023), pointed at a member row instead of an
-- admin membership. The token is a bearer credential — whoever holds the link
-- becomes that member — so it is single-use and short-lived, and every redemption
-- records who used it.
--
-- Deliberately NOT unique per member: a lost or expired code should not stop the
-- organizer minting another. Single-use is per TOKEN (redeemed_at); binding is
-- guarded separately by members.user_id already being set (a row is claimed once).

CREATE TABLE IF NOT EXISTS member_claims (
    token       TEXT        PRIMARY KEY,
    tenant_id   TEXT        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
    -- The member this link claims. If she is deleted, the dangling code goes with her.
    member_id   TEXT        NOT NULL REFERENCES members(id)    ON DELETE CASCADE,
    created_by  TEXT        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    -- Single-use. Set on redemption.
    redeemed_at TIMESTAMPTZ,
    -- Who used it. SET NULL on erasure so the record that it WAS redeemed survives
    -- the person becoming unfindable — same as a departed member's row.
    redeemed_by TEXT        REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS member_claims_tenant_idx
    ON member_claims (tenant_id, created_at DESC);
-- The live (unredeemed, unexpired) codes for a programme — the only set the UI needs.
CREATE INDEX IF NOT EXISTS member_claims_live_idx
    ON member_claims (tenant_id) WHERE redeemed_at IS NULL;
