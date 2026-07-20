/**
 * GET  /api/admin/circles/board     → { signups, circles }
 * POST /api/admin/circles/board     → assign one signup, or generate a group
 *
 *   { action: 'assign', memberId, contractId }
 *       forming circle → seat them directly (§5a organizer seeding)
 *       active circle  → open an admission vote; the group still decides
 *
 *   { action: 'group', name, expectedAmount, cadence, memberIds[] }
 *       create a forming circle and seat the selected people in it
 *
 * ── Tenant scoping ──────────────────────────────────────────────────────────
 * The tenant comes from the ADMIN'S OWN SESSION, never from the request body. /admin
 * runs with no tenant context by design, so RLS is not there to catch a mistake here;
 * accepting a tenantId from the client would let a crafted request move a member
 * between tenants, which is the one thing this architecture must never allow.
 */

import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/adminGuard';
import { getAuthSession } from '@/lib/authSession';
import { createGroup, getBoardCircles, getSignups, seatMember } from '@/lib/circles/board';
import { getMemberForUser, openAdmission } from '@/lib/circles/votes';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

/** Admin identity plus the tenant whose board they are looking at. */
async function context(request: Request) {
	const admin = await requireAdminSession(request);
	const session = await getAuthSession(request).catch(() => null);
	const tenantId = String(session?.tenantId ?? '');
	return { admin, tenantId, userId: admin.userId };
}

export const GET: APIRoute = async ({ request }) => {
	let ctx;
	try { ctx = await context(request); }
	catch (resp) { return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401); }
	if (!ctx.tenantId) return json({ ok: false, error: 'No tenant on this session.' }, 400);

	const [signups, circles] = await Promise.all([
		getSignups(ctx.tenantId),
		getBoardCircles(ctx.tenantId),
	]);

	return json({ ok: true, signups, circles });
};

export const POST: APIRoute = async ({ request }) => {
	let ctx;
	try { ctx = await context(request); }
	catch (resp) { return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401); }
	if (!ctx.tenantId) return json({ ok: false, error: 'No tenant on this session.' }, 400);

	let body: Record<string, unknown>;
	try { body = await request.json(); }
	catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

	const action = String(body.action ?? '');

	// ── Generate a group ─────────────────────────────────────────────────────
	if (action === 'group') {
		// An empty tin is allowed: the operator creates it, then drags people in. Refusing
		// would mean the only way to make a tin is to already have people picked for it.
		const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(String) : [];

		const result = await createGroup({
			tenantId: ctx.tenantId,
			name: String(body.name ?? ''),
			expectedAmount: String(body.expectedAmount ?? ''),
			cadence: (String(body.cadence ?? 'monthly') as 'weekly' | 'biweekly' | 'monthly'),
			memberIds,
		});
		return result.ok ? json({ ok: true, contractId: result.contractId }) : json(result, 400);
	}

	// ── Assign one person to an existing circle ──────────────────────────────
	if (action === 'assign') {
		const memberId = String(body.memberId ?? '');
		const contractId = String(body.contractId ?? '');
		if (!memberId || !contractId) return json({ ok: false, error: 'memberId and contractId are required.' }, 400);

		const seated = await seatMember(ctx.tenantId, contractId, memberId);
		if (seated.ok) return json({ ok: true, outcome: 'seated' });

		// Not forming — so this becomes a proposal to the group rather than an act.
		// The operator sponsors it; the members decide.
		const sponsorMemberId = await getMemberForUser(ctx.tenantId, ctx.userId);
		if (!sponsorMemberId) {
			return json({
				ok: false,
				error: 'Admission on an active circle needs a sponsor, and this admin account has no member record in the programme.',
			}, 409);
		}

		try {
			const { voteId } = await openAdmission({
				tenantId: ctx.tenantId,
				contractId,
				candidateMemberId: memberId,
				sponsorMemberId,
			});
			return json({ ok: true, outcome: 'vote_opened', voteId });
		} catch (err) {
			return json({ ok: false, error: err instanceof Error ? err.message : 'Could not open the vote.' }, 409);
		}
	}

	return json({ ok: false, error: 'Unknown action.' }, 400);
};
