/**
 * GET /api/admin/notes            → { admin, personal }
 * PUT /api/admin/notes            { scope: 'admin' | 'personal', body }
 *
 * Two pads: 'admin' is shared by every admin, 'personal' belongs to the signed-in one.
 * The split mirrors the mailboxes above them — shared address, private address — so the
 * words already mean something here.
 *
 * Not tenant data (see migrations-pg/0034). requireAdminSession guards every path, and
 * the private pad is additionally keyed to its owner's user id: another admin cannot
 * name it, because the query never takes an id from the request.
 */

import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { requireAdminSession } from '@/lib/adminGuard';
import { db } from '@/lib/db';

export const prerender = false;

/** Long enough for real notes, short of someone pasting a database into it. */
const MAX_BODY = 100_000;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const GET: APIRoute = async ({ request }) => {
	let who;
	try { who = await requireAdminSession(request); }
	catch (resp) { return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401); }

	const [shared, personal] = await Promise.all([
		db.execute({ sql: `SELECT body, updated_at, updated_by FROM admin_notes WHERE scope = 'admin' LIMIT 1`, args: [] }),
		db.execute({
			sql: `SELECT body, updated_at FROM admin_notes WHERE scope = 'personal' AND owner_user_id = ? LIMIT 1`,
			args: [who.userId],
		}),
	]);

	const s = shared.rows[0] as Record<string, unknown> | undefined;
	const p = personal.rows[0] as Record<string, unknown> | undefined;

	return json({
		ok: true,
		admin: { body: String(s?.body ?? ''), updatedAt: s?.updated_at ?? null },
		personal: { body: String(p?.body ?? ''), updatedAt: p?.updated_at ?? null },
	});
};

export const PUT: APIRoute = async ({ request }) => {
	let who;
	try { who = await requireAdminSession(request); }
	catch (resp) { return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401); }

	let body: Record<string, unknown>;
	try { body = await request.json(); }
	catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

	const scope = String(body.scope ?? '');
	if (scope !== 'admin' && scope !== 'personal') {
		return json({ ok: false, error: 'scope must be admin or personal' }, 400);
	}

	const text = String(body.body ?? '');
	if (text.length > MAX_BODY) return json({ ok: false, error: 'Note is too long.' }, 400);

	if (scope === 'admin') {
		// Upserted against the partial unique index that makes the shared pad a
		// singleton, so two admins saving at once cannot create two shared pads.
		await db.execute({
			sql: `INSERT INTO admin_notes (id, scope, owner_user_id, body, updated_at, updated_by)
			      VALUES (?, 'admin', NULL, ?, now(), ?)
			      ON CONFLICT ((1)) WHERE scope = 'admin'
			      DO UPDATE SET body = EXCLUDED.body, updated_at = now(), updated_by = EXCLUDED.updated_by`,
			args: [randomUUID(), text, who.userId],
		});
	} else {
		// owner_user_id comes from the SESSION, never the request body — otherwise one
		// admin could name another's pad and overwrite it.
		await db.execute({
			sql: `INSERT INTO admin_notes (id, scope, owner_user_id, body, updated_at, updated_by)
			      VALUES (?, 'personal', ?, ?, now(), ?)
			      ON CONFLICT (owner_user_id) WHERE scope = 'personal'
			      DO UPDATE SET body = EXCLUDED.body, updated_at = now(), updated_by = EXCLUDED.updated_by`,
			args: [randomUUID(), who.userId, text, who.userId],
		});
	}

	return json({ ok: true });
};
