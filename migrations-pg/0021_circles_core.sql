-- 0021_circles_core.sql — the circle layer's first tables (Slice 0).
--
-- Apply with:
--   DATABASE_URL=<susufinancedata url> node src/scripts/applyPgSchema.mjs migrations-pg/0021_circles_core.sql
-- (multi-statement → one implicit transaction → all-or-nothing)
--
-- Scope: only what the operator dashboard reads. Per the standing rule, nothing is
-- pre-created — observed_transfers, watch_state, goals, notifications, circle_votes
-- and circle_vote_ballots land with the builds that need them.
--
-- ── Architecture, enforced by what is absent ─────────────────────────────────
--
-- 1. NO POOLED ADDRESS. There is no pot: a circle round is N-1 wallets paying the
--    Nth directly, and a target group is each saver accumulating in her own wallet.
--    A contract-level receiving_address would be the pot — custody in schema form,
--    and the one column whose existence would invite someone to fill it. The only
--    addresses here belong to members; a round freezes the recipient's payout
--    address at open (payout_address_snapshot) — the anti-swap rule.
--
-- 2. NOTHING SPENDABLE IS STORED. No balance, no progress, no pot total. Balances
--    and progress are always DERIVED from observed contributions. Nobody can adjust
--    a member's savings by typing; only the chain can, by paying her. There is no
--    lock, approval, or permission column anywhere: the schema has no verbs for
--    authority over funds.
--
-- 3. UNITS ONLY. Every amount is a token quantity (NUMERIC, exact). No prices, no
--    valuations, no fiat — the price stack is permanently out of this product.
--
-- 4. NO IDENTITY BEYOND THE RELATIONSHIP. No legal name, no KYC, no location, no
--    wallet contents. display_name and email are BOTH nullable: a member may exist
--    as a bare UUID and must still get full service, and erasure blanks her
--    identifiers while her circle's rows survive under that UUID.
--
-- 5. NO SCORES. Nothing here ranks, tiers, or rates a member. Facts only.
--
-- Tenant isolation is app-enforced: every query filters WHERE tenant_id. RLS is not
-- enabled (repo posture); the tenant_id column + FK is the anchor that makes it
-- checkable.

-- ── tenants ──────────────────────────────────────────────────────────────────
-- One row per operator program. The isolation column on every table below points
-- here. No cross-tenant reads, ever — one program never sees another.
CREATE TABLE IF NOT EXISTS tenants (
    id         TEXT        PRIMARY KEY,
    name       TEXT        NOT NULL,
    settings   JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── members ──────────────────────────────────────────────────────────────────
-- Identity as chosen. The id IS the identity of last resort: erasure nulls
-- display_name/email and the circle's ledger stays whole under the bare UUID.
CREATE TABLE IF NOT EXISTS members (
    id                  TEXT        PRIMARY KEY,
    tenant_id           TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    display_name        TEXT,       -- nullable: UUID-only members are first-class
    email               TEXT,       -- optional PII; absence costs her nothing but email reach
    wallet_address      TEXT,       -- observation anchor: contributions arrive FROM here
    payout_address      TEXT,       -- where her turn pays; frozen per round in rounds
    address_verified_at TIMESTAMPTZ,-- Verify self-send proof; re-verified on payout change
    locale              TEXT        NOT NULL DEFAULT 'en',
    notify_pref         JSONB       NOT NULL DEFAULT
                                    '{"reminders":true,"due_day_nudge":false,"discreet":false,"email_opt_in":false}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS members_tenant_idx ON members (tenant_id);
-- Two members sharing a contribution wallet would make an observed transfer
-- ambiguous to attribute. One wallet, one member, per program.
CREATE UNIQUE INDEX IF NOT EXISTS members_tenant_wallet_uniq
    ON members (tenant_id, lower(wallet_address))
    WHERE wallet_address IS NOT NULL;

-- ── contracts ────────────────────────────────────────────────────────────────
-- The tin reborn: one row per rotating circle or targeted savings group.
CREATE TABLE IF NOT EXISTS contracts (
    id                 TEXT        PRIMARY KEY,
    tenant_id          TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type               TEXT        NOT NULL CHECK (type IN ('circle', 'target_group')),
    name               TEXT        NOT NULL,
    currency           TEXT        NOT NULL DEFAULT 'USDC',
    chain              TEXT,        -- column now, value at the ramp decision
    expected_amount    NUMERIC(38,18) NOT NULL CHECK (expected_amount > 0), -- per member, per period
    cadence            TEXT        NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
    -- target groups only. A circle's pot is DERIVED (contributing members ×
    -- expected_amount) — storing it would let a typed number outrank the chain,
    -- and it drifts the moment a member departs.
    target_amount      NUMERIC(38,18) CHECK (target_amount IS NULL OR target_amount > 0),
    target_date        DATE,
    grace_days         INTEGER     NOT NULL DEFAULT 3 CHECK (grace_days >= 0),  -- "late" is the group's definition
    reminder_lead_days INTEGER     NOT NULL DEFAULT 2 CHECK (reminder_lead_days >= 0),
    status             TEXT        NOT NULL DEFAULT 'forming'
                                   CHECK (status IN ('forming', 'active', 'completed', 'abandoned')),
    yield_strategy     TEXT,        -- reserved, NULL in v1. If ever set: coordinated
                                    -- per-member positions, never a pooled one.
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The pot is derived, so a circle has no target of its own.
    CONSTRAINT contracts_circle_has_no_target CHECK (type <> 'circle' OR target_amount IS NULL)
);
CREATE INDEX IF NOT EXISTS contracts_tenant_idx ON contracts (tenant_id, status);

-- ── contract_members ─────────────────────────────────────────────────────────
-- Membership + rotation order. A departure sets left_at; a replacement is a NEW row
-- inheriting the turn_order. History is never overwritten.
CREATE TABLE IF NOT EXISTS contract_members (
    id          BIGSERIAL   PRIMARY KEY,
    tenant_id   TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id TEXT        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    member_id   TEXT        NOT NULL REFERENCES members(id)   ON DELETE CASCADE,
    turn_order  INTEGER     CHECK (turn_order IS NULL OR turn_order > 0), -- circles only
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- "member since" on her susu card
    left_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS contract_members_contract_idx ON contract_members (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS contract_members_member_idx   ON contract_members (tenant_id, member_id);
-- One live claim on a slot, and one live membership per member — while allowing the
-- departed row to keep its turn_order forever.
CREATE UNIQUE INDEX IF NOT EXISTS contract_members_active_turn_uniq
    ON contract_members (contract_id, turn_order)
    WHERE left_at IS NULL AND turn_order IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contract_members_active_member_uniq
    ON contract_members (contract_id, member_id)
    WHERE left_at IS NULL;

-- ── rounds ───────────────────────────────────────────────────────────────────
-- Circles only. payout_address_snapshot is frozen when the round opens: a payout
-- address that changes mid-round cannot redirect an open round. That freeze is the
-- anti-swap rule, and it is why prepayment can be matched to a future round at all.
CREATE TABLE IF NOT EXISTS rounds (
    id                      TEXT        PRIMARY KEY,
    tenant_id               TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id             TEXT        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    round_index             INTEGER     NOT NULL CHECK (round_index > 0),
    recipient_member_id     TEXT        REFERENCES members(id) ON DELETE SET NULL,
    payout_address_snapshot TEXT,
    due_date                DATE        NOT NULL,
    status                  TEXT        NOT NULL DEFAULT 'scheduled'
                                        CHECK (status IN ('scheduled', 'open', 'completed')),
    payout_tx_hash          TEXT,       -- observed, never initiated
    payout_observed_at      TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contract_id, round_index)
);
CREATE INDEX IF NOT EXISTS rounds_contract_idx ON rounds (tenant_id, contract_id, round_index);

-- ── contributions ────────────────────────────────────────────────────────────
-- The interpreted layer. Raw evidence will live in observed_transfers (watcher
-- build) and disputes re-check against it; this table is the reading, not the fact.
--
-- expected_amount and due_date are SNAPSHOTS of what was expected of her at the
-- time — not editable balances. Per-member forgiveness means a shorted member may
-- have two valid expectations at her turn (netted or full); the observed amount IS
-- the decision, computed at match time and stored nowhere. There is deliberately no
-- arrears_policy column.
--
-- Discipline (early / on-time / late / behind) is DERIVED from observed_at vs
-- due_date + the contract's grace_days. It is never stored: "behind" is a fact about
-- a date, not a label the platform hangs on a person.
CREATE TABLE IF NOT EXISTS contributions (
    id               BIGSERIAL   PRIMARY KEY,
    tenant_id        TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id      TEXT        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    round_id         TEXT        REFERENCES rounds(id) ON DELETE CASCADE, -- circles
    period           TEXT,       -- target groups, e.g. '2026-07'
    member_id        TEXT        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    expected_amount  NUMERIC(38,18) NOT NULL CHECK (expected_amount > 0),
    due_date         DATE        NOT NULL,
    observed_tx_hash TEXT,
    observed_amount  NUMERIC(38,18) CHECK (observed_amount IS NULL OR observed_amount >= 0),
    observed_at      TIMESTAMPTZ,
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'paid', 'partial', 'late')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A circle contribution belongs to a round; a target-group contribution to a period.
    CONSTRAINT contributions_round_xor_period
        CHECK ((round_id IS NOT NULL AND period IS NULL) OR (round_id IS NULL AND period IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS contributions_contract_idx ON contributions (tenant_id, contract_id, status);
CREATE INDEX IF NOT EXISTS contributions_member_idx   ON contributions (tenant_id, member_id);
-- Non-unique on purpose: whether one transfer may satisfy more than one period
-- (prepayment covering two rounds, partial payments rolling forward) is the group's
-- rule and is still open. A unique index here would quietly decide it.
CREATE INDEX IF NOT EXISTS contributions_tx_idx
    ON contributions (tenant_id, observed_tx_hash)
    WHERE observed_tx_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contributions_round_member_uniq
    ON contributions (round_id, member_id) WHERE round_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contributions_period_member_uniq
    ON contributions (contract_id, period, member_id) WHERE period IS NOT NULL;

-- ── contract_events ──────────────────────────────────────────────────────────
-- Append-only accountability log. Trust runs both directions: members can check the
-- organizer here. Append-only is app-enforced (insert only, no UPDATE/DELETE path).
--
-- Vote OUTCOMES will be logged here. Ballots never are — the secret ballot is kept
-- secret by schema rule, and circle_vote_ballots (when it exists) stays outside this
-- table and outside every export.
CREATE TABLE IF NOT EXISTS contract_events (
    id          BIGSERIAL   PRIMARY KEY,
    tenant_id   TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id TEXT        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    actor       TEXT,       -- member id, 'organizer', or 'system'
    action      TEXT        NOT NULL,
    detail      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_events_contract_idx ON contract_events (tenant_id, contract_id, at DESC);
