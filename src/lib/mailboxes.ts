/**
 * mailboxes.ts
 *
 * Config for the mailbox windows on /admin. Reads indexed env vars so the same code
 * runs on both products with nothing but Render env differing:
 *
 *   SusuFinance : admin@susufinance.com, afrikanus@susufinance.com
 *   Almstins    : donnie@almstins.com,   hello@almstins.com
 *
 * ── Env shape ────────────────────────────────────────────────────────────────
 *   MAIL_IMAP_HOST       mail.susufinance.com
 *   MAIL_IMAP_PORT       993            (optional, default 993 / TLS)
 *   MAIL_SMTP_HOST       mail.susufinance.com
 *   MAIL_SMTP_PORT       465            (optional, default 465 / TLS)
 *
 *   MAILBOX_1_ADDRESS    admin@susufinance.com
 *   MAILBOX_1_PASSWORD   ...
 *   MAILBOX_1_LABEL      Admin          (optional, defaults to the local part)
 *   MAILBOX_1_SEND       true           (optional, default true)
 *   MAILBOX_1_OWNER      donnie@...     (optional, comma list; empty = every admin)
 *
 *   MAILBOX_2_ADDRESS    afrikanus@susufinance.com
 *   MAILBOX_2_SEND       false          ← read-only until Afrikanus has agreed
 *   ...
 *
 * Each mailbox authenticates as itself. cPanel accounts cannot generally send as one
 * another, so there is no shared credential — one password per address. These are NOT
 * the same as EMAIL_SERVER, which stays reserved for system mail (magic links, alerts)
 * and must not be reused here.
 *
 * ── Why `send` is per-mailbox ────────────────────────────────────────────────
 * Reading someone's mail and sending as them are different capabilities. A compose
 * button on afrikanus@ can put words in his name in front of people who will read them
 * as his. That ships disabled and turns on with one env var once he has said yes.
 */

export interface Mailbox {
	/** Full address. Also the join key into mail_messages.mailbox. */
	address: string;
	/** Display name for the window header. */
	label: string;
	/** Password for both IMAP and SMTP. Never leaves the server. */
	password: string;
	/** False = window renders read-only, compose and reply hidden AND refused server-side. */
	canSend: boolean;
	/** Admin emails allowed to see this window. Empty = all admins. Lowercased. */
	owners: string[];
}

export interface MailServerConfig {
	imapHost: string;
	imapPort: number;
	smtpHost: string;
	smtpPort: number;
}

/** How many MAILBOX_n_* slots to look for. Raise if a product ever needs more. */
const MAX_MAILBOXES = 6;

const env = (key: string): string => (process.env[key] ?? '').trim();

/**
 * Truthy unless explicitly switched off. Absent means "yes" for send, because the
 * common case is a mailbox you own; the exception is the one you must opt into.
 */
const envBool = (key: string, fallback: boolean): boolean => {
	const raw = env(key).toLowerCase();
	if (!raw) return fallback;
	return raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off';
};

export function getMailServerConfig(): MailServerConfig | null {
	const imapHost = env('MAIL_IMAP_HOST');
	const smtpHost = env('MAIL_SMTP_HOST') || imapHost;
	if (!imapHost) return null;
	return {
		imapHost,
		imapPort: Number(env('MAIL_IMAP_PORT') || 993),
		smtpHost,
		smtpPort: Number(env('MAIL_SMTP_PORT') || 465),
	};
}

/**
 * Every configured mailbox, in env order. Slots may be sparse — a gap at 2 does not
 * stop 3 from loading, so removing a mailbox never means renumbering the rest.
 */
export function getMailboxes(): Mailbox[] {
	const boxes: Mailbox[] = [];
	for (let i = 1; i <= MAX_MAILBOXES; i++) {
		const address = env(`MAILBOX_${i}_ADDRESS`).toLowerCase();
		const password = env(`MAILBOX_${i}_PASSWORD`);
		if (!address || !password) continue;
		boxes.push({
			address,
			label: env(`MAILBOX_${i}_LABEL`) || address.split('@')[0],
			password,
			canSend: envBool(`MAILBOX_${i}_SEND`, true),
			owners: env(`MAILBOX_${i}_OWNER`)
				.split(',')
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean),
		});
	}
	return boxes;
}

/**
 * The mailboxes a given admin may see. An empty owners list means "any admin"; a
 * populated one restricts to those addresses.
 *
 * Today you are the only admin and this is a no-op. It exists now so that the day
 * Afrikanus gets a login to /admin, his window resolves to his mail and not yours,
 * without a schema change or a retrofit.
 */
export function getMailboxesForAdmin(adminEmail: string): Mailbox[] {
	const who = (adminEmail ?? '').trim().toLowerCase();
	return getMailboxes().filter((b) => b.owners.length === 0 || b.owners.includes(who));
}

/** Look up one mailbox an admin is allowed to touch. Null if absent or not theirs. */
export function findMailboxForAdmin(address: string, adminEmail: string): Mailbox | null {
	const want = (address ?? '').trim().toLowerCase();
	return getMailboxesForAdmin(adminEmail).find((b) => b.address === want) ?? null;
}

/** Config presence, for the admin page to explain itself when nothing is set up yet. */
export function mailConfigStatus(): { configured: boolean; reason: string } {
	if (!getMailServerConfig()) {
		return { configured: false, reason: 'MAIL_IMAP_HOST is not set.' };
	}
	if (getMailboxes().length === 0) {
		return { configured: false, reason: 'No MAILBOX_n_ADDRESS / MAILBOX_n_PASSWORD pairs are set.' };
	}
	return { configured: true, reason: '' };
}
