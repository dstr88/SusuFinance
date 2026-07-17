/**
 * POST /api/me/address/verify — confirm her payout wallet against Almstins Verify.
 *
 * Verification is Verify's job — its own product, and every member is a Verify
 * customer. SusuFinance holds NO verification machinery of its own: it asks Verify's
 * public lookup whether this address is proven, and reflects the answer. Her own row
 * only; the app never reads a chain, sends, receives, or holds.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { checkAlmstinsVerify } from '@/lib/circles/almstinsVerify';

export const prerender = false;

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

		if (await checkAlmstinsVerify(address)) {
			await db.execute({
				sql: `UPDATE members SET address_verified_at = now(), updated_at = now()
				       WHERE tenant_id = ? AND user_id = ?`,
				args: [tenantId, userId],
			});
			return json({ ok: true, verified: true });
		}
		// Not proven with Verify (or Verify unreachable — fail-closed to not-verified).
		return json({ ok: true, verified: false, reason: 'not_in_verify' });
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
