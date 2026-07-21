/**
 * GET /api/cron/observe-payments
 *
 * Marks contributions paid by reading the chain. Protected by CRON_SECRET, same shape
 * as the other crons here, and run from GitHub Actions.
 *
 * Reads only. It never sends, signs, or holds anything — every write is to our own
 * record of what already happened on a public chain.
 *
 * Scheduled workflows run from the repository's DEFAULT branch, and curl needs --fail
 * or an HTTP error exits 0 and the run reports green while nothing was observed. Both
 * have bitten this project before.
 */

import type { APIRoute } from 'astro';
import { observePayments } from '@/lib/circles/observePayments';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const GET: APIRoute = async ({ request }) => {
	const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
	const provided =
		request.headers.get('x-cron-secret') ??
		new URL(request.url).searchParams.get('secret');

	if (!secret || provided !== secret) {
		console.warn('[cron/observe-payments] Unauthorized');
		return json({ error: 'Unauthorized' }, 401);
	}

	const started = Date.now();
	const result = await observePayments();

	if (result.errors.length) {
		console.warn('[cron/observe-payments]', result.errors.join(' · '));
	}

	return json({
		ok: true,
		elapsed_ms: Date.now() - started,
		chain: process.env.SUSU_CHAIN_ID ?? '1',
		...result,
	});
};
