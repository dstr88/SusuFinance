-- 0038_pool_alerts.sql — evidence that someone is pooling member funds.
--
--   npm run db:migrate
--
-- The bright line is "no pot, ever", and this codebase enforces it for ITSELF: there is
-- no pooled address and nowhere to put one. It cannot enforce it for a wallet provider
-- or a ramp partner operating upstream. Those could pool, and nothing in the app would
-- say so — the only symptom would be contributions quietly failing to be observed,
-- which reads as "nobody paid" rather than "someone is holding the money".
--
-- So this table records the evidence, checked against the chain rather than asked about.
-- An alert here is not proof of bad faith; it is a fact that needs an explanation.
--
-- ── Not surveillance of members ─────────────────────────────────────────────
-- Every check is about the SHAPE of the money flow, never about who anyone is. It reads
-- addresses the programme already holds, and asks whether they are distinct and whether
-- funds route directly. No identity is involved, so bright line #2 is untouched.

CREATE TABLE IF NOT EXISTS pool_alerts (
    id           TEXT        PRIMARY KEY,
    tenant_id    TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- 'shared_address'  two members recorded with the SAME address (omnibus tell)
    -- 'common_sink'     one address receiving from several members (pooling tell)
    kind         TEXT        NOT NULL CHECK (kind IN ('shared_address', 'common_sink')),

    -- The address the finding is about. Public chain data, not a person.
    address      TEXT        NOT NULL,

    -- How many distinct members are implicated. Severity is a count, not a judgment.
    member_count INTEGER     NOT NULL DEFAULT 0,

    detail       TEXT        NOT NULL DEFAULT '',

    first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Set when a human has looked and accepted the explanation. Kept rather than
    -- deleted: a finding that was explained once should not reappear as new, and the
    -- record of having explained it is itself worth holding.
    resolved_at  TIMESTAMPTZ,
    resolved_note TEXT,

    -- One row per finding, re-seen rather than duplicated.
    UNIQUE (tenant_id, kind, address)
);

CREATE INDEX IF NOT EXISTS pool_alerts_open_idx
    ON pool_alerts (tenant_id, last_seen DESC) WHERE resolved_at IS NULL;
