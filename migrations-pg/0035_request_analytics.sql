-- 0035_request_analytics.sql — the tables the traffic recorder has been writing to.
--
--   npm run db:migrate
--
-- src/middleware/app.ts has been recording every request since the carve-out: route,
-- method, status, duration, country. None of it landed, because these three tables were
-- never created here and the insert sits inside a try/catch. So the recorder was
-- running on every request, failing, and swallowing it — "Requests today: —" on /admin
-- was not low traffic, it was a missing table.
--
-- Creating them turns collection on with no code change.
--
-- ── What is NOT stored ──────────────────────────────────────────────────────
-- No IP addresses and no user agents. Both are salted-hashed before they reach the
-- database (hashWithSalt), so a row identifies a repeat visitor without identifying a
-- person, and the hashes are useless to anyone who does not hold the salt. Country is
-- derived and coarse. That is deliberate for a product whose whole argument is that it
-- does not build profiles of people.

-- Daily rollup: one row per day/route/method/status/country. This is what the traffic
-- chart reads, and it stays small enough to keep indefinitely.
CREATE TABLE IF NOT EXISTS request_agg_daily (
    day          TEXT    NOT NULL,          -- YYYY-MM-DD
    route_key    TEXT    NOT NULL,          -- normalized, so /circles/:id is one route
    method       TEXT    NOT NULL,
    status       INTEGER NOT NULL,
    country_code TEXT    NOT NULL DEFAULT '??',
    count        BIGINT  NOT NULL DEFAULT 0,
    ms_total     BIGINT  NOT NULL DEFAULT 0,
    ms_max       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, route_key, method, status, country_code)
);

CREATE INDEX IF NOT EXISTS request_agg_daily_day_idx ON request_agg_daily (day);

-- Per-request detail, kept only for the routes isDetailedAnalyticsRoute() names — not
-- for everything. A full request log of a whole site is a surveillance artifact nobody
-- asked for; a narrow one answers questions about the pages that matter.
CREATE TABLE IF NOT EXISTS request_log (
    id             BIGSERIAL PRIMARY KEY,
    ts             TEXT      NOT NULL,
    route          TEXT      NOT NULL,
    route_key      TEXT      NOT NULL,
    method         TEXT      NOT NULL,
    status         INTEGER   NOT NULL,
    ms             INTEGER   NOT NULL DEFAULT 0,
    ip_hash        TEXT,                    -- salted hash, never an address
    ua_hash        TEXT,                    -- salted hash, never a user agent string
    country_code   TEXT      NOT NULL DEFAULT '??',
    wallet_address TEXT,
    cache_hit      INTEGER   NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS request_log_ts_idx ON request_log (ts DESC);

-- Country lookups by IP hash, so one visitor costs one geo call rather than one per
-- request. Keyed by the hash, so this table never holds an address either.
CREATE TABLE IF NOT EXISTS ip_geo_cache (
    ip_hash      TEXT PRIMARY KEY,
    country_code TEXT NOT NULL DEFAULT '??',
    updated_at   TEXT NOT NULL
);
