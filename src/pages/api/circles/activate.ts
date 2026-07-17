/**
 * POST /api/circles/activate — the operator brings a forming circle to life.
 *
 * While forming, the group arranges its turn order (§5b). Activation freezes that
 * order into the rotation: one scheduled round per turn slot, recipient = the member
 * in that slot, due dates spaced by the circle's cadence. After this, the operator
 * drives the rotation with open-round (which carries the live Verify gate).
 *
 * The turn order the group agreed is recorded, never invented: rounds come straight
 * from contract_members.turn_order. A member with no turn (saving at her own pace)
 * simply gets no payout round. Circles rotate; a target group has no rounds, so
 * activating one just flips it to active.
 *
 * Owner/admin only, own tenant. Idempotent by the status='forming' guard — a second
 * call (or a race) finds it already active and does nothing.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';

export const prerender = false;

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

/** Round k (1-based turn slot) due date = activation date + k cadence periods. */
function dueDate(base: Date, k: number, cadence: string): string {
	const d = new Date(base.getTime());
	if (cadence === 'monthly') d.setMonth(d.getMonth() + k);
	else d.setDate(d.getDate() + k * (cadence === 'biweekly' ? 14 : 7));
	return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export const POST: APIRoute = async ({ request }) => {
	const gate = await requireOperator(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);
	const tenantId = gate.tenantId;

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const contractId = typeof body?.contractId === 'string' ? body.contractId : '';
	if (!contractId) return json({ ok: false, error: 'missing_contract' }, 400);

	try {
		const cRes = await db.execute({
			sql: `SELECT type, cadence, status FROM contracts WHERE tenant_id = ? AND id = ? LIMIT 1`,
			args: [tenantId, contractId],
		});
		if (!cRes.rows.length) return json({ ok: false, error: 'not_found' }, 404);
		const c: any = cRes.rows[0];
		if (String(c.status) !== 'forming') return json({ ok: false, error: 'not_forming' }, 409);
		const isCircle = String(c.type) === 'circle';
		const cadence = String(c.cadence);

		// The turn order the group agreed — the rotation, in slot order.
		let turnHolders: { memberId: string; slot: number }[] = [];
		if (isCircle) {
			const mRes = await db.execute({
				sql: `SELECT member_id, turn_order FROM contract_members
				       WHERE tenant_id = ? AND contract_id = ? AND left_at IS NULL AND turn_order IS NOT NULL
				       ORDER BY turn_order ASC`,
				args: [tenantId, contractId],
			});
			turnHolders = (mRes.rows as any[]).map((r) => ({ memberId: String(r.member_id), slot: Number(r.turn_order) }));
			// A rotation needs at least two people to rotate between.
			if (turnHolders.length < 2) return json({ ok: false, error: 'need_two_turns' }, 409);
		}

		// Flip forming → active FIRST — the guard is the lock, so only one activation
		// wins and no rounds are duplicated by a race.
		const flip = await db.execute({
			sql: `UPDATE contracts SET status = 'active', updated_at = now()
			       WHERE tenant_id = ? AND id = ? AND status = 'forming'`,
			args: [tenantId, contractId],
		});
		if ((flip.rowsAffected ?? 0) === 0) return json({ ok: false, error: 'not_forming' }, 409);

		// Create the rotation (circles only). Slot = round_index = her turn.
		const base = new Date();
		for (const th of turnHolders) {
			await db.execute({
				sql: `INSERT INTO rounds (id, tenant_id, contract_id, round_index, recipient_member_id, due_date, status, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, 'scheduled', now())`,
				args: [crypto.randomUUID(), tenantId, contractId, th.slot, th.memberId, dueDate(base, th.slot, cadence)],
			});
		}

		await db.execute({
			sql: `INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
			      VALUES (?, ?, 'organizer', 'contract_activated', ?, now())`,
			args: [tenantId, contractId, JSON.stringify({ rounds: turnHolders.length })],
		});

		return json({ ok: true, activated: { rounds: turnHolders.length } });
	} catch (err) {
		console.error('[api/circles/activate] failed', err);
		return json({ ok: false, error: 'activate_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
