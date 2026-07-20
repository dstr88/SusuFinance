/**
 * GET   /api/admin/mail?mailbox=admin@susufinance.com&limit=50
 *         → messages for one window, newest first
 * POST  /api/admin/mail            { mailbox, to, cc?, subject, body, replyToId? }
 *         → compose or reply, sends via SMTP and records the row
 * PATCH /api/admin/mail            { id, read: true }
 *         → mark one inbound message read (our state, not the mail server's)
 *
 * ── Isolation note ──────────────────────────────────────────────────────────
 * mail_messages carries no tenant_id (see migrations-pg/0026_mail.sql). It is operator
 * correspondence, not tenant data. The guarantee here is requireAdminSession on EVERY
 * method plus findMailboxForAdmin, which refuses a mailbox the caller does not own.
 * Never add an unguarded path to this table.
 */

import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/adminGuard';
import { db } from '@/lib/db';
import { findMailboxForAdmin } from '@/lib/mailboxes';
import { sendFromMailbox } from '@/lib/mailSync';

export const prerender = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Same ceiling the support inbox uses. Long enough for real mail, short of abuse. */
const MAX_BODY = 10_000;
const MAX_SUBJECT = 300;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

/** Resolves the admin, or returns the Response to send back. */
async function admin(request: Request): Promise<{ userId: string; email: string } | Response> {
	try {
		const { userId, email } = await requireAdminSession(request);
		return { userId, email };
	} catch (resp) {
		return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401);
	}
}

// ── GET — list one mailbox ───────────────────────────────────────────────────
export const GET: APIRoute = async ({ request }) => {
	const who = await admin(request);
	if (who instanceof Response) return who;

	const url = new URL(request.url);
	const address = url.searchParams.get('mailbox') ?? '';
	const box = findMailboxForAdmin(address, who);
	if (!box) return json({ ok: false, error: 'Unknown mailbox' }, 404);

	const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT);

	const r = await db.execute({
		sql: `SELECT id, direction, message_id, in_reply_to,
		             from_addr, from_name, to_addrs, cc_addrs,
		             subject, body_text, sent_at, read_at, send_error
		      FROM mail_messages
		      WHERE mailbox = ?
		      ORDER BY COALESCE(sent_at, fetched_at) DESC
		      LIMIT ?`,
		args: [box.address, limit],
	});

	const unread = await db.execute({
		sql: `SELECT COUNT(*) AS n FROM mail_messages
		      WHERE mailbox = ? AND direction = 'in' AND read_at IS NULL`,
		args: [box.address],
	});

	// Attachments for exactly the messages being returned. Scoped by mailbox as well as
	// message id so the join can never reach a file from a mailbox this admin can't see.
	const atts = await db.execute({
		sql: `SELECT a.id, a.message_id, a.filename, a.size_bytes, a.skipped
		      FROM mail_attachments a
		      JOIN mail_messages m ON m.id = a.message_id
		      WHERE m.mailbox = ?
		      ORDER BY a.filename`,
		args: [box.address],
	});

	const byMessage = new Map<string, Record<string, unknown>[]>();
	for (const a of atts.rows as Record<string, unknown>[]) {
		const key = String(a.message_id);
		if (!byMessage.has(key)) byMessage.set(key, []);
		byMessage.get(key)!.push(a);
	}

	const messages = (r.rows as Record<string, unknown>[]).map((m) => ({
		...m,
		attachments: byMessage.get(String(m.id)) ?? [],
	}));

	return json({
		ok: true,
		mailbox: box.address,
		label: box.label,
		canSend: box.canSend,
		unread: Number((unread.rows[0] as Record<string, unknown>)?.n ?? 0),
		messages,
	});
};

// ── POST — compose or reply ──────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
	const who = await admin(request);
	if (who instanceof Response) return who;

	let body: Record<string, unknown>;
	try { body = await request.json(); }
	catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

	const box = findMailboxForAdmin(String(body.mailbox ?? ''), who);
	if (!box) return json({ ok: false, error: 'Unknown mailbox' }, 404);

	// Enforced server-side as well as hidden in the UI. A read-only mailbox must refuse
	// even a hand-rolled request — the flag is a boundary, not a display preference.
	if (!box.canSend) {
		return json({ ok: false, error: `Sending is disabled for ${box.address}.` }, 403);
	}

	const to = String(body.to ?? '').trim();
	const cc = String(body.cc ?? '').trim();
	const subject = String(body.subject ?? '').trim().slice(0, MAX_SUBJECT);
	const text = String(body.body ?? '').trim();
	const replyToId = body.replyToId ? String(body.replyToId) : undefined;

	if (!to) return json({ ok: false, error: 'A recipient is required.' }, 400);
	if (!text) return json({ ok: false, error: 'Message cannot be empty.' }, 400);
	if (text.length > MAX_BODY) return json({ ok: false, error: 'Message is too long.' }, 400);

	const result = await sendFromMailbox({
		box, to, cc, subject: subject || '(no subject)', bodyText: text, replyToId,
	});

	// The row is recorded either way, so a failure here is reportable rather than lost.
	return result.ok
		? json({ ok: true, id: result.id })
		: json({ ok: false, error: result.error ?? 'Send failed.' }, 502);
};

// ── PATCH — mark read ────────────────────────────────────────────────────────
export const PATCH: APIRoute = async ({ request }) => {
	const who = await admin(request);
	if (who instanceof Response) return who;

	let body: Record<string, unknown>;
	try { body = await request.json(); }
	catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

	const id = String(body.id ?? '');
	if (!id) return json({ ok: false, error: 'id is required' }, 400);

	// Scope the update to mailboxes this admin owns, so an id alone is not enough to
	// touch someone else's window.
	const allowed = findMailboxForAdmin(String(body.mailbox ?? ''), who);
	if (!allowed) return json({ ok: false, error: 'Unknown mailbox' }, 404);

	await db.execute({
		sql: `UPDATE mail_messages SET read_at = now()
		      WHERE id = ? AND mailbox = ? AND read_at IS NULL`,
		args: [id, allowed.address],
	});

	return json({ ok: true });
};
