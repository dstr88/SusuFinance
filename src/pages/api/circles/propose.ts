/**
 * POST /api/circles/propose — a member puts a question to her circle.
 *
 * The "vote on anything" feature (Jul 16). Any live member of the circle may open a
 * majority proposal; it is advisory — the app records the group's decision, never
 * enforces it. The caster must BE a member of the circle (not the operator qua
 * operator, not a stranger): the circle governs itself.
 *
 * Thin wrapper over openProposal in the votes lib.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { getMemberForUser, openProposal, VoteError } from '@/lib/circles/votes';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	if (session.isDemo) return json({ ok: false, error: 'demo_readonly' }, 403);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const contractId = typeof body?.contractId === 'string' ? body.contractId : '';
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	if (!contractId || !title) return json({ ok: false, error: 'missing_fields' }, 400);

	const tenantId = session.tenantId;
	try {
		const memberId = await getMemberForUser(tenantId, userId);
		if (!memberId) return json({ ok: false, error: 'not_a_member' }, 403);

		// She must be a LIVE member of this specific circle to put a question to it.
		const member = await db.execute({
			sql: `SELECT 1 FROM contract_members
			       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL LIMIT 1`,
			args: [tenantId, contractId, memberId],
		});
		if (!member.rows.length) return json({ ok: false, error: 'not_in_circle' }, 403);

		const { voteId } = await openProposal({ tenantId, contractId, byMemberId: memberId, title: title.slice(0, 280) });
		return json({ ok: true, voteId });
	} catch (err) {
		if (err instanceof VoteError) return json({ ok: false, error: err.code, message: err.message }, 409);
		console.error('[api/circles/propose] failed', err);
		return json({ ok: false, error: 'propose_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
