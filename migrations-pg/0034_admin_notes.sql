-- 0034_admin_notes.sql — two notepads on /admin.
--
--   npm run db:migrate
--
-- Scratch space for the operator: one shared, one private. The split mirrors the
-- mailboxes above them, which is the point — 'admin' is the pad the operators share
-- the way they share admin@, 'personal' is the pad only its author sees, the way
-- afrikanus@ is his alone. Two words the product already means something by.
--
-- ── Not tenant data ─────────────────────────────────────────────────────────
-- Same reasoning as mail_messages (0026): these are operator notes, they belong to no
-- tenant, and there is no tenant_id that would be correct to store. Isolation is
-- requireAdminSession on every path, plus owner_user_id on the private pad.

CREATE TABLE IF NOT EXISTS admin_notes (
    id            TEXT        PRIMARY KEY,

    -- 'admin'    = one shared pad, owner_user_id IS NULL
    -- 'personal' = one pad per admin, owner_user_id set
    scope         TEXT        NOT NULL CHECK (scope IN ('admin', 'personal')),
    owner_user_id TEXT        REFERENCES auth_users(id) ON DELETE CASCADE,

    body          TEXT        NOT NULL DEFAULT '',

    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Who saved last. On a shared pad two people can be typing, and "someone changed
    -- this" is only useful if it says who.
    updated_by    TEXT        REFERENCES auth_users(id) ON DELETE SET NULL,

    -- The shared pad is a singleton; the private pad is one per person. Both are
    -- enforced by the two partial indexes below rather than by convention.
    CHECK ((scope = 'admin' AND owner_user_id IS NULL)
        OR (scope = 'personal' AND owner_user_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_notes_shared_idx
    ON admin_notes ((1)) WHERE scope = 'admin';

CREATE UNIQUE INDEX IF NOT EXISTS admin_notes_personal_idx
    ON admin_notes (owner_user_id) WHERE scope = 'personal';
