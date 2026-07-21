/**
 * POST /api/circles/join-request — a new person asks to join, by NAME.
 *
 * The self-serve half of §5a admission. Unlike /api/circles/join (which takes ids
 * and a tenant session), the person here is a fresh login with NO tenant — the gate
 * returns null for a 3rd+ human — and she cannot browse the circle to pick ids from
 * a list. So she TYPES: her username, the group's name, and her sponsor's name. The
 * server resolves those to ids, creates her candidacy, and points her session at the
 * programme.
 *
 * Requires a login (getAuthSession) but NOT a tenant (requireTenantSession would
 * 401 a tenant-less candidate — the very person this endpoint is for).
 *
 * SINGLE-PROGRAMME assumption (valid today, one operator): the target programme is
 * the one tenant that has memberships. When a second programme ever exists, a
 * typed group name no longer identifies the tenant, and the sponsor's invite code
 * (which carries the tenant) becomes the required path. Guarded below: >1 programme
 * refuses rather than guessing.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { getAuthSession } from '@/lib/authSession';
import { ensureMemberForUser, openAdmission, VoteError } from '@/lib/circles/votes';
import { isAdmissionsHeld } from '@/lib/platformSettings';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
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
	const groupName = typeof body?.groupName === 'string' ? body.groupName.trim() : '';
	const sponsorName = typeof body?.sponsorName === 'string' ? body.sponsorName.trim() : '';
	if (!username || !groupName || !sponsorName) return json({ ok: false, error: 'missing_fields' }, 400);

	try {
		// The single programme. >1 → we cannot tell which from a group name alone.
		const progs = await db.execute({
			sql: `SELECT DISTINCT tenant_id FROM tenant_memberships LIMIT 2`,
			args: [],
		});
		if (progs.rows.length === 0) return json({ ok: false, error: 'no_programme_yet' }, 409);
		if (progs.rows.length > 1) return json({ ok: false, error: 'needs_invite_code' }, 409);
		const tenantId = String((progs.rows[0] as any).tenant_id);

		// Resolve the group by name — case-insensitive, joinable only. Ambiguity is
		// possible in theory; a UNIQUE-ish name is the norm, and we take the first.
		const group = await db.execute({
			sql: `SELECT id FROM contracts
			       WHERE tenant_id = ? AND lower(name) = lower(?) AND status IN ('active','forming')
			       ORDER BY created_at LIMIT 1`,
			args: [tenantId, groupName],
		});
		if (!group.rows.length) return json({ ok: false, error: 'group_not_found' }, 404);
		const groupId = String((group.rows[0] as any).id);

		// Resolve the sponsor by display name among that group's live members. If more
		// than one member shares the name, we cannot safely pick — ask for her code.
		const sponsors = await db.execute({
			sql: `SELECT m.id FROM members m
			        JOIN contract_members cm ON cm.member_id = m.id AND cm.contract_id = ?
			       WHERE cm.tenant_id = ? AND cm.left_at IS NULL AND lower(m.display_name) = lower(?)
			       LIMIT 2`,
			args: [groupId, tenantId, sponsorName],
		});
		if (sponsors.rows.length === 0) return json({ ok: false, error: 'sponsor_not_found' }, 404);
		if (sponsors.rows.length > 1) return json({ ok: false, error: 'sponsor_ambiguous' }, 409);
		const sponsorMemberId = String((sponsors.rows[0] as any).id);

		const memberId = await ensureMemberForUser(tenantId, userId, { username });
		if (memberId === sponsorMemberId) return json({ ok: false, error: 'cannot_sponsor_self' }, 409);

		const { voteId } = await openAdmission({
			tenantId,
			contractId: groupId,
			candidateMemberId: memberId,
			sponsorMemberId,
		});

		// NO tenant grant here, deliberately.
		//
		// This used to set auth_users.active_tenant_id the instant she asked, so that
		// "she resolves as a member from here on". She is not a member yet — that is
		// the entire point of the vote about to happen. Granting the tenant at request
		// time meant anyone who signed up and guessed a circle name plus one member's
		// display name could open /dashboard/circles and read the whole programme
		// while her admission was still pending. The vote gated her membership and
		// nothing gated her access.
		//
		// The grant now lives in admitMember (lib/circles/votes.ts), which runs when
		// the sponsor says yes. Asking gets her a pending state and the lobby message
		// that explains it; approval gets her in.
		return json({ ok: true, voteId, status: 'pending', sponsorName, groupName });
	} catch (err) {
		if (err instanceof VoteError) return json({ ok: false, error: err.code, message: err.message }, 409);
		console.error('[api/circles/join-request] failed', err);
		return json({ ok: false, error: 'join_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
