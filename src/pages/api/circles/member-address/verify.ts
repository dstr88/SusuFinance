/**
 * POST /api/circles/member-address/verify — operator confirms a member's payout
 * wallet by self-send proof, on her behalf.
 *
 * She (the seeded member) does the self-send from her own wallet — a real-world
 * on-chain action, no app login required. The operator then triggers the observation.
 * The app watches the chain read-only; it never sends, receives, or holds. Owner/admin
 * only, scoped to his own tenant.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { checkSelfSend } from '@/lib/circles/selfSendVerify';

export const prerender = false;

const WINDOW_SECONDS = 6 * 60 * 60;

async function requireOperator(request: Request) {
	const session = await requireTenantSession(request);
	if (!session) return { error: 'unauthorized' as const, status: 401 };
	if (session.isDemo) return { error: 'demo_readonly' as const, status: 403 };
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return { error: 'unauthorized' as const, status: 401 };
	const res = await db.execute({
		sql: `SELECT role FROM tenant_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
		args: [session.tenantId, userId],
	});
	const role = res.rows[0] ? String((res.rows[0] as any).role ?? '') : '';
	if (role !== 'owner' && role !== 'admin') return { error: 'forbidden' as const, status: 403 };
	return { tenantId: session.tenantId };
}

export const POST: APIRoute = async ({ request }) => {
	const gate = await requireOperator(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const memberId = typeof body?.memberId === 'string' ? body.memberId : '';
	if (!memberId) return json({ ok: false, error: 'missing_member' }, 400);

	try {
		const meRes = await db.execute({
			sql: `SELECT payout_address FROM members WHERE tenant_id = ? AND id = ? LIMIT 1`,
			args: [gate.tenantId, memberId],
		});
		if (!meRes.rows.length) return json({ ok: false, error: 'not_found' }, 404);
		const address = (meRes.rows[0] as any).payout_address ? String((meRes.rows[0] as any).payout_address) : '';
		if (!address) return json({ ok: false, error: 'no_address' }, 400);

		const result = await checkSelfSend(address, Math.floor(Date.now() / 1000) - WINDOW_SECONDS);
		if (result.status === 'verified') {
			await db.execute({
				sql: `UPDATE members SET address_verified_at = now(), updated_at = now()
				       WHERE tenant_id = ? AND id = ?`,
				args: [gate.tenantId, memberId],
			});
			return json({ ok: true, verified: true, chain: result.chain });
		}
		if (result.status === 'unavailable') return json({ ok: false, error: 'unavailable' }, 503);
		return json({ ok: true, verified: false, reason: result.status });
	} catch (err) {
		console.error('[api/circles/member-address/verify] failed', err);
		return json({ ok: false, error: 'verify_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
