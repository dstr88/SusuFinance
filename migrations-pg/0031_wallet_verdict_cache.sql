-- 0031_wallet_verdict_cache.sql — persist wallet-checker verdicts.
--
--   npm run db:migrate
--
-- checkWallet() already has an in-memory LRU, but it holds 500 entries for 5 minutes
-- and dies with the process. For mail scanning that is close to useless: a scam address
-- circulating across twenty messages over a week costs twenty API calls, and every
-- deploy throws the cache away.
--
-- This table makes a verdict last. The same address seen again — in another message, in
-- another mailbox, after a restart — is answered from Postgres for free.
--
-- ── Why two TTLs ────────────────────────────────────────────────────────────
-- A 'danger' verdict is durable: a sanctioned or blacklisted address does not become
-- clean, so it can be trusted for a long time and re-checking it wastes quota.
-- A 'clean' verdict is perishable: today's unknown address is tomorrow's reported
-- drainer, and a stale clean is the dangerous direction to be wrong in. So clean
-- expires quickly and danger persists.
--
-- Shared across mailboxes on purpose: a scam address is a scam address regardless of
-- who received it. There is no tenant dimension here because there is no tenant claim —
-- this caches a public fact about a public address, not anybody's data.

CREATE TABLE IF NOT EXISTS wallet_verdict_cache (
    address     TEXT        PRIMARY KEY,
    chain       TEXT,

    -- 'clean' | 'caution' | 'danger', straight from the checker.
    scam_level  TEXT        NOT NULL,
    scam_score  INTEGER     NOT NULL DEFAULT 0,

    -- The flags block, verbatim, so a later reason string can be rebuilt without
    -- another API call even if the wording changes.
    flags_json  TEXT        NOT NULL DEFAULT '{}',

    -- True when no primary scam source ran for this chain. Cached alongside the verdict
    -- because a 'clean' with partial coverage must never be replayed as a confident
    -- clean — the caveat has to survive the cache.
    partial     BOOLEAN     NOT NULL DEFAULT false,

    checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

-- The sweep query for expired rows.
CREATE INDEX IF NOT EXISTS wallet_verdict_cache_exp_idx
    ON wallet_verdict_cache (expires_at);
