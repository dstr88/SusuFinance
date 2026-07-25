-- 0041_notification_body.sql — the rendered text for the in-app inbox.
--
--   npm run db:migrate
--
-- 0040 stored kind + body_ref (the reference), which is enough to send an email at
-- write time but not enough for the in-app inbox to show her a readable notice later.
-- Rather than re-derive the copy at read time (and re-couple the inbox to the template
-- catalogue), the informative title + body are rendered once, in her language, and
-- stored on the in-app row. In-app is always the informative version — it is the
-- private channel behind her login, so discreet mode (a lock-screen / inbox concern)
-- does not apply here.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body  TEXT;
