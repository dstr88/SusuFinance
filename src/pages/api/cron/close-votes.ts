/**
 * GET /api/cron/close-votes — resolve votes whose window has ended.
 *
 * The tallied thresholds (majority, blackball, unanimous_no) only decide at close;
 * this is what closes them. Idempotent — the status='open' guard makes a second run
 * a no-op — so any schedule is safe, and the drill-in also calls closeExpiredVotes
 * opportunistically so a lapsed vote resolves on the next view even if the cron is
 * not provisioned.
 *
 * Protected by CRON_SECRET (header x-cron-secret or ?secret=).
 */

import type { APIRoute } from 'astro';
import { closeExpiredVotes } from '@/lib/circles/votes';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
	const provided =
		request.headers.get('x-cron-secret') ??
		new URL(request.url).searchParams.get('secret');
	if (!secret || provided !== secret) {
		return json({ error: 'Unauthorized' }, 401);
	}

	try {
		const { resolved } = await closeExpiredVotes();
		return json({ ok: true, resolved });
	} catch (err) {
		console.error('[cron/close-votes] failed', err);
		return json({ ok: false, error: 'close_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
