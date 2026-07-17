/**
 * POST /api/me/address — a member sets the wallet where her turn pays.
 *
 * The app never holds a wallet or a key (read-only, no custody). It only records the
 * ADDRESS she already controls, for two jobs: observing her contributions arrive
 * FROM it, and knowing where to send the pot when it is her turn. She sets her own —
 * scoped to her own member row, never another's.
 *
 * One field sets both columns: wallet_address (contribute-from, the observation
 * anchor) and payout_address (pay-to). Most people use one wallet; the schema keeps
 * them separate so a future "different payout address" is a UI addition, not a
 * migration.
 *
 * Changing the address clears address_verified_at — a new address is unproven until
 * the self-send proof re-verifies it. Any OPEN round is unaffected: its
 * payout_address_snapshot was frozen when the round opened (the anti-swap rule), so
 * editing here only ever changes future rounds.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';

export const prerender = false;

// Permissive by design — addresses vary by chain (EVM, BTC bech32/legacy, LTC,
// Solana base58, …). We reject only obvious junk (spaces, wrong length); the real
// check is the self-send proof, not a regex that might reject a valid chain.
const ADDRESS_RE = /^[A-Za-z0-9:_-]{20,120}$/;

export const POST: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	if (session.isDemo) return json({ ok: false, error: 'demo_readonly' }, 403);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const raw = typeof body?.address === 'string' ? body.address.trim() : '';

	// Empty clears the address (she can remove it).
	const address = raw === '' ? null : raw;
	if (address !== null && !ADDRESS_RE.test(address)) {
		return json({ ok: false, error: 'bad_address' }, 400);
	}

	const tenantId = session.tenantId;
	try {
		// Her own row only. wallet_address carries a per-tenant UNIQUE (one wallet, one
		// member — so an observed contribution attributes to exactly one person), so a
		// clash means the address already belongs to someone else in the programme.
		const res = await db.execute({
			sql: `UPDATE members
			         SET wallet_address = ?, payout_address = ?, address_verified_at = NULL, updated_at = now()
			       WHERE tenant_id = ? AND user_id = ?
			       RETURNING id`,
			args: [address, address, tenantId, userId],
		});
		if (!res.rows.length) return json({ ok: false, error: 'not_a_member' }, 403);
		return json({ ok: true, address });
	} catch (err: any) {
		const msg = String(err?.message ?? '');
		if (/unique|duplicate|members_tenant_wallet/i.test(msg)) {
			return json({ ok: false, error: 'address_taken' }, 409);
		}
		console.error('[api/me/address] failed', err);
		return json({ ok: false, error: 'save_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
