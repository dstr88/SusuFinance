/**
 * POST /api/circles/arrange — move or copy a member card between tins.
 *
 * The first thing on the circles surface that writes. Everything else is GET.
 *
 * ── Only `forming` tins, both ends ───────────────────────────────────────────
 *
 * A tin is arrangeable until round 1 opens, and then never again. Both the source
 * and the destination must be `forming`: dragging her OUT of a live rotation would
 * strand rounds she has already paid, and dragging her IN would insert a woman into
 * a rotation whose turn order the group already agreed and is already paying
 * against. The check is on both ends because a drag has two.
 *
 * This is enforced here rather than in the UI. The UI will not render a drag handle
 * on a live tin, but "the button is not on the screen" is not a guarantee — anyone
 * can POST. The guarantee is the WHERE clause.
 *
 * ── move vs copy ─────────────────────────────────────────────────────────────
 *
 *   move — she leaves the source, lands in the destination. The drag gesture.
 *   copy — she joins the destination, source untouched. The corner square. This is
 *          how a woman comes to be in three tins.
 *
 * Copy duplicates the PERSON, not her record. Contributions carry contract_id, so
 * her card in the destination starts empty and always would have: there is nothing
 * in this endpoint that could carry a record across, because a record is not a
 * property of a person here — it is a property of her standing in one group.
 *
 * ── The turn slot ────────────────────────────────────────────────────────────
 *
 * She lands on the next free slot at the end of the destination's order. Not
 * inserted, not chosen for her: who goes first is the most contested decision in a
 * susu and the operator does not get to make it by dropping a card. Appending is the
 * one choice that decides nothing — the group reorders afterwards, and that is a
 * separate gesture that does not exist yet.
 *
 * contract_members_active_turn_uniq is the backstop: if two drops race for the same
 * slot, Postgres refuses the second rather than seating two women on one turn.
 *
 * Isolation: every statement filters WHERE tenant_id, taken from the session and
 * never from the body.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';

export const prerender = false;

type Mode = 'move' | 'copy';

export const POST: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	// A demo visitor may look at the arrangement; they may not rearrange it. The demo
	// tenant is shared — one visitor reshuffling a circle hands the next visitor a
	// scrambled one.
	if (session.isDemo) return json({ ok: false, error: 'demo_readonly' }, 403);

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'bad_json' }, 400);
	}

	const memberId = typeof body?.memberId === 'string' ? body.memberId : '';
	const toContractId = typeof body?.toContractId === 'string' ? body.toContractId : '';
	// `fromContractId` is required for a move (there must be somewhere to leave) and
	// meaningless for a copy.
	const fromContractId = typeof body?.fromContractId === 'string' ? body.fromContractId : '';
	const mode: Mode = body?.mode === 'copy' ? 'copy' : 'move';

	if (!memberId || !toContractId) return json({ ok: false, error: 'missing_fields' }, 400);
	if (mode === 'move' && !fromContractId) return json({ ok: false, error: 'missing_fields' }, 400);
	if (mode === 'move' && fromContractId === toContractId) {
		// Dropping a card back where it came from is a no-op, not an error.
		return json({ ok: true, noop: true });
	}

	const tenantId = session.tenantId;

	try {
		// ── Both tins must be forming, and both must be ours ──────────────────────
		const ids = mode === 'move' ? [toContractId, fromContractId] : [toContractId];
		const tins = await db.execute({
			sql: `SELECT id, status, type FROM contracts
			       WHERE tenant_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
			args: [tenantId, ...ids],
		});
		if (tins.rows.length !== ids.length) return json({ ok: false, error: 'not_found' }, 404);

		const notForming = tins.rows.find((r: any) => String(r.status) !== 'forming');
		if (notForming) {
			// Named plainly so the UI can say why rather than just failing: the tin has
			// started, and that is a fact about the group, not a permission problem.
			return json({ ok: false, error: 'tin_started', contractId: String((notForming as any).id) }, 409);
		}

		// She must be a person in this programme. Without this, a POST could seat an
		// arbitrary id — or another tenant's member — in our tin.
		const person = await db.execute({
			sql: `SELECT id FROM members WHERE tenant_id = ? AND id = ? LIMIT 1`,
			args: [tenantId, memberId],
		});
		if (!person.rows.length) return json({ ok: false, error: 'no_such_member' }, 404);

		// Already in the destination? Then there is nothing to do — and for a copy this
		// is the ordinary case of a double-click, not a failure.
		const already = await db.execute({
			sql: `SELECT 1 FROM contract_members
			       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL LIMIT 1`,
			args: [tenantId, toContractId, memberId],
		});
		if (already.rows.length) return json({ ok: false, error: 'already_in_tin' }, 409);

		// ── The slot: append to the end of the agreed order ───────────────────────
		const maxTurn = await db.execute({
			sql: `SELECT COALESCE(MAX(turn_order), 0) AS m FROM contract_members
			       WHERE tenant_id = ? AND contract_id = ? AND left_at IS NULL`,
			args: [tenantId, toContractId],
		});
		const turn = Number((maxTurn.rows[0] as any)?.m ?? 0) + 1;

		await db.execute({
			sql: `INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at)
			      VALUES (?, ?, ?, ?, now())`,
			args: [tenantId, toContractId, memberId, turn],
		});

		if (mode === 'move') {
			// A forming tin has no rounds and no contributions, so removing the row loses
			// nothing — there is no history to orphan. This is the reason the whole
			// gesture is confined to `forming`: in a live tin she would leave a trail,
			// and departure there is `left_at`, a different act with a different name.
			await db.execute({
				sql: `DELETE FROM contract_members
				       WHERE tenant_id = ? AND contract_id = ? AND member_id = ?`,
				args: [tenantId, fromContractId, memberId],
			});
		}

		// The tin's own record of how it came to be arranged this way. The operator
		// moved her; that is a fact about him, not about her.
		await db.execute({
			sql: `INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
			      VALUES (?, ?, 'organizer', ?, ?, now())`,
			args: [
				tenantId,
				toContractId,
				mode === 'move' ? 'member_moved_in' : 'member_copied_in',
				JSON.stringify({ member_id: memberId, from: fromContractId || null, turn_order: turn }),
			],
		});
		if (mode === 'move') {
			await db.execute({
				sql: `INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
				      VALUES (?, ?, 'organizer', 'member_moved_out', ?, now())`,
				args: [tenantId, fromContractId, JSON.stringify({ member_id: memberId, to: toContractId })],
			});
		}

		return json({ ok: true, mode, turnOrder: turn });
	} catch (err: any) {
		// The unique index firing means two drops raced for one slot. That is not a
		// server fault — it is the constraint doing its job.
		if (String(err?.message ?? '').includes('contract_members_active_turn_uniq')) {
			return json({ ok: false, error: 'slot_taken' }, 409);
		}
		console.error('[api/circles/arrange] failed', err);
		return json({ ok: false, error: 'arrange_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
