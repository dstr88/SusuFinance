/**
 * GET  /api/me/notifications  — the member's in-app inbox (newest first) + unread count.
 * POST /api/me/notifications  — mark read: { id } for one notice, or {} / { all: true }
 *                              for all of hers.
 *
 * Scoped to her own member row: a login only ever reads or marks its own notices, and
 * only the in-app channel (the email rows are delivery records, not inbox items).
 */
import type { APIRoute } from 'astro';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { db } from '@/lib/db';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}

/** Resolve the signed-in login to her own member row. Null = not a member. */
async function currentMemberId(request: Request): Promise<string | null> {
	const session = await requireTenantSession(request);
	if (!session) return null;
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return null;
	const res = await db.execute({
		sql: `SELECT id FROM members WHERE user_id = ? LIMIT 1`,
		args: [userId],
	});
	const row = res.rows?.[0] as Record<string, any> | undefined;
	return row ? String(row.id) : null;
}

export const GET: APIRoute = async ({ request }) => {
	let memberId: string | null;
	try { memberId = await currentMemberId(request); }
	catch { return json({ ok: false, error: 'unauthorized' }, 401); }
	if (!memberId) return json({ ok: true, notifications: [], unread: 0 });

	try {
		const res = await db.execute({
			sql: `SELECT id, kind, title, body, contract_id,
			             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
			             (read_at IS NOT NULL) AS read
			      FROM notifications
			      WHERE member_id = ? AND channel = 'in_app'
			      ORDER BY created_at DESC
			      LIMIT 50`,
			args: [memberId],
		});
		const notifications = (res.rows ?? []).map((r: any) => ({
			id: String(r.id),
			kind: String(r.kind),
			title: r.title ?? '',
			body: r.body ?? '',
			contractId: r.contract_id ? String(r.contract_id) : null,
			createdAt: String(r.created_at),
			read: r.read === true || r.read === 't',
		}));
		const unreadRes = await db.execute({
			sql: `SELECT COUNT(*) AS n FROM notifications
			      WHERE member_id = ? AND channel = 'in_app' AND read_at IS NULL`,
			args: [memberId],
		});
		const unread = Number((unreadRes.rows?.[0] as any)?.n ?? 0);
		return json({ ok: true, notifications, unread });
	} catch (err) {
		console.error('[api/me/notifications] load failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

export const POST: APIRoute = async ({ request }) => {
	let memberId: string | null;
	try { memberId = await currentMemberId(request); }
	catch { return json({ ok: false, error: 'unauthorized' }, 401); }
	if (!memberId) return json({ ok: false, error: 'unauthorized' }, 401);

	let bodyIn: any = {};
	try { bodyIn = await request.json(); } catch { /* empty body = mark all */ }

	try {
		if (bodyIn && bodyIn.id) {
			await db.execute({
				sql: `UPDATE notifications SET read_at = now()
				      WHERE member_id = ? AND channel = 'in_app' AND id = ? AND read_at IS NULL`,
				args: [memberId, String(bodyIn.id)],
			});
		} else {
			await db.execute({
				sql: `UPDATE notifications SET read_at = now()
				      WHERE member_id = ? AND channel = 'in_app' AND read_at IS NULL`,
				args: [memberId],
			});
		}
		return json({ ok: true });
	} catch (err) {
		console.error('[api/me/notifications] mark-read failed', err);
		return json({ ok: false, error: 'update_failed' }, 500);
	}
};
