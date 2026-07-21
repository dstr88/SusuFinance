/**
 * POST /api/circles/join — a logged-in person asks to join a formed group.
 *
 * The first step of the member path (§5a). She names a username, the group, and her
 * sponsor; this creates her member row (linked to her login) and opens an admission
 * vote. She is now a candidate — and per §6 she has NO contract_members row, so she
 * sees nothing of the circle until her sponsor's yes admits her.
 *
 * Thin wrapper: the mechanic lives in src/lib/circles/votes.ts.
 *
 * The candidate identifies her sponsor and group by id here; turning "who vouched
 * for me" (a name, or a code the sponsor sent) into those ids is the UI's job — a
 * candidate cannot browse the circle, so she brings the reference from outside.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { ensureMemberForUser, openAdmission, VoteError } from '@/lib/circles/votes';
import { isAdmissionsHeld } from '@/lib/platformSettings';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	if (session.isDemo) return json({ ok: false, error: 'demo_readonly' }, 403);

	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	// The admissions hold. Checked BEFORE anything is created or resolved, so a held
	// door leaves no member row, no candidacy, and no trace of the attempt.
	//
	// Fail-closed by construction (isAdmissionsHeld returns true on any error): the
	// door does not open because the thing guarding it broke.
	if (await isAdmissionsHeld()) return json({ ok: false, error: 'admissions_held' }, 403);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

	const username = typeof body?.username === 'string' ? body.username.trim() : '';
	const groupId = typeof body?.groupId === 'string' ? body.groupId : '';
	const sponsorMemberId = typeof body?.sponsorMemberId === 'string' ? body.sponsorMemberId : '';
	if (!username || !groupId || !sponsorMemberId) return json({ ok: false, error: 'missing_fields' }, 400);

	const tenantId = session.tenantId;

	try {
		// The group must exist in this programme, and be joinable (a formed/active
		// circle — you cannot request into a completed or abandoned one).
		const group = await db.execute({
			sql: `SELECT status FROM contracts WHERE tenant_id = ? AND id = ? LIMIT 1`,
			args: [tenantId, groupId],
		});
		if (!group.rows.length) return json({ ok: false, error: 'no_such_group' }, 404);
		const status = String((group.rows[0] as any).status);
		if (status !== 'active' && status !== 'forming') {
			return json({ ok: false, error: 'group_not_joinable' }, 409);
		}

		// The sponsor must be a live member of that group — you cannot be vouched by
		// someone who is not in the circle.
		const sponsor = await db.execute({
			sql: `SELECT 1 FROM contract_members
			       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL LIMIT 1`,
			args: [tenantId, groupId, sponsorMemberId],
		});
		if (!sponsor.rows.length) return json({ ok: false, error: 'sponsor_not_in_group' }, 409);

		const memberId = await ensureMemberForUser(tenantId, userId, { username });
		if (memberId === sponsorMemberId) return json({ ok: false, error: 'cannot_sponsor_self' }, 409);

		const { voteId } = await openAdmission({
			tenantId,
			contractId: groupId,
			candidateMemberId: memberId,
			sponsorMemberId,
		});

		return json({ ok: true, voteId, status: 'pending' });
	} catch (err) {
		if (err instanceof VoteError) return json({ ok: false, error: err.code, message: err.message }, 409);
		console.error('[api/circles/join] failed', err);
		return json({ ok: false, error: 'join_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
