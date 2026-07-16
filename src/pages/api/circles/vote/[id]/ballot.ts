/**
 * POST /api/circles/vote/:id/ballot — cast a ballot on an open vote.
 *
 * The one endpoint behind every vote kind. For a `sponsor` admission it is the
 * sponsor's vouch (her yes admits the candidate on the spot); for a `majority`
 * proposal it is one member's yes/no, tallied at close; and it will carry the
 * blackball and expulsion ballots when those thresholds are wired.
 *
 * The caster must already BE a member of this programme — a candidate cannot vote,
 * and neither can a logged-in stranger. Eligibility per vote kind (only the sponsor
 * decides a sponsor vote; the subject can never vote on herself) lives in the lib.
 *
 * Thin wrapper: castBallot in src/lib/circles/votes.ts does the work, including
 * resolving the vote and admitting the member when a sponsor says yes.
 */

import type { APIRoute } from 'astro';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { castBallot, getMemberForUser, VoteError, type Ballot } from '@/lib/circles/votes';

export const prerender = false;

const BALLOTS: Ballot[] = ['yes', 'no', 'abstain'];

export const POST: APIRoute = async ({ request, params }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	if (session.isDemo) return json({ ok: false, error: 'demo_readonly' }, 403);

	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	const voteId = params.id ?? '';
	if (!voteId) return json({ ok: false, error: 'missing_vote' }, 400);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const ballot = body?.ballot as Ballot;
	if (!BALLOTS.includes(ballot)) return json({ ok: false, error: 'bad_ballot' }, 400);

	const tenantId = session.tenantId;

	try {
		const memberId = await getMemberForUser(tenantId, userId);
		if (!memberId) return json({ ok: false, error: 'not_a_member' }, 403);

		const result = await castBallot({ tenantId, voteId, memberId, ballot });
		return json({ ok: true, ...result });
	} catch (err) {
		if (err instanceof VoteError) return json({ ok: false, error: err.code, message: err.message }, 409);
		console.error('[api/circles/vote/ballot] failed', err);
		return json({ ok: false, error: 'ballot_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
