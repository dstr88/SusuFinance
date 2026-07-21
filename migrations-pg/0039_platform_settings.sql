-- 0039_platform_settings.sql — platform switches an operator can throw.
--
--   npm run db:migrate
--
-- One row per switch. Deliberately not tenant-scoped: these are decisions about the
-- platform itself, taken before there is a programme to scope them to.
--
-- ── Why this exists ─────────────────────────────────────────────────────────
-- Nobody can currently join a circle on their own, but only because group signup is
-- not built yet. That is an accident of the roadmap, not a decision — and it undoes
-- itself the day the feature ships. A hold nobody chose is a hold nobody can trust.
--
-- So: `admissions_held` makes it a decision. While it is on, the self-serve door is
-- shut and a person who signs up waits in the lobby. An operator can still create a
-- circle and place members himself, because that is the whole point of the hold —
-- entry happens when someone decides it does, not when a stranger fills a form.

CREATE TABLE IF NOT EXISTS platform_settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Who threw the switch. A hold that lifts with no name against it is a hold that
    -- gets lifted by accident and blamed on nobody.
    updated_by TEXT
);

-- On by default, and on right now. Reading this table is fail-closed anyway (a
-- missing row or a missing table means HELD), so the guarantee does not depend on
-- this insert having run — it depends on nothing having explicitly opened the door.
INSERT INTO platform_settings (key, value, updated_by)
VALUES ('admissions_held', 'true', 'migration 0039')
ON CONFLICT (key) DO NOTHING;
