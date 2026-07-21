/**
 * GET /api/cron/pool-watch
 *
 * Checks the chain for signs that member funds are being pooled somewhere upstream —
 * a shared deposit address, or one address collecting from several members.
 *
 * This is how "no pot, ever" is held against a partner rather than merely asked of one.
 * The app cannot prevent a wallet provider from pooling; it can notice.
 *
 * Protected by CRON_SECRET, same shape as the other crons here, run from GitHub Actions.
 * Reads only — every write is to our own record of a finding.
 */

import type { APIRoute } from 'astro';
import { runPoolWatch } from '@/lib/circles/poolWatch';

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
		console.warn('[cron/pool-watch] Unauthorized');
		return json({ error: 'Unauthorized' }, 401);
	}

	const started = Date.now();
	const result = await runPoolWatch();

	// Findings are logged as well as stored. A pooling signal is the one alert that
	// should not wait for someone to open a panel.
	if (result.sharedAddresses || result.commonSinks) {
		console.warn(
			`[cron/pool-watch] POOLING SIGNAL — shared:${result.sharedAddresses} sink:${result.commonSinks}`,
		);
	}
	if (result.errors.length) {
		console.warn('[cron/pool-watch]', result.errors.join(' · '));
	}

	return json({
		ok: true,
		elapsed_ms: Date.now() - started,
		chain: process.env.SUSU_CHAIN_ID ?? '1',
		...result,
	});
};
