/**
 * POST /api/admin/invite — mint a link that makes someone an admin of this programme.
 * GET  /api/admin/invite — the live (unredeemed, unexpired) invites for this programme.
 *
 * ── Who may issue one ────────────────────────────────────────────────────────
 *
 * The OWNER of the programme, checked against tenant_memberships.role — not the
 * ADMIN_EMAILS / ADMIN_TENANT_IDS env allowlist in Layout.astro. That allowlist is
 * the platform superadmin; it has nothing to do with who runs a susu programme. The
 * operator is not in it and should not be. He is an owner because
 * ensureTenantForUser made him one when he signed in.
 *
 * ── The token is a bearer credential ─────────────────────────────────────────
 *
 * No email is configured, so the invite is a link the operator sends himself. That
 * means whoever holds it becomes an admin: 32 random bytes, single-use, 7 days.
 * The trust is his, exercised outside this system — the same shape as everything
 * else here (the group's rules, recorded not enforced).
 *
 * Every issue and redemption is written to contract_events? No — deliberately not:
 * contract_events is per-CIRCLE and this is programme-level. The admin_invites row
 * IS the record: who issued it, when, who used it.
 *
 * Isolation: every statement filters WHERE tenant_id, from the session only.
 */

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';

export const prerender = false;

const INVITE_TTL_DAYS = 7;

/** Is this human an owner of this programme? The only gate that means anything. */
async function isOwner(tenantId: string, userId: string): Promise<boolean> {
	const res = await db.execute({
		sql: `SELECT role FROM tenant_memberships
		       WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
		args: [tenantId, userId],
	});
	const role = res.rows[0] ? String((res.rows[0] as any).role ?? '') : '';
	return role === 'owner' || role === 'admin';
}

async function requireOwner(request: Request) {
	const session = await requireTenantSession(request);
	if (!session) return { error: 'unauthorized' as const, status: 401 };
	// A demo cookie carries a tenant but no human — it cannot own anything.
	if (session.isDemo) return { error: 'forbidden' as const, status: 403 };

	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return { error: 'unauthorized' as const, status: 401 };

	if (!(await isOwner(session.tenantId, userId))) {
		return { error: 'forbidden' as const, status: 403 };
	}
	return { tenantId: session.tenantId, userId };
}

export const POST: APIRoute = async ({ request, url }) => {
	const gate = await requireOwner(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);

	try {
		// 32 bytes, base64url — URL-safe, no padding, ~256 bits. The link is the
		// credential, so it has to be unguessable rather than merely unique.
		const token = crypto.randomBytes(32).toString('base64url');
		const expires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

		await db.execute({
			sql: `INSERT INTO admin_invites (token, tenant_id, created_by, expires_at)
			      VALUES (?, ?, ?, ?)`,
			args: [token, gate.tenantId, gate.userId, expires.toISOString()],
		});

		// AUTH_URL is the deployed origin and the source of truth for links that must
		// work outside this request — same reason the OAuth callback uses it. Behind
		// Render's proxy the request's own origin can be an internal host.
		const base = (process.env.AUTH_URL || url.origin).replace(/\/$/, '');
		return json({
			ok: true,
			url: `${base}/invite/${token}`,
			expiresAt: expires.toISOString(),
		});
	} catch (err) {
		console.error('[api/admin/invite] POST failed', err);
		return json({ ok: false, error: 'create_failed' }, 500);
	}
};

export const GET: APIRoute = async ({ request }) => {
	const gate = await requireOwner(request);
	if ('error' in gate) return json({ ok: false, error: gate.error }, gate.status);

	try {
		// Live invites only. The token itself is NOT returned — an outstanding link is
		// a credential, and re-displaying it later would turn this list into a way to
		// recover one. He copied it when he made it; if it is lost, make another.
		const res = await db.execute({
			sql: `SELECT created_at::text AS created_at, expires_at::text AS expires_at
			        FROM admin_invites
			       WHERE tenant_id = ? AND redeemed_at IS NULL AND expires_at > now()
			       ORDER BY created_at DESC`,
			args: [gate.tenantId],
		});
		return json({
			ok: true,
			live: res.rows.map((r: any) => ({
				createdAt: String(r.created_at),
				expiresAt: String(r.expires_at),
			})),
		});
	} catch (err) {
		console.error('[api/admin/invite] GET failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
