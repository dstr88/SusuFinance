/**
 * GET /api/circles/:id — one tin, opened. THE OPERATOR'S VIEW.
 *
 * ── What this endpoint deliberately does not know ────────────────────────────
 *
 * It returns NO payment record. Not whether she paid, not whether she was on time,
 * not her totals, not her net. That is her record, it belongs to her, and it lives
 * on her screen — for her to show a lender when SHE decides it is time.
 *
 * The operator's need is narrow, and this is all of it: who is in the group, who
 * has left, whose turn it is, whether her payout address is verified, and (when
 * circle_votes exists) whether a vote is open on her joining or leaving. He
 * administers the programme; he does not police it.
 *
 * ── Why, from §5a ────────────────────────────────────────────────────────────
 *
 * "Inside the circle = full shared ledger (transparency IS the enforcement)." The
 * CIRCLE sees who paid, and the circle enforces. The organizer never needed the
 * supervisory view — an earlier cut of this endpoint built him one anyway, which
 * was the design answering a question nobody asked. The group judges; the platform
 * remembers; the operator administers. Three roles, none of them borrowed.
 *
 * ── The refusal is structural, not a UI policy ───────────────────────────────
 *
 * This endpoint does not query the `contributions` table AT ALL. Not filtered, not
 * fetched-and-dropped — never read. So no admin surface can render her record,
 * leak it, or be tempted to sort by it, and no future edit here can quietly
 * reintroduce it without someone deliberately writing the query back. Same shape as
 * the schema having no balance column and no pooled address: the guarantee is what
 * is absent.
 *
 * Aggregates are untouched and live elsewhere (/api/circles, the stats page):
 * "% early / on-time / late / behind", trend by round index, completion rate — they
 * compute from payment data and name nobody. "Aggregates only, no member rows" was
 * already the rule for the programme report; it is now the rule for the whole admin
 * surface.
 *
 * Isolation: every statement filters WHERE tenant_id, from the session only.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { hasCircleAccess } from '@/lib/circles/circleAccess';
import { closeExpiredVotes } from '@/lib/circles/votes';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);

	// A tenant is not an entitlement — see lib/circles/circleAccess.ts. Guarding the
	// page alone would be theatre: this endpoint is the thing that hands over the data.
	const viewer = await getAuthSession(request).catch(() => null);
	const viewerId = viewer?.user?.id ? String(viewer.user.id) : '';
	if (!(await hasCircleAccess(session.tenantId, viewerId, session.isDemo))) {
		return json({ ok: false, error: 'forbidden' }, 403);
	}
	const tenantId = session.tenantId;
	const contractId = String(params.id ?? '');
	if (!contractId) return json({ ok: false, error: 'bad_request' }, 400);

	// Opportunistic close: resolve any of this programme's lapsed votes on view, so a
	// tallied outcome lands even if the cron is not provisioned. Non-fatal.
	await closeExpiredVotes(tenantId).catch(() => { /* the drill-in still loads */ });

	try {
		const cRes = await db.execute({
			sql: `SELECT id, type, name, currency, cadence, status,
			             expected_amount::float8 AS expected_amount,
			             target_amount::float8   AS target_amount,
			             target_date::text       AS target_date
			        FROM contracts WHERE tenant_id = ? AND id = ?`,
			args: [tenantId, contractId],
		});
		if (!cRes.rows.length) return json({ ok: false, error: 'not_found' }, 404);
		const c: any = cRes.rows[0];

		// Memberships — including departed ones. A departure is part of the group's
		// record, not a deletion: her row keeps its turn_order forever.
		const mRes = await db.execute({
			sql: `SELECT cm.member_id, cm.turn_order, cm.joined_at::text AS joined_at,
			             cm.left_at::text AS left_at,
			             m.display_name, m.payout_address, m.address_verified_at::text AS address_verified_at,
			             (m.user_id IS NOT NULL) AS claimed
			        FROM contract_members cm
			        JOIN members m ON m.id = cm.member_id AND m.tenant_id = cm.tenant_id
			       WHERE cm.tenant_id = ? AND cm.contract_id = ?
			       ORDER BY cm.turn_order NULLS LAST, cm.joined_at`,
			args: [tenantId, contractId],
		});

		// Rounds are the rotation — administrative, not a member's discipline. The
		// organizer records the turn order the group agreed (§5b) and needs to see it
		// running. payout_address_snapshot is the anti-swap freeze.
		const rRes = await db.execute({
			sql: `SELECT r.round_index, r.due_date::text AS due_date, r.status,
			             r.recipient_member_id, r.payout_tx_hash,
			             r.payout_address_snapshot
			        FROM rounds r
			       WHERE r.tenant_id = ? AND r.contract_id = ?
			       ORDER BY r.round_index`,
			args: [tenantId, contractId],
		});

		// The organizer accountability log. Members can read this too — trust runs
		// both directions. Ballots are NOT here and never will be (schema rule).
		//
		// `detail` is not selected. It is free-form JSONB, so reading it would make
		// this feed a side door onto whatever any writer ever put in one — which is
		// how a member's payment totals turned up in an admin response once already.
		// Fetched-and-dropped is not a boundary; not fetching is.
		const eRes = await db.execute({
			sql: `SELECT actor, action, at::text AS at
			        FROM contract_events
			       WHERE tenant_id = ? AND contract_id = ?
			       ORDER BY at DESC LIMIT 50`,
			args: [tenantId, contractId],
		});

		const rounds = rRes.rows as any[];
		const openRound = rounds.find((r) => r.status === 'open') ?? null;

		// ── the cycle ─────────────────────────────────────────────────────────
		// One rotation = as many rounds as there are turn slots. Derived from the turn
		// order the group agreed, never stored. This is what a turn counts against:
		// on a circle's second rotation totalRounds is 20 and the turn is still 3 of 10.
		const turnSlots = (mRes.rows as any[]).reduce((max, m) => Math.max(max, Number(m.turn_order ?? 0)), 0);
		const cycleLength = turnSlots > 0 ? turnSlots : rounds.length;
		const cycleOf = (roundIndex: number) => (cycleLength > 0 ? Math.ceil(roundIndex / cycleLength) : 1);
		const totalCycles = cycleLength > 0 && rounds.length ? Math.ceil(rounds.length / cycleLength) : 1;
		const currentCycle = openRound
			? cycleOf(Number(openRound.round_index))
			: rounds.length
				? cycleOf(Number(rounds[rounds.length - 1].round_index))
				: 1;

		const members = (mRes.rows as any[]).map((m) => ({
			id: String(m.member_id),
			// Her chosen identity, or nothing. A member with no display name is not a
			// missing name — the UUID-only path is first-class.
			displayName: m.display_name ? String(m.display_name) : null,
			joinedAt: m.joined_at ? String(m.joined_at) : null,
			// The operator's actual question: is she still in the group?
			leftAt: m.left_at ? String(m.left_at) : null,
			turnOrder: m.turn_order === null ? null : Number(m.turn_order),
			// §3: every payout address verified before a round opens — the one safety
			// fact the operator must be able to act on. The address itself is circle-
			// operational (the group sends the pot here on her turn), so the operator
			// can see and — for a member who has not claimed a login — set it.
			payoutVerified: Boolean(m.address_verified_at),
			payoutAddress: m.payout_address ? String(m.payout_address) : null,
			isRecipientOfOpenRound: Boolean(openRound && String(openRound.recipient_member_id) === String(m.member_id)),
			// Has she a login? A seeded member (claimed=false) can be handed a claim
			// link; one who has already bound her account (claimed=true) cannot.
			claimed: Boolean(m.claimed),
			// TODO(§8, circle_votes): `vote` — kind (admission | mid_entry | expulsion),
			// opened_at, closes_at, status. The other half of what the operator needs.
			// Ballots never appear here; only that a vote is open, and its outcome.
		}));

		return json({
			ok: true,
			contract: {
				id: String(c.id),
				type: String(c.type),
				name: String(c.name),
				currency: String(c.currency),
				cadence: String(c.cadence),
				status: String(c.status),
				expectedAmount: Number(c.expected_amount) || 0,
				targetAmount: c.target_amount === null ? null : Number(c.target_amount),
				targetDate: c.target_date ? String(c.target_date) : null,
				totalRounds: rounds.length,
				cycleLength,
				currentCycle,
				totalCycles,
			},
			members,
			rounds: rounds.map((r) => ({
				index: Number(r.round_index),
				dueDate: String(r.due_date),
				status: String(r.status),
				recipientId: r.recipient_member_id ? String(r.recipient_member_id) : null,
				payoutObserved: Boolean(r.payout_tx_hash),
				payoutFrozen: Boolean(r.payout_address_snapshot),
			})),
			// `detail` is NOT returned. The feed renders the action and the actor, and
			// that is all it needs. Event details are free-form JSONB, so shipping them
			// wholesale makes the log a side door onto anything a writer ever put in
			// one — which is exactly how her payment totals turned up here once already.
			// The endpoint returns what the surface renders, and nothing more.
			//
			// §4's early-withdrawal feed (member · amount · date) is specced for the
			// operator and WILL need a detail shape. That is a Slice 3 decision with its
			// own boundary question, not an accident of this endpoint.
			events: (eRes.rows as any[]).map((e) => ({
				actor: e.actor ? String(e.actor) : null,
				action: String(e.action),
				at: String(e.at),
			})),
			updatedAt: new Date().toISOString(),
		});
	} catch (err) {
		console.error('[api/circles/:id] failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
