/**
 * POST /api/me/address/verify — confirm her payout wallet by self-send proof.
 *
 * She sends a tiny amount from her wallet to itself; this looks for that self-send
 * on-chain (read-only) and, if found in the recent window, stamps address_verified_at.
 * The app observes — it never sends, never receives, never holds. Her own row only.
 *
 * Fail-closed: an unconfigured/unreachable explorer returns "unavailable", never a
 * false verified. A non-EVM address returns "unsupported" (its reader isn't built).
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { checkSelfSend } from '@/lib/circles/selfSendVerify';
import { checkAlmstinsVerify } from '@/lib/circles/almstinsVerify';

export const prerender = false;

// She self-sends, then verifies — a generous window so a slow tap still catches it,
// short enough that an unrelated old self-send never counts.
const WINDOW_SECONDS = 6 * 60 * 60;

export const POST: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	if (session.isDemo) return json({ ok: false, error: 'demo_readonly' }, 403);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	const tenantId = session.tenantId;
	try {
		const meRes = await db.execute({
			sql: `SELECT payout_address FROM members WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
			args: [tenantId, userId],
		});
		if (!meRes.rows.length) return json({ ok: false, error: 'not_a_member' }, 403);
		const address = (meRes.rows[0] as any).payout_address ? String((meRes.rows[0] as any).payout_address) : '';
		if (!address) return json({ ok: false, error: 'no_address' }, 400);

		const markVerified = () => db.execute({
			sql: `UPDATE members SET address_verified_at = now(), updated_at = now()
			       WHERE tenant_id = ? AND user_id = ?`,
			args: [tenantId, userId],
		});

		// Path 1 — already proven with Almstins Verify (persistent proof, one call).
		if (await checkAlmstinsVerify(address)) {
			await markVerified();
			return json({ ok: true, verified: true, via: 'almstins_verify' });
		}

		// Path 2 — a fresh self-send observed on-chain.
		const sinceUnix = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;
		const result = await checkSelfSend(address, sinceUnix);

		if (result.status === 'verified') {
			await markVerified();
			return json({ ok: true, verified: true, via: 'self_send', chain: result.chain });
		}
		if (result.status === 'unavailable') {
			return json({ ok: false, error: 'unavailable' }, 503);
		}
		// not_found | unsupported — no verification, but not an error.
		return json({ ok: true, verified: false, reason: result.status });
	} catch (err) {
		console.error('[api/me/address/verify] failed', err);
		return json({ ok: false, error: 'verify_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
