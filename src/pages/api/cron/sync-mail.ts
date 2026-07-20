/**
 * GET /api/cron/sync-mail
 *
 * Polls every configured mailbox over IMAP and stores new messages in mail_messages,
 * which is what the two windows on /admin render.
 *
 * Protected by CRON_SECRET header or ?secret= query param — same shape as the other
 * crons here. Runs from GitHub Actions.
 *
 * NOTE ON SCHEDULING: scheduled workflows run from the repository's DEFAULT branch,
 * not from whatever is deployed. A workflow added only to a feature branch will never
 * fire, and a broken one fails silently unless curl is invoked with --fail. Both have
 * bitten this project before.
 *
 * Mailboxes are polled in sequence, not in parallel: cPanel IMAP servers cap concurrent
 * connections per account and per host, and four boxes racing is a reliable way to get
 * throttled for a build that saves under a second.
 */

import type { APIRoute } from 'astro';
import { getMailboxes, mailConfigStatus } from '@/lib/mailboxes';
import { pollMailbox, type PollResult } from '@/lib/mailSync';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const GET: APIRoute = async ({ request }) => {
	// ── Auth ───────────────────────────────────────────────────────────────────
	const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
	const provided =
		request.headers.get('x-cron-secret') ??
		new URL(request.url).searchParams.get('secret');

	if (!secret || provided !== secret) {
		console.warn('[cron/sync-mail] Unauthorized');
		return json({ error: 'Unauthorized' }, 401);
	}

	const status = mailConfigStatus();
	if (!status.configured) {
		// Not an error — mail simply isn't set up yet. A 200 keeps the workflow green
		// so a genuine failure later still stands out.
		return json({ ok: true, skipped: true, reason: status.reason });
	}

	const started = Date.now();
	const results: PollResult[] = [];

	for (const box of getMailboxes()) {
		results.push(await pollMailbox(box));
	}

	const inserted = results.reduce((n, r) => n + r.inserted, 0);
	const failed = results.filter((r) => r.error);

	if (failed.length) {
		console.warn('[cron/sync-mail] failures:', failed.map((f) => `${f.mailbox}: ${f.error}`).join(' · '));
	}

	return json({
		ok: true,
		elapsed_ms: Date.now() - started,
		mailboxes: results.length,
		inserted,
		failed: failed.length,
		results,
	});
};
