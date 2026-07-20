/**
 * analytics.ts — record one request.
 *
 * Extracted from app.ts so it can be loaded WITHOUT the rest of the app middleware.
 *
 * Public paths — the homepage, /howTo, /login, every marketing page — short-circuit in
 * middleware.ts before app.ts is ever imported. That is deliberate: a module-level
 * throw in any of app.ts's dependencies must never be able to take down login. The side
 * effect was that none of those requests were counted, so the traffic chart measured
 * authenticated app routes only — the opposite of "website traffic".
 *
 * Living in its own module, the writer can be dynamically imported AFTER a response
 * already exists. If it throws, the page has already been served, so the safety
 * property that motivated the short-circuit still holds.
 */

import { db } from '../lib/db';
import { getCountryForIpHash } from '../lib/analytics/geoip';
import { hashWithSalt } from '../lib/analytics/hash';
import { getClientIp } from '../lib/analytics/ip';
import { extractWalletAddress, isDetailedAnalyticsRoute, normalizeRouteKey } from '../lib/analytics/routes';

export async function writeRequestAnalyticsBestEffort(request: Request, response: Response, startedAt: number) {
	try {
		await writeRequestAnalytics(request, response, startedAt);
	} catch (error) {
		console.warn('[analytics] write failed', error instanceof Error ? error.message : String(error));
	}
}

async function writeRequestAnalytics(request: Request, response: Response, startedAt: number) {
	const url = new URL(request.url);
	const pathname = url.pathname;
	const routeKey = normalizeRouteKey(pathname);
	const method = request.method.toUpperCase();
	const status = response.status;
	const ms = Math.max(0, Date.now() - startedAt);
	const ts = new Date().toISOString();
	const day = ts.slice(0, 10);

	const ipRaw = getClientIp(request);
	const ipHash = hashWithSalt(ipRaw ?? 'no-ip');
	const uaHash = hashWithSalt(request.headers.get('user-agent') ?? 'no-ua');
	const geo = await getCountryForIpHash(ipHash, ipRaw);
	const countryCode = geo.countryCode;

	await db.execute({
		sql: `
			INSERT INTO request_agg_daily (
				day, route_key, method, status, country_code, count, ms_total, ms_max
			) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
			ON CONFLICT(day, route_key, method, status, country_code) DO UPDATE SET
				count = request_agg_daily.count + 1,
				ms_total = request_agg_daily.ms_total + excluded.ms_total,
				ms_max = CASE WHEN excluded.ms_max > request_agg_daily.ms_max THEN excluded.ms_max ELSE request_agg_daily.ms_max END
		`,
		args: [day, routeKey, method, status, countryCode, ms, ms],
	});

	if (!isDetailedAnalyticsRoute(routeKey)) {
		return;
	}

	await db.execute({
		sql: `
			INSERT INTO request_log (
				ts, route, route_key, method, status, ms, ip_hash, ua_hash, country_code, wallet_address, cache_hit
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
		args: [
			ts,
			pathname,
			routeKey,
			method,
			status,
			ms,
			ipHash,
			uaHash,
			countryCode,
			extractWalletAddress(pathname),
			geo.cacheHit ? 1 : 0,
		],
	});
}
