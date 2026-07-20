/**
 * GET /api/admin/traffic?view=day|week|month
 *   → a bucketed hit count series for the traffic chart
 *
 *   day   · last 30 days,   one point per day
 *   week  · last 26 weeks,  one point per ISO week
 *   month · last 12 months, one point per month
 *
 * Reads request_agg_daily, the rollup the middleware writes on every request. Bucketing
 * happens in SQL rather than in the browser: sending a year of daily rows to draw twelve
 * bars wastes the trip, and the database groups dates better than JavaScript does.
 */

import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/adminGuard';
import { db } from '@/lib/db';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

/** Bucket width, window, and label format per view. */
const VIEWS = {
	day:   { trunc: 'day',   days: 30,  label: 'YYYY-MM-DD' },
	week:  { trunc: 'week',  days: 182, label: 'YYYY-MM-DD' },
	month: { trunc: 'month', days: 365, label: 'YYYY-MM' },
} as const;

export const GET: APIRoute = async ({ request }) => {
	try { await requireAdminSession(request); }
	catch (resp) { return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401); }

	const view = (new URL(request.url).searchParams.get('view') ?? 'day') as keyof typeof VIEWS;
	const cfg = VIEWS[view] ?? VIEWS.day;

	try {
		// `day` is stored as TEXT (YYYY-MM-DD), so it is cast before truncating. Errors
		// here are reported rather than swallowed: this endpoint exists BECAUSE a silent
		// failure made missing tables look like zero traffic for weeks.
		const r = await db.execute({
			sql: `SELECT to_char(date_trunc('${cfg.trunc}', day::date), '${cfg.label}') AS bucket,
			             SUM(count)::bigint AS hits,
			             SUM(CASE WHEN status >= 500 THEN count ELSE 0 END)::bigint AS errors
			      FROM request_agg_daily
			      WHERE day::date >= (CURRENT_DATE - INTERVAL '${cfg.days} days')
			      GROUP BY 1
			      ORDER BY 1`,
			args: [],
		});

		const points = (r.rows as Record<string, unknown>[]).map((row) => ({
			bucket: String(row.bucket),
			hits: Number(row.hits ?? 0),
			errors: Number(row.errors ?? 0),
		}));

		return json({ ok: true, view, points, total: points.reduce((n, p) => n + p.hits, 0) });
	} catch (err) {
		return json({ ok: false, error: err instanceof Error ? err.message : 'Query failed' }, 500);
	}
};
