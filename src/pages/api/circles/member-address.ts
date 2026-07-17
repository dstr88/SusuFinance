/**
 * POST /api/circles/member-address — the operator sets a member's payout wallet.
 *
 * For a member the organizer seeded who has not claimed a login yet (so she cannot
 * use her own account modal), he sets the wallet where her turn pays — an operational
 * setup step, not a look into her record. The payout address is circle-operational:
 * the whole group sends the pot there on her turn. Still no custody — the app records
 * the address she controls, never a key.
 *
 * Owner/admin only, scoped to his own tenant (he can only touch a member in his own
 * programme). One field sets both wallet_address + payout_address; changing clears
 * address_verified_at (unproven until a self-send). Once she claims her login she can
 * change it herself in her account modal.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';

export const prerender = false;

const ADDRESS_RE = /^[A-Za-z0-9:_-]{20,120}$/;

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
	const raw = typeof body?.address === 'string' ? body.address.trim() : '';
	if (!memberId) return json({ ok: false, error: 'missing_member' }, 400);
	const address = raw === '' ? null : raw;
	if (address !== null && !ADDRESS_RE.test(address)) return json({ ok: false, error: 'bad_address' }, 400);

	try {
		const res = await db.execute({
			sql: `UPDATE members
			         SET wallet_address = ?, payout_address = ?, address_verified_at = NULL, updated_at = now()
			       WHERE tenant_id = ? AND id = ?
			       RETURNING id`,
			args: [address, address, gate.tenantId, memberId],
		});
		if (!res.rows.length) return json({ ok: false, error: 'not_found' }, 404);
		return json({ ok: true, address });
	} catch (err: any) {
		if (/unique|duplicate|members_tenant_wallet/i.test(String(err?.message ?? ''))) {
			return json({ ok: false, error: 'address_taken' }, 409);
		}
		console.error('[api/circles/member-address] failed', err);
		return json({ ok: false, error: 'save_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
