/**
 * POST /api/admin/pool-alerts
 *
 *   { tenantId, kind, address, note } → mark a pooling finding explained
 *
 * The note is required, and stored. A finding waved away with no reason is just a red
 * dot someone made disappear; the explanation is the thing worth keeping, because the
 * next person to see the same address deserves to know it was already answered.
 *
 * Resolved rows are kept rather than deleted. If the condition recurs, poolWatch bumps
 * last_seen on the same row — so the record of having explained it once survives, and a
 * finding that was explained does not come back looking new.
 *
 * Guarded by requireAdminSession, matching the rest of /api/admin. This is the platform
 * admin surface, which runs without tenant context by design; tenantId here identifies
 * WHICH finding, and is never used to widen what anyone may read.
 */

import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/adminGuard';
import { db } from '@/lib/db';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const POST: APIRoute = async ({ request }) => {
	let who;
	try {
		who = await requireAdminSession(request);
	} catch (resp) {
		return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401);
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, 400);
	}

	const tenantId = String(body.tenantId ?? '').trim();
	const kind = String(body.kind ?? '').trim();
	const address = String(body.address ?? '').trim().toLowerCase();
	const note = String(body.note ?? '').trim();

	if (!tenantId || !address) return json({ ok: false, error: 'tenantId and address are required' }, 400);
	if (kind !== 'shared_address' && kind !== 'common_sink') {
		return json({ ok: false, error: 'Unknown kind' }, 400);
	}
	if (!note) return json({ ok: false, error: 'An explanation is required' }, 400);

	// Who accepted the explanation is part of the record. "Someone looked at this" is
	// worth much less than "this person looked at this, on this date, and said why".
	const stamped = `${note} — ${who.email} ${new Date().toISOString().slice(0, 10)}`;

	const res = await db.execute({
		sql: `UPDATE pool_alerts
		         SET resolved_at = now(), resolved_note = ?
		       WHERE tenant_id = ? AND kind = ? AND address = ? AND resolved_at IS NULL`,
		args: [stamped, tenantId, kind, address],
	});

	if (!res.rowsAffected) return json({ ok: false, error: 'No open finding matched' }, 404);
	return json({ ok: true });
};
