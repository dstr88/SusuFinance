-- 0037_payout_address_set_at.sql — when a payout wallet was last set.
--
--   npm run db:migrate
--
-- Needed for the grace period on verification. Opening a round currently refuses
-- outright if the recipient's payout address is not proven, which is correct as a
-- destination but brutal as a schedule: a woman who set her wallet yesterday and has
-- not yet done the self-send stops the whole circle's turn.
--
-- The policy is warn for two weeks, then block. That needs a start date, and
-- updated_at cannot be it — that column moves whenever anything about her changes, so
-- a display-name edit would silently restart her grace.
--
-- Set whenever the payout address CHANGES, by either hand: the operator setting it for
-- a seeded member, or the member setting her own. A new address is a new claim and
-- earns a fresh two weeks, because it is a different address that nobody has proven.

ALTER TABLE members ADD COLUMN IF NOT EXISTS payout_address_set_at TIMESTAMPTZ;

-- Existing members with an address but no stamp: treat now as the start. Backdating to
-- created_at would put everyone instantly past the deadline and block circles that are
-- running today, which is a migration deciding policy rather than recording a fact.
UPDATE members
   SET payout_address_set_at = now()
 WHERE payout_address IS NOT NULL
   AND payout_address <> ''
   AND payout_address_set_at IS NULL;
