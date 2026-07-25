/**
 * GET /api/cron/reminders
 *
 * Sends contribution reminders. Protected by CRON_SECRET, same shape as the other
 * crons here, and run from GitHub Actions.
 *
 * Behavior-conditional and idempotent: it only ever reads contributions that are
 * still `pending`, so a paid contribution is silent, and every notice is claimed by a
 * unique key so running this hourly never nags twice. It sends; it never signs, holds,
 * or moves anything.
 *
 * Scheduled workflows run from the repository's DEFAULT branch, and curl needs --fail
 * or an HTTP error exits 0 and the run reports green while nothing was sent. Both have
 * bitten this project before.
 */

import type { APIRoute } from 'astro';
import { runDueReminders } from '@/lib/circles/notifications';

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
		console.warn('[cron/reminders] Unauthorized');
		return json({ error: 'Unauthorized' }, 401);
	}

	const started = Date.now();
	const result = await runDueReminders();

	if (result.errors.length) {
		console.warn('[cron/reminders]', result.errors.join(' · '));
	}

	return json({
		ok: true,
		elapsed_ms: Date.now() - started,
		...result,
	});
};
