/**
 * POST /api/admin/mail/organize
 *
 *   { mailbox, action: 'delete',        id }                 → move to Trash
 *   { mailbox, action: 'move',          id, folder }         → file it elsewhere
 *   { mailbox, action: 'create-folder', name }               → new folder
 *
 * Delete moves to Trash and never expunges. A small button beside a message must not
 * be able to destroy it — Trash is polled like any other folder, so a deleted message
 * stays readable and can be moved back. Permanent removal is the mail server's
 * retention policy to apply, not a side effect of a click here.
 *
 * Guards match the rest of the mail API: requireAdminSession, then findMailboxForAdmin
 * so no one can act on a mailbox that is not theirs. Every action also re-reads the
 * message FROM THE DATABASE scoped to that mailbox, so an id alone is never enough.
 */

import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/adminGuard';
import { db } from '@/lib/db';
import { findMailboxForAdmin } from '@/lib/mailboxes';
import { createMailFolder, deleteMessage, moveMessage } from '@/lib/mailSync';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const POST: APIRoute = async ({ request }) => {
	let who;
	try { who = await requireAdminSession(request); }
	catch (resp) { return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401); }

	let body: Record<string, unknown>;
	try { body = await request.json(); }
	catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

	const box = findMailboxForAdmin(String(body.mailbox ?? ''), who);
	if (!box) return json({ ok: false, error: 'Unknown mailbox' }, 404);

	const action = String(body.action ?? '');

	// ── New folder ───────────────────────────────────────────────────────────
	if (action === 'create-folder') {
		const result = await createMailFolder(box, String(body.name ?? ''));
		return result.ok ? json({ ok: true, path: result.path }) : json(result, 400);
	}

	// ── Delete / move — both need a real message in this mailbox ─────────────
	const id = String(body.id ?? '');
	if (!id) return json({ ok: false, error: 'id is required' }, 400);

	const r = await db.execute({
		sql: `SELECT folder, uid FROM mail_messages WHERE id = ? AND mailbox = ? LIMIT 1`,
		args: [id, box.address],
	});
	const row = r.rows[0] as Record<string, unknown> | undefined;
	if (!row) return json({ ok: false, error: 'No such message' }, 404);

	// A null uid means the row is a placeholder we wrote at send time, before the
	// server's own copy came back. There is nothing on the server to move yet.
	if (row.uid == null) {
		return json({ ok: false, error: 'This message has not synced to the server yet — try again shortly.' }, 409);
	}

	const folder = String(row.folder);
	const uid = Number(row.uid);

	if (action === 'delete') {
		const result = await deleteMessage(box, folder, uid);
		return result.ok ? json({ ok: true }) : json(result, 502);
	}

	if (action === 'move') {
		const target = String(body.folder ?? '');
		if (!target) return json({ ok: false, error: 'folder is required' }, 400);
		if (target === folder) return json({ ok: true });

		const result = await moveMessage(box, folder, uid, target);
		return result.ok ? json({ ok: true }) : json(result, 502);
	}

	return json({ ok: false, error: 'Unknown action.' }, 400);
};
