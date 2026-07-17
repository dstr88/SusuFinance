/**
 * POST /api/circles/open-round — the operator advances a circle to its next round.
 *
 * Completes the currently-open round (advancing IS the operator confirming its payout
 * is done) and opens the next scheduled one — but ONLY after a LIVE Verify re-check of
 * that round's recipient's payout wallet. §3: "every payout address verified before a
 * round opens." Verification lives in Verify (its own product), so this asks Verify's
 * public lookup at the moment of opening, not the cached stamp — if Verify has revoked
 * the address, the round refuses to open and nothing changes.
 *
 * The re-check also refreshes the recipient's stored address_verified_at to match what
 * Verify says right now, so the cached flag can never be more trusting than the truth.
 *
 * Owner/admin only, scoped to his own tenant. The gate runs BEFORE any write, so a
 * failed check leaves the rotation exactly as it was.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { checkAlmstinsVerify } from '@/lib/circles/almstinsVerify';

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

export const POST: APIRoute = async ({ request }) => {
	const gate = await requireOperator(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);
	const tenantId = gate.tenantId;

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const contractId = typeof body?.contractId === 'string' ? body.contractId : '';
	if (!contractId) return json({ ok: false, error: 'missing_contract' }, 400);

	try {
		// The next round to open: the earliest one still scheduled.
		const nextRes = await db.execute({
			sql: `SELECT id, round_index, recipient_member_id
			        FROM rounds
			       WHERE tenant_id = ? AND contract_id = ? AND status = 'scheduled'
			       ORDER BY round_index ASC LIMIT 1`,
			args: [tenantId, contractId],
		});
		if (!nextRes.rows.length) return json({ ok: false, error: 'no_scheduled_round' }, 409);
		const next: any = nextRes.rows[0];
		const roundId = String(next.id);
		const roundIndex = Number(next.round_index);
		const recipientId = next.recipient_member_id ? String(next.recipient_member_id) : '';
		if (!recipientId) return json({ ok: false, error: 'no_recipient' }, 409);

		// Her payout wallet, and who she is (for the message).
		const mRes = await db.execute({
			sql: `SELECT payout_address, display_name FROM members WHERE tenant_id = ? AND id = ? LIMIT 1`,
			args: [tenantId, recipientId],
		});
		if (!mRes.rows.length) return json({ ok: false, error: 'no_recipient' }, 409);
		const recipientName = (mRes.rows[0] as any).display_name ? String((mRes.rows[0] as any).display_name) : null;
		const address = (mRes.rows[0] as any).payout_address ? String((mRes.rows[0] as any).payout_address) : '';
		if (!address) return json({ ok: false, error: 'recipient_no_address', recipientName }, 409);

		// ── The live Verify gate (before any write) ──────────────────────────────
		const verified = await checkAlmstinsVerify(address);
		// Refresh the cached stamp to match Verify right now — the flag never outlasts
		// the truth. (Fail-closed: unreachable Verify → false → stamp cleared, no open.)
		await db.execute({
			sql: `UPDATE members SET address_verified_at = ${verified ? 'now()' : 'NULL'}, updated_at = now()
			       WHERE tenant_id = ? AND id = ?`,
			args: [tenantId, recipientId],
		});
		if (!verified) return json({ ok: false, error: 'recipient_not_verified', recipientName }, 409);

		// ── Open it (freeze the snapshot = anti-swap), then complete the prior open ──
		const opened = await db.execute({
			sql: `UPDATE rounds SET status = 'open', payout_address_snapshot = ?
			       WHERE tenant_id = ? AND id = ? AND status = 'scheduled'`,
			args: [address, tenantId, roundId],
		});
		if ((opened.rowsAffected ?? 0) === 0) return json({ ok: false, error: 'already_opened' }, 409);

		// Advancing means the previous round is done — complete any other open round.
		await db.execute({
			sql: `UPDATE rounds SET status = 'completed'
			       WHERE tenant_id = ? AND contract_id = ? AND status = 'open' AND id <> ?`,
			args: [tenantId, contractId, roundId],
		});

		// This round's obligations now come due: one pending contribution per rotation
		// member EXCEPT the recipient (she receives this round; the pot nets her share).
		// Amount + due date are read straight from the round/contract, so nothing can
		// drift. Runs once — the status='scheduled'→'open' guard above gates it.
		await db.execute({
			sql: `INSERT INTO contributions
			        (tenant_id, contract_id, round_id, member_id, expected_amount, due_date, status, created_at, updated_at)
			      SELECT r.tenant_id, r.contract_id, r.id, cm.member_id, c.expected_amount, r.due_date, 'pending', now(), now()
			        FROM rounds r
			        JOIN contracts c ON c.id = r.contract_id AND c.tenant_id = r.tenant_id
			        JOIN contract_members cm ON cm.contract_id = r.contract_id AND cm.tenant_id = r.tenant_id
			       WHERE r.tenant_id = ? AND r.id = ?
			         AND cm.left_at IS NULL AND cm.turn_order IS NOT NULL
			         AND cm.member_id <> r.recipient_member_id`,
			args: [tenantId, roundId],
		});

		await db.execute({
			sql: `INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
			      VALUES (?, ?, 'organizer', 'round_opened', ?, now())`,
			args: [tenantId, contractId, JSON.stringify({ round: roundIndex, recipient_member_id: recipientId })],
		});

		return json({ ok: true, opened: { roundIndex, recipientName } });
	} catch (err) {
		console.error('[api/circles/open-round] failed', err);
		return json({ ok: false, error: 'open_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
