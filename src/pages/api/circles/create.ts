/**
 * POST /api/circles/create — the operator starts a new circle (or savings group).
 *
 * It lands in `forming` (§5a): no rounds, no rotation yet — a named shell the
 * operator then fills, by seeding members (claim links) or dragging cards in while
 * it forms. Nothing is spendable is stored; the pot is derived, so a circle carries
 * no target of its own (the 0021 constraint enforces that).
 *
 * Owner/admin only, checked against tenant_memberships.role — a member cannot mint a
 * circle. This is where the operator's real programme finally gets real circles,
 * rather than the demo fixtures.
 */

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';

export const prerender = false;

const CADENCES = new Set(['weekly', 'biweekly', 'monthly']);
const TYPES = new Set(['circle', 'target_group']);

async function requireOwner(request: Request) {
	const session = await requireTenantSession(request);
	if (!session) return { error: 'unauthorized' as const, status: 401 };
	if (session.isDemo) return { error: 'forbidden' as const, status: 403 };
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
	const gate = await requireOwner(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

	const name = typeof body?.name === 'string' ? body.name.trim() : '';
	const type = typeof body?.type === 'string' ? body.type : 'circle';
	const cadence = typeof body?.cadence === 'string' ? body.cadence : 'weekly';
	const amount = Number(body?.expectedAmount);
	const graceDays = body?.graceDays == null ? 3 : Number(body.graceDays);
	const currency = typeof body?.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'USDC';

	if (!name) return json({ ok: false, error: 'missing_name' }, 400);
	if (!TYPES.has(type)) return json({ ok: false, error: 'bad_type' }, 400);
	if (!CADENCES.has(cadence)) return json({ ok: false, error: 'bad_cadence' }, 400);
	if (!Number.isFinite(amount) || amount <= 0) return json({ ok: false, error: 'bad_amount' }, 400);
	if (!Number.isFinite(graceDays) || graceDays < 0) return json({ ok: false, error: 'bad_grace' }, 400);

	// Savings groups may carry a per-member target; circles never (their pot is
	// derived — the 0021 CHECK refuses a target on a circle, so we don't send one).
	const targetAmount = type === 'target_group' && Number(body?.targetAmount) > 0 ? Number(body.targetAmount) : null;

	try {
		const id = crypto.randomUUID();
		await db.execute({
			sql: `INSERT INTO contracts
			        (id, tenant_id, type, name, currency, expected_amount, cadence, grace_days,
			         target_amount, status, created_at, updated_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'forming', now(), now())`,
			args: [id, gate.tenantId, type, name.slice(0, 120), currency, amount, cadence, graceDays, targetAmount],
		});
		return json({ ok: true, id, status: 'forming' });
	} catch (err) {
		console.error('[api/circles/create] failed', err);
		return json({ ok: false, error: 'create_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
