/**
 * notifications.ts — the circle notification center (SusuData §4).
 *
 * One table, three jobs: the in-app notice she can always see (the most private
 * channel — behind her login, nothing on a shared lock screen, and her own record of
 * what she was told), the delivery record for opt-in email, and the idempotency guard
 * so a cron can run hourly and never double-nag.
 *
 * No-shame by construction. Every notice is a pre-written, catalogued template fired
 * by an event and suppressed by observed behavior: a T-2 reminder never fires on a
 * contribution already paid ("paid = silence"). One false "you owe" costs more trust
 * than fifty correct reminders earn, so nothing here is free text.
 *
 * Emojis are function, not decoration: one leading glyph per template as visual
 * grammar for mixed literacy (✅ money-in · ⏰ action / heads-up · 🎉 celebration),
 * parseable before reading. Discreet mode strips them — a 💰 on a lock screen
 * announces a finance app, and her inbox may not be only hers.
 *
 * Discipline states are NOT recomputed here (see discipline.ts). This module acts on
 * status = 'pending' plus the contract's grace window; it never invents a verdict.
 */
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { sendMail } from '@/lib/email';

export type NotificationKind =
	| 'reminder'          // T-2, unpaid only
	| 'due_today'         // opt-in nudge, unpaid only, on the due date
	| 'payment_confirmed' // the chain saw her contribution — always written
	| 'your_turn'         // her turn is up next; payout address verified — always
	| 'payout_observed'   // the round paid out to her — always
	| 'gentle_late'       // past grace and still open — her eyes only, no shame
	| 'cycle_complete';   // 🎉 — always written

type Locale = 'en' | 'fr';

export interface NotifyVars {
	contractName?: string;
	amount?: string | number;
	currency?: string;
	dueDate?: string;
	link?: string;
}

interface NotifyPref {
	reminders?: boolean;
	due_day_nudge?: boolean;
	discreet?: boolean;
	email_opt_in?: boolean;
}

const APP_URL = (process.env.APP_URL ?? 'https://susufinance.com').replace(/\/$/, '');
const DEFAULT_LINK = `${APP_URL}/dashboard/circles`;

const GLYPH: Record<NotificationKind, string> = {
	reminder: '⏰',
	due_today: '⏰',
	payment_confirmed: '✅',
	your_turn: '⏰',
	payout_observed: '✅',
	gentle_late: '⏰',
	cycle_complete: '🎉',
};

// The `reminders` preference gates only the nudges. Confirmations, her-turn heads-ups,
// payouts, and celebrations are facts about what happened and are always written.
const GATED_BY_REMINDERS: Record<NotificationKind, boolean> = {
	reminder: true,
	due_today: true,
	payment_confirmed: false,
	your_turn: false,
	payout_observed: false,
	gentle_late: true,
	cycle_complete: false,
};

function money(v: NotifyVars): string {
	return `${v.amount ?? ''} ${v.currency ?? 'USDC'}`.trim();
}

/**
 * Subject + body, in her language and her privacy mode. Discreet strips the group
 * name, the amount, and the glyph — the minimum that says "open the app" — because
 * household financial privacy is a real reason secret savings exist.
 */
function render(kind: NotificationKind, locale: Locale, discreet: boolean, v: NotifyVars): { subject: string; text: string } {
	const link = v.link ?? DEFAULT_LINK;
	const name = v.contractName ?? '';
	const amt = money(v);
	const due = v.dueDate ?? '';

	if (discreet) {
		const en: Record<NotificationKind, { subject: string; text: string }> = {
			reminder: { subject: 'You have a reminder waiting', text: `You have a reminder in SusuFinance.\n${link}` },
			due_today: { subject: 'You have a reminder waiting', text: `You have a reminder in SusuFinance.\n${link}` },
			gentle_late: { subject: 'You have a reminder waiting', text: `You have a reminder in SusuFinance.\n${link}` },
			payment_confirmed: { subject: 'Payment confirmed', text: `Your payment was confirmed.\n${link}` },
			payout_observed: { subject: 'Payment received', text: `A payment was received.\n${link}` },
			your_turn: { subject: 'An update is waiting', text: `You have an update in SusuFinance.\n${link}` },
			cycle_complete: { subject: 'An update is waiting', text: `You have an update in SusuFinance.\n${link}` },
		};
		const fr: Record<NotificationKind, { subject: string; text: string }> = {
			reminder: { subject: 'Vous avez un rappel', text: `Vous avez un rappel dans SusuFinance.\n${link}` },
			due_today: { subject: 'Vous avez un rappel', text: `Vous avez un rappel dans SusuFinance.\n${link}` },
			gentle_late: { subject: 'Vous avez un rappel', text: `Vous avez un rappel dans SusuFinance.\n${link}` },
			payment_confirmed: { subject: 'Paiement confirmé', text: `Votre paiement a été confirmé.\n${link}` },
			payout_observed: { subject: 'Paiement reçu', text: `Un paiement a été reçu.\n${link}` },
			your_turn: { subject: 'Une mise à jour vous attend', text: `Vous avez une mise à jour dans SusuFinance.\n${link}` },
			cycle_complete: { subject: 'Une mise à jour vous attend', text: `Vous avez une mise à jour dans SusuFinance.\n${link}` },
		};
		return (locale === 'fr' ? fr : en)[kind];
	}

	const g = GLYPH[kind] + ' ';
	if (locale === 'fr') {
		const fr: Record<NotificationKind, { subject: string; text: string }> = {
			reminder: { subject: `${g}${name} : ${amt} à verser le ${due}`, text: `Votre cotisation pour ${name} est due le ${due} : ${amt}.\n${link}` },
			due_today: { subject: `${g}${name} : ${amt} à verser aujourd'hui`, text: `Votre cotisation pour ${name} est due aujourd'hui : ${amt}.\n${link}` },
			gentle_late: { subject: `${g}${name} : cotisation encore ouverte`, text: `Votre cotisation pour ${name} est encore ouverte : ${amt}. Dès que possible, vous pouvez la compléter.\n${link}` },
			payment_confirmed: { subject: `${g}${amt} reçus — ${name}`, text: `Votre cotisation pour ${name} a bien été reçue : ${amt}.\n${link}` },
			payout_observed: { subject: `${g}Votre versement est effectué — ${name}`, text: `Votre versement de ${name} est effectué. Le tour vous a payé.\n${link}` },
			your_turn: { subject: `${g}${name} : c'est votre tour`, text: `C'est votre tour dans ${name}. Votre adresse de versement est vérifiée, et ce tour vous verse la somme.\n${link}` },
			cycle_complete: { subject: `${g}${name} : cycle terminé`, text: `Le cycle de ${name} est terminé. Bravo.\n${link}` },
		};
		return fr[kind];
	}
	const en: Record<NotificationKind, { subject: string; text: string }> = {
		reminder: { subject: `${g}${name}: ${amt} due ${due}`, text: `Your contribution to ${name} is due ${due}: ${amt}.\n${link}` },
		due_today: { subject: `${g}${name}: ${amt} due today`, text: `Your contribution to ${name} is due today: ${amt}.\n${link}` },
		gentle_late: { subject: `${g}${name}: contribution still open`, text: `Your contribution to ${name} is still open: ${amt}. Whenever you're able, you can complete it.\n${link}` },
		payment_confirmed: { subject: `${g}${amt} received — ${name}`, text: `Your contribution to ${name} was received: ${amt}.\n${link}` },
		payout_observed: { subject: `${g}Your payout is complete — ${name}`, text: `Your payout from ${name} is complete. The round has paid out to you.\n${link}` },
		your_turn: { subject: `${g}${name}: it's your turn`, text: `It's your turn in ${name}. Your payout address is verified, and this round pays you.\n${link}` },
		cycle_complete: { subject: `${g}${name}: cycle complete`, text: `The cycle for ${name} is complete. Well done.\n${link}` },
	};
	return en[kind];
}

function safeParse(s: string): NotifyPref {
	try { return JSON.parse(s) as NotifyPref; } catch { return {}; }
}

/** Claim a notice row. Returns true only if this call created it (idempotent). */
async function claimNotice(row: {
	tenantId: string; memberId: string; contractId: string | null;
	kind: NotificationKind; channel: 'in_app' | 'email'; bodyRef: string;
	locale: Locale; dedupeKey: string; title?: string | null; body?: string | null;
}): Promise<boolean> {
	const res = await db.execute({
		sql: `INSERT INTO notifications
		        (id, tenant_id, member_id, contract_id, kind, channel, body_ref, locale, dedupe_key, title, body)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		      ON CONFLICT (dedupe_key) DO NOTHING
		      RETURNING id`,
		args: [randomUUID(), row.tenantId, row.memberId, row.contractId, row.kind, row.channel, row.bodyRef, row.locale, row.dedupeKey, row.title ?? null, row.body ?? null],
	});
	return (res.rows?.length ?? 0) > 0;
}

/**
 * Write one notice: always the in-app record, plus opt-in email. Idempotent per
 * (kind, channel, eventKey) — safe to call from a cron every run. Returns what was
 * newly created this call, so callers can count real sends rather than re-runs.
 */
export async function notify(opts: {
	memberId: string;
	contractId?: string | null;
	kind: NotificationKind;
	eventKey: string;
	vars?: NotifyVars;
}): Promise<{ inApp: boolean; emailed: boolean }> {
	const mres = await db.execute({
		sql: `SELECT id, tenant_id, email, locale, notify_pref FROM members WHERE id = ?`,
		args: [opts.memberId],
	});
	const m = mres.rows?.[0] as Record<string, any> | undefined;
	if (!m) return { inApp: false, emailed: false };

	const pref: NotifyPref = typeof m.notify_pref === 'string' ? safeParse(m.notify_pref) : (m.notify_pref ?? {});
	if (GATED_BY_REMINDERS[opts.kind] && pref.reminders === false) {
		return { inApp: false, emailed: false };
	}

	const locale: Locale = m.locale === 'fr' ? 'fr' : 'en';
	const discreet = pref.discreet === true;
	const contractId = opts.contractId ?? null;
	const bodyRef = `${opts.kind}:${opts.eventKey}`;

	// The in-app copy is always the informative version: it lives behind her login,
	// the one place discreet mode has nothing to hide from.
	const inAppText = render(opts.kind, locale, false, opts.vars ?? {});

	// 1. In-app notice — always, her private record.
	const inApp = await claimNotice({
		tenantId: m.tenant_id, memberId: m.id, contractId, kind: opts.kind,
		channel: 'in_app', bodyRef, locale, dedupeKey: `${opts.kind}:in_app:${opts.eventKey}`,
		title: inAppText.subject, body: inAppText.text,
	});

	// 2. Email — opt-in escalation only, and only if she has an address.
	let emailed = false;
	if (pref.email_opt_in === true && m.email) {
		const emailDedupe = `${opts.kind}:email:${opts.eventKey}`;
		const claimed = await claimNotice({
			tenantId: m.tenant_id, memberId: m.id, contractId, kind: opts.kind,
			channel: 'email', bodyRef, locale, dedupeKey: emailDedupe,
		});
		if (claimed) {
			const { subject, text } = render(opts.kind, locale, discreet, opts.vars ?? {});
			try {
				await sendMail({ to: m.email as string, subject, text });
				await db.execute({ sql: `UPDATE notifications SET sent_at = now() WHERE dedupe_key = ?`, args: [emailDedupe] });
				emailed = true;
			} catch {
				// sent_at stays NULL — the ops view shows it queued/failed rather than sent.
			}
		}
	}
	return { inApp, emailed };
}

function fmtAmount(v: unknown): string {
	const n = Number(v);
	return Number.isFinite(n) ? n.toString() : String(v ?? '');
}

/**
 * The reminder engine (called by /api/cron/reminders). Fires:
 *   - reminder     : unpaid contributions due within the contract's reminder_lead_days.
 *   - due_today    : the opt-in due-day nudge, for members who asked for it.
 *   - gentle_late  : past the grace window and still open — her eyes only, once, no shame.
 *
 * Only status = 'pending' is read, so paid, partial-then-settled, and the recipient's
 * own round (which has no contribution row — nine wallets pay the tenth) are silent by
 * construction.
 */
export async function runDueReminders(): Promise<{ reminded: number; nudged: number; late: number; errors: string[] }> {
	const out = { reminded: 0, nudged: 0, late: 0, errors: [] as string[] };

	// ── Due-soon reminders + opt-in due-day nudge ──────────────────────────────
	try {
		const rows = await db.execute({
			sql: `SELECT c.id AS contribution_id, c.member_id, c.contract_id,
			             to_char(c.due_date, 'YYYY-MM-DD') AS due_date,
			             (c.due_date - CURRENT_DATE) AS days_until,
			             c.expected_amount,
			             ct.name AS contract_name, ct.currency,
			             COALESCE((m.notify_pref->>'due_day_nudge')::boolean, false) AS due_day_nudge
			      FROM contributions c
			      JOIN contracts ct ON ct.id = c.contract_id AND ct.tenant_id = c.tenant_id
			      JOIN members   m  ON m.id  = c.member_id   AND m.tenant_id  = c.tenant_id
			      WHERE c.status = 'pending'
			        AND ct.status = 'active'
			        AND c.due_date >= CURRENT_DATE
			        AND c.due_date <= CURRENT_DATE + ct.reminder_lead_days
			      ORDER BY c.due_date ASC
			      LIMIT 2000`,
			args: [],
		});
		for (const r of (rows.rows ?? []) as Record<string, any>[]) {
			const vars: NotifyVars = {
				contractName: String(r.contract_name ?? ''),
				amount: fmtAmount(r.expected_amount),
				currency: String(r.currency ?? 'USDC'),
				dueDate: String(r.due_date ?? ''),
			};
			try {
				const res = await notify({ memberId: String(r.member_id), contractId: String(r.contract_id), kind: 'reminder', eventKey: String(r.contribution_id), vars });
				if (res.inApp || res.emailed) out.reminded++;
				if (Number(r.days_until) === 0 && r.due_day_nudge === true) {
					const nud = await notify({ memberId: String(r.member_id), contractId: String(r.contract_id), kind: 'due_today', eventKey: String(r.contribution_id), vars });
					if (nud.inApp || nud.emailed) out.nudged++;
				}
			} catch (e) {
				out.errors.push(`contribution ${r.contribution_id}: ${e instanceof Error ? e.message : e}`);
			}
		}
	} catch (e) {
		out.errors.push(e instanceof Error ? e.message : String(e));
	}

	// ── Gentle late notices — past grace, still open, her eyes only, once ──────
	try {
		const lateRows = await db.execute({
			sql: `SELECT c.id AS contribution_id, c.member_id, c.contract_id,
			             c.expected_amount, ct.name AS contract_name, ct.currency
			      FROM contributions c
			      JOIN contracts ct ON ct.id = c.contract_id AND ct.tenant_id = c.tenant_id
			      WHERE c.status = 'pending'
			        AND ct.status = 'active'
			        AND c.due_date < CURRENT_DATE - ct.grace_days
			      ORDER BY c.due_date ASC
			      LIMIT 2000`,
			args: [],
		});
		for (const r of (lateRows.rows ?? []) as Record<string, any>[]) {
			try {
				const res = await notify({
					memberId: String(r.member_id),
					contractId: String(r.contract_id),
					kind: 'gentle_late',
					eventKey: String(r.contribution_id),
					vars: {
						contractName: String(r.contract_name ?? ''),
						amount: fmtAmount(r.expected_amount),
						currency: String(r.currency ?? 'USDC'),
					},
				});
				if (res.inApp || res.emailed) out.late++;
			} catch (e) {
				out.errors.push(`late ${r.contribution_id}: ${e instanceof Error ? e.message : e}`);
			}
		}
	} catch (e) {
		out.errors.push(e instanceof Error ? e.message : String(e));
	}

	return out;
}
