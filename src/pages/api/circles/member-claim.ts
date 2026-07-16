/**
 * POST /api/circles/member-claim — mint a link that binds a login to a SEEDED member.
 *
 * The organizer adds a member to a forming circle (a row with user_id NULL), then
 * hands her this link. She opens it, signs in, and her login is bound to that row —
 * so she arrives as herself, with her seeded history, not as a duplicate stranger.
 *
 * Owner/admin only (checked against tenant_memberships.role — the operator's staff,
 * not the ADMIN_EMAILS platform allowlist). The token is a bearer credential:
 * whoever holds the link becomes that member, so 32 random bytes, single-use, 7 days.
 */

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';

export const prerender = false;

const CLAIM_TTL_DAYS = 7;

async function requireOwner(request: Request) {
	const session = await requireTenantSession(request);
	if (!session) return { error: 'unauthorized' as const, status: 401 };
	if (session.isDemo) return { error: 'forbidden' as const, status: 403 };
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return { error: 'unauthorized' as const, status: 401 };

	const res = await db.execute({
		sql: `SELECT role FROM tenant_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
		args: [session.tenantId, userId],
	});
	const role = res.rows[0] ? String((res.rows[0] as any).role ?? '') : '';
	if (role !== 'owner' && role !== 'admin') return { error: 'forbidden' as const, status: 403 };
	return { tenantId: session.tenantId, userId };
}

export const POST: APIRoute = async ({ request, url }) => {
	const gate = await requireOwner(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);

	let body: any;
	try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
	const memberId = typeof body?.memberId === 'string' ? body.memberId : '';
	if (!memberId) return json({ ok: false, error: 'missing_member' }, 400);

	try {
		// The member must exist in this programme and not already be claimed — a row
		// with a login is somebody's already.
		const member = await db.execute({
			sql: `SELECT user_id FROM members WHERE tenant_id = ? AND id = ? LIMIT 1`,
			args: [gate.tenantId, memberId],
		});
		if (!member.rows.length) return json({ ok: false, error: 'no_such_member' }, 404);
		if ((member.rows[0] as any).user_id) return json({ ok: false, error: 'already_claimed' }, 409);

		const token = crypto.randomBytes(32).toString('base64url');
		const expires = new Date(Date.now() + CLAIM_TTL_DAYS * 24 * 60 * 60 * 1000);
		await db.execute({
			sql: `INSERT INTO member_claims (token, tenant_id, member_id, created_by, expires_at)
			      VALUES (?, ?, ?, ?, ?)`,
			args: [token, gate.tenantId, memberId, gate.userId, expires.toISOString()],
		});

		const base = (process.env.AUTH_URL || url.origin).replace(/\/$/, '');
		return json({ ok: true, url: `${base}/claim/${token}`, expiresAt: expires.toISOString() });
	} catch (err) {
		console.error('[api/circles/member-claim] failed', err);
		return json({ ok: false, error: 'mint_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
