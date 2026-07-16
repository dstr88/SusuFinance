-- 0024_circle_votes.sql — the group decides. Admission, expulsion, and any question
-- a member wants to put to her circle.
--
--   npm run db:migrate
--
-- Two features share one substrate:
--   1. A person joins a formed group by being VOTED in (§5a) — v1 as light as "the
--      sponsor votes yes", growing to the full anonymous blackball without a rebuild.
--   2. Any member may open a vote on ANYTHING (Donnie, Jul 16) — the circle is a
--      self-governing body, and the app records its decisions the way it records
--      everything else: holds the truth, never overrides the group.
--
-- ── The candidate has no membership row ──────────────────────────────────────
--
-- A candidate is a person with an OPEN admission vote and NO contract_members row
-- for that circle. That is deliberate: §5a says she "sees nothing of the circle
-- until admitted", and the cheapest way to guarantee it is to give her nothing to
-- see — no membership row means every member-scoped query already excludes her, and
-- the existing member counts need no `status` filter. Admission is the INSERT of her
-- contract_members row; until the vote passes, she simply is not in the group.
-- (So there is no contract_members.status column here — a row IS a member, as before.)
--
-- ── The secret ballot, and its honest limit ─────────────────────────────────
--
-- circle_vote_ballots exists ONLY to stop a member voting twice. member_id ↔ ballot
-- is NEVER displayed, NEVER exported, NEVER joined into any view or contract_events.
-- Anonymity is what lets a member block an admission without starting a feud (§5a),
-- and it is enforced by DISCIPLINE, not cryptography: the row does link a voter to
-- her ballot, so anyone with raw database access could read it. The app never does
-- and never helps — the same prohibited-vs-preventable honesty the rest of the
-- product keeps. Stronger anonymity (split the "who voted" marker from the ballot
-- value) is a later option if a threat model ever demands it.

-- ── members: a login can BE a member ─────────────────────────────────────────
-- Nullable: organizer-seeded UUID-only members have no login, and that stays first
-- class. ON DELETE SET NULL so erasing the login leaves her circle history whole
-- under the bare UUID — the same shape as a departed member's row.
ALTER TABLE members
    ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL;

-- One login is at most one member per programme.
CREATE UNIQUE INDEX IF NOT EXISTS members_tenant_user_uniq
    ON members (tenant_id, user_id)
    WHERE user_id IS NOT NULL;

-- ── circle_votes: one shape, four kinds ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_votes (
    id                TEXT        PRIMARY KEY,
    tenant_id         TEXT        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    contract_id       TEXT        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    kind              TEXT        NOT NULL
                                  CHECK (kind IN ('admission','mid_entry','expulsion','proposal')),
    -- The person a person-vote is about. NULL for a proposal (a proposal is a
    -- question, not a person).
    subject_member_id TEXT        REFERENCES members(id) ON DELETE CASCADE,
    -- The free-text question a member is putting to the group. Proposals only.
    title             TEXT,
    -- Who opened it — always a member of this circle.
    opened_by         TEXT        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    -- The sponsor (admission only) — the member who vouched; her 'yes' is what the
    -- 'sponsor' threshold turns on.
    invited_by        TEXT        REFERENCES members(id) ON DELETE SET NULL,
    -- How the outcome is decided:
    --   sponsor       passes the moment invited_by votes 'yes'       (admission v1)
    --   blackball     silence consents, one 'no' fails               (admission, full §5a)
    --   unanimous_no  every eligible voter must vote 'no' to pass    (expulsion, §5b)
    --   majority      more 'yes' than 'no' among ballots cast        (any-question proposal)
    threshold         TEXT        NOT NULL
                                  CHECK (threshold IN ('sponsor','blackball','unanimous_no','majority')),
    opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    closes_at         TIMESTAMPTZ NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','passed','failed','cancelled')),
    -- When it resolved. NULL while open.
    outcome_at        TIMESTAMPTZ,
    -- A person-vote names a person; a proposal names a question. Exactly the right
    -- one must be present, so a row can never be a shapeless half of both.
    CONSTRAINT circle_votes_shape CHECK (
        (kind = 'proposal'                                AND title             IS NOT NULL) OR
        (kind IN ('admission','mid_entry','expulsion')    AND subject_member_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS circle_votes_contract_idx
    ON circle_votes (tenant_id, contract_id, status);
-- "The open votes on this circle" is the hot query (the drill-in shows them, the
-- close-cron scans them); keep it cheap.
CREATE INDEX IF NOT EXISTS circle_votes_open_idx
    ON circle_votes (contract_id) WHERE status = 'open';

-- ── circle_vote_ballots: dedup only, secret by rule ──────────────────────────
CREATE TABLE IF NOT EXISTS circle_vote_ballots (
    vote_id   TEXT        NOT NULL REFERENCES circle_votes(id) ON DELETE CASCADE,
    member_id TEXT        NOT NULL REFERENCES members(id)      ON DELETE CASCADE,
    ballot    TEXT        NOT NULL CHECK (ballot IN ('yes','no','abstain')),
    at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One ballot per member per vote. This primary key IS the whole reason the table
    -- exists; nothing reads member_id ↔ ballot for display.
    PRIMARY KEY (vote_id, member_id)
);
