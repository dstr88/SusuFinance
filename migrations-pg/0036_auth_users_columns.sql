-- 0036_auth_users_columns.sql — the auth_users columns live code already writes to.
--
--   npm run db:migrate
--
-- Three columns referenced by code that runs today, none of which existed here. Every
-- one failed inside a try/catch, so nothing broke loudly and nothing worked:
--
--   last_login   stamped on EVERY sign-in by src/pages/api/auth/[...auth].ts, read by
--                the /admin "Logins today" card. The UPDATE has been throwing since the
--                carve-out, which is why that card read 0 while people were logging in.
--
--   alert_email  read by src/lib/bounceDetector.ts to decide where an alert goes. With
--                the column missing the whole SELECT failed, so the fallback to the
--                login email never ran either — an alert had nowhere to go at all.
--
--   lang         read by the same query, for which language to send in.
--
-- This is the third instance today of the same shape (see 0035 for the request
-- analytics tables, and verify_destinations for the panel that reported zero signups
-- because its table was absent). The carve-out took the schema and left the code.
--
-- ── What this does not do ───────────────────────────────────────────────────
-- last_login starts NULL for existing users. Past sign-ins were never recorded and
-- cannot be recovered; counting begins at the next login. Better an honest gap than a
-- backfilled guess that would make created_at look like activity.

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_login  TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS alert_email TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS lang        TEXT;

-- "Logins today" and "in last 7 days" both scan this.
CREATE INDEX IF NOT EXISTS auth_users_last_login_idx ON auth_users (last_login DESC);
