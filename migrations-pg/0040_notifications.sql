-- 0040_notifications.sql — the circle notification center (SusuData §4).
--
--   npm run db:migrate
--
-- One table, three jobs: the in-app notice she can always see (the most private
-- channel — behind her login, nothing left on a shared lock screen, and her own
-- record of what she was told), the delivery record for opt-in email, and the
-- idempotency guard so a reminder cron can run as often as it likes and never nag
-- twice.
--
-- No-shame by construction: every row is a pre-written, catalogued template fired by
-- an event and suppressed by observed behavior (a T-2 reminder never fires on a
-- contribution already paid). There is no free-text field to type harshness into.
--
-- Tenant-scoped like every circle table. member_id/contract_id cascade so a deleted
-- member or contract takes her notices with her.

CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT        PRIMARY KEY,
    tenant_id   TEXT        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    member_id   TEXT        NOT NULL REFERENCES members(id)   ON DELETE CASCADE,
    contract_id TEXT                 REFERENCES contracts(id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL,   -- reminder | due_today | payment_confirmed | cycle_complete (catalogued in notifications.ts)
    channel     TEXT        NOT NULL CHECK (channel IN ('in_app', 'email')),
    body_ref    TEXT        NOT NULL,   -- which templated notice ("kind:eventKey"), for her record and the ops view
    locale      TEXT        NOT NULL DEFAULT 'en',
    -- Idempotency. One notice per (kind, channel, event). e.g. 'reminder:in_app:4821'.
    -- The cron claims the row first and only sends email if the claim was new, so a
    -- retry never double-sends.
    dedupe_key  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at     TIMESTAMPTZ,            -- when the email left (NULL = in-app only, or not yet/failed to send)
    read_at     TIMESTAMPTZ             -- when she opened the in-app notice
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_uniq   ON notifications (dedupe_key);
CREATE INDEX        IF NOT EXISTS notifications_member_idx     ON notifications (tenant_id, member_id, created_at DESC);
CREATE INDEX        IF NOT EXISTS notifications_contract_idx   ON notifications (tenant_id, contract_id, created_at DESC);
-- Her unread in-app inbox — the badge count.
CREATE INDEX        IF NOT EXISTS notifications_unread_idx     ON notifications (member_id)
    WHERE channel = 'in_app' AND read_at IS NULL;
