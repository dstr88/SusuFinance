/**
 * mailSync.ts
 *
 * The two halves of the /admin mailbox windows that touch the outside world:
 *
 *   pollMailbox()  — IMAP → mail_messages   (run by the sync-mail cron)
 *   sendFromMailbox() — compose/reply → SMTP → mail_messages + IMAP Sent
 *
 * Deliberately separate from src/lib/email.ts. That file is system mail: one shared
 * EMAIL_SERVER transport sending magic links and alerts as no-reply@. This file is
 * operator correspondence, authenticating per-mailbox as a real human address. Mixing
 * them would mean a leaked EMAIL_SERVER credential could send as donnie@.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { getMailServerConfig, type Mailbox } from './mailboxes';

/** Newest-first cap per poll, so a long-dormant mailbox cannot stall the cron. */
const MAX_PER_POLL = 200;
/** IMAP can hang on a wedged connection; every network step gets a ceiling. */
const IMAP_TIMEOUT_MS = 30_000;
/**
 * Per-file ceiling. Above this the row is recorded with skipped='too_large' and no
 * content, so the panel can say what happened rather than showing nothing — which
 * would be indistinguishable from "no attachment".
 */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface PollResult {
	mailbox: string;
	fetched: number;
	inserted: number;
	error?: string;
}

function client(box: Mailbox): ImapFlow {
	const cfg = getMailServerConfig();
	if (!cfg) throw new Error('MAIL_IMAP_HOST is not set');
	return new ImapFlow({
		host: cfg.imapHost,
		port: cfg.imapPort,
		secure: cfg.imapPort === 993,
		auth: { user: box.address, pass: box.password },
		logger: false,
		// Without this a dead socket keeps the cron open until the platform kills it.
		socketTimeout: IMAP_TIMEOUT_MS,
	});
}

/** Highest IMAP UID already stored for this mailbox within the current epoch. */
async function lastSeenUid(mailbox: string, uidValidity: number): Promise<number> {
	const r = await db.execute({
		sql: `SELECT COALESCE(MAX(uid), 0) AS max_uid
		      FROM mail_messages
		      WHERE mailbox = ? AND uid_validity = ? AND direction = 'in'`,
		args: [mailbox, uidValidity],
	});
	return Number((r.rows[0] as Record<string, unknown>)?.max_uid ?? 0);
}

/**
 * Pull new mail for one mailbox into mail_messages.
 *
 * Incremental by UID rather than by date: dates lie (clock skew, delayed relays) and
 * a date window would re-scan or skip. UIDs are monotonic within a UIDVALIDITY epoch,
 * so "everything above the highest we hold" is exact.
 */
export async function pollMailbox(box: Mailbox): Promise<PollResult> {
	const out: PollResult = { mailbox: box.address, fetched: 0, inserted: 0 };
	let imap: ImapFlow | null = null;

	try {
		imap = client(box);
		await imap.connect();

		const lock = await imap.getMailboxLock('INBOX');
		try {
			const mb = imap.mailbox;
			if (!mb || typeof mb === 'boolean') throw new Error('INBOX did not open');

			const uidValidity = Number(mb.uidValidity);
			const since = await lastSeenUid(box.address, uidValidity);

			// `n:*` always returns at least the newest message even when nothing is new —
			// that is an IMAP quirk, not a bug. The unique index absorbs the duplicate.
			const range = `${since + 1}:*`;

			const seen: number[] = [];
			for await (const msg of imap.fetch(range, { uid: true, source: true }, { uid: true })) {
				if (seen.length >= MAX_PER_POLL) break;
				seen.push(Number(msg.uid));
				out.fetched++;

				const parsed = await simpleParser(msg.source as Buffer);

				const fromAddr = parsed.from?.value?.[0]?.address ?? '';
				const fromName = parsed.from?.value?.[0]?.name ?? null;
				const toAddrs = (parsed.to as any)?.text ?? '';
				const ccAddrs = (parsed.cc as any)?.text ?? null;

				// References arrives as string | string[] depending on the sender.
				const refs = Array.isArray(parsed.references)
					? parsed.references.join(' ')
					: (parsed.references ?? null);

				const rowId = randomUUID();
				const res = await db.execute({
					sql: `INSERT INTO mail_messages
					        (id, mailbox, direction, uid, uid_validity,
					         message_id, in_reply_to, refs,
					         from_addr, from_name, to_addrs, cc_addrs,
					         subject, body_text, body_html, sent_at)
					      VALUES (?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					      ON CONFLICT (mailbox, uid_validity, uid)
					        WHERE direction = 'in'
					      DO NOTHING`,
					args: [
						rowId,
						box.address,
						Number(msg.uid),
						uidValidity,
						parsed.messageId ?? null,
						parsed.inReplyTo ?? null,
						refs,
						fromAddr,
						fromName,
						toAddrs,
						ccAddrs,
						parsed.subject ?? '',
						parsed.text ?? '',
						parsed.html || null,
						parsed.date ? parsed.date.toISOString() : null,
					],
				});

				// Only store files when the message itself was newly inserted. On a
				// duplicate (the `n:*` quirk, or a re-poll) the attachments already exist
				// and re-inserting would double them.
				if (Number(res.rowsAffected ?? 0) > 0) {
					out.inserted++;
					await storeAttachments(rowId, parsed.attachments ?? []);
				}
			}
		} finally {
			lock.release();
		}
	} catch (err) {
		// Non-fatal by design: one unreachable mailbox must not stop the others. The
		// cron reports it and the panel keeps showing whatever was already stored.
		out.error = err instanceof Error ? err.message : String(err);
	} finally {
		try { await imap?.logout(); } catch { /* already gone */ }
	}

	return out;
}

/**
 * Persist a message's attachments.
 *
 * Failures are swallowed per file: a malformed or oversized attachment must not lose
 * the message it arrived with. Better to have the mail and know a file was dropped
 * than to have neither.
 */
async function storeAttachments(messageId: string, attachments: any[]): Promise<void> {
	for (const att of attachments) {
		try {
			const content: Buffer | undefined = att?.content;
			const size = Number(att?.size ?? content?.length ?? 0);
			const tooBig = !content || size > MAX_ATTACHMENT_BYTES;

			await db.execute({
				sql: `INSERT INTO mail_attachments
				        (id, message_id, filename, content_type, size_bytes, content_b64, skipped)
				      VALUES (?, ?, ?, ?, ?, ?, ?)`,
				args: [
					randomUUID(),
					messageId,
					String(att?.filename ?? 'attachment'),
					String(att?.contentType ?? 'application/octet-stream'),
					size,
					tooBig ? null : content.toString('base64'),
					tooBig ? 'too_large' : null,
				],
			});
		} catch (err) {
			console.warn('[mailSync] attachment store failed:', err instanceof Error ? err.message : err);
		}
	}
}

export interface SendInput {
	box: Mailbox;
	to: string;
	cc?: string;
	subject: string;
	bodyText: string;
	/** mail_messages.id being replied to. Threads the reply and inherits the subject. */
	replyToId?: string;
}

export interface SendResult {
	ok: boolean;
	id?: string;
	error?: string;
}

/**
 * Send as one mailbox, then record it.
 *
 * Three things here are easy to omit and each one breaks something quietly:
 *
 *  1. In-Reply-To / References — without them a reply lands in the recipient's client
 *     as a new unrelated message, and neither of you can follow the conversation.
 *  2. Appending to the IMAP Sent folder — SMTP delivers to them, not to you. Skip this
 *     and your own phone will never show a message you sent, and your outbound record
 *     exists only inside this app.
 *  3. Recording the row before returning — so the panel shows a thread rather than a
 *     one-sided feed of what other people said.
 */
export async function sendFromMailbox(input: SendInput): Promise<SendResult> {
	const { box, to, cc, subject, bodyText, replyToId } = input;

	if (!box.canSend) {
		return { ok: false, error: `Sending is disabled for ${box.address}.` };
	}
	const cfg = getMailServerConfig();
	if (!cfg) return { ok: false, error: 'MAIL_SMTP_HOST is not set.' };

	// Inherit threading headers from the message being answered.
	let inReplyTo: string | null = null;
	let references: string | null = null;
	if (replyToId) {
		const r = await db.execute({
			sql: `SELECT message_id, refs FROM mail_messages WHERE id = ? AND mailbox = ? LIMIT 1`,
			args: [replyToId, box.address],
		});
		const row = r.rows[0] as Record<string, unknown> | undefined;
		if (row?.message_id) {
			inReplyTo = String(row.message_id);
			// References is the full ancestry: everything the parent cited, plus the parent.
			references = [row.refs ? String(row.refs) : '', inReplyTo].filter(Boolean).join(' ');
		}
	}

	const transport = nodemailer.createTransport({
		host: cfg.smtpHost,
		port: cfg.smtpPort,
		secure: cfg.smtpPort === 465,
		auth: { user: box.address, pass: box.password },
	});

	const id = randomUUID();
	let messageId: string | null = null;
	let sendError: string | null = null;
	let raw: string | Buffer | null = null;

	try {
		const info = await transport.sendMail({
			from: `${box.label} <${box.address}>`,
			to,
			cc: cc || undefined,
			subject,
			text: bodyText,
			inReplyTo: inReplyTo ?? undefined,
			references: references ?? undefined,
		});
		messageId = info.messageId ?? null;
		raw = (info as { message?: string | Buffer }).message ?? null;
	} catch (err) {
		sendError = err instanceof Error ? err.message : String(err);
	}

	// Record either way. A failed send that leaves no trace is the worst outcome —
	// you would not know whether it went.
	await db.execute({
		sql: `INSERT INTO mail_messages
		        (id, mailbox, direction, message_id, in_reply_to, refs,
		         from_addr, from_name, to_addrs, cc_addrs,
		         subject, body_text, sent_at, read_at, send_error)
		      VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now(), ?)`,
		args: [
			id,
			box.address,
			messageId,
			inReplyTo,
			references,
			box.address,
			box.label,
			to,
			cc || null,
			subject,
			bodyText,
			sendError,
		],
	});

	if (sendError) return { ok: false, id, error: sendError };

	// Best-effort Sent copy. If this fails the message HAS still been delivered, so it
	// must not be reported as a failure — it only means your mail client won't show it.
	if (raw) {
		let imap: ImapFlow | null = null;
		try {
			imap = client(box);
			await imap.connect();
			const target = await findSentFolder(imap);
			if (target) await imap.append(target, raw, ['\\Seen']);
		} catch {
			/* delivered; local copy is a convenience */
		} finally {
			try { await imap?.logout(); } catch { /* already gone */ }
		}
	}

	return { ok: true, id };
}

/**
 * Locate the Sent folder. Servers disagree — 'Sent', 'Sent Items', 'INBOX.Sent' —
 * so prefer the \Sent special-use flag and fall back to name matching.
 */
async function findSentFolder(imap: ImapFlow): Promise<string | null> {
	try {
		const list = await imap.list();
		const flagged = list.find((f) => (f as { specialUse?: string }).specialUse === '\\Sent');
		if (flagged) return flagged.path;
		const named = list.find((f) => /^(inbox[./])?sent(\s?items)?$/i.test(f.path));
		return named?.path ?? null;
	} catch {
		return null;
	}
}
