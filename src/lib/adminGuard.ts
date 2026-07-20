import { getAuthSession } from './authSession';
import { db } from './db';

// Comma-separated list of admin emails (case-insensitive).
const ADMIN_EMAILS = new Set(
	(process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean),
);

// Comma-separated list of admin tenant IDs.
//
// CAUTION, two traps here:
//
//  1. A tenant is a GROUP. Granting by tenant grants EVERY member of that tenant,
//     which is rarely what is intended. Prefer ADMIN_USER_IDS below.
//  2. The tenant id is NOT what the account menu displays. That menu shows the
//     user's own UUID (auth_users.id — see the account dropdown in Layout.astro,
//     labelled "UUID"). An earlier version of this comment said otherwise and cost
//     a real debugging session. To find a tenant id you have to query the database;
//     to find a user id you just open the account menu and click copy.
const ADMIN_TENANT_IDS = new Set(
	(process.env.ADMIN_TENANT_IDS ?? process.env.ADMIN_TENANT_ID ?? '')
		.split(',')
		.map((id) => id.trim().toLowerCase())
		.filter(Boolean),
);

// Comma-separated list of admin USER ids (auth_users.id) — the preferred grant.
//
// Precise where the other two are not: an email can be withheld by the OAuth
// provider or change over time, and a tenant id covers everyone who belongs to
// that tenant. A user id names exactly one person, is always present in the
// session, and never widens on its own.
const ADMIN_USER_IDS = new Set(
	(process.env.ADMIN_USER_IDS ?? process.env.ADMIN_USER_ID ?? '')
		.split(',')
		.map((id) => id.trim().toLowerCase())
		.filter(Boolean),
);

function isAdminEmail(email: string): boolean {
	return Boolean(email && ADMIN_EMAILS.has(email.toLowerCase()));
}

function isAdminTenant(tenantId: string | null | undefined): boolean {
	return Boolean(tenantId && ADMIN_TENANT_IDS.has(tenantId.toLowerCase()));
}

export async function requireAdminSession(request: Request): Promise<{ userId: string; email: string }> {
	const session = await getAuthSession(request).catch(() => null);
	if (!session?.user?.id) {
		throw new Response('Unauthorized', { status: 401 });
	}

	// User id first — the most precise grant, and always present in the session.
	if (ADMIN_USER_IDS.has(String(session.user.id).toLowerCase())) {
		return { userId: session.user.id, email: session.user.email ?? '' };
	}

	// Then tenant ID — always in JWT, no email dependency, but grants the whole group.
	if (isAdminTenant(session.tenantId)) {
		const email = session.user.email ?? '';
		return { userId: session.user.id, email };
	}

	// Fallback: check email (from JWT or DB).
	const row = await db
		.execute({ sql: 'SELECT email FROM auth_users WHERE id = ? LIMIT 1', args: [session.user.id] })
		.then((r) => r.rows[0] as Record<string, unknown> | undefined)
		.catch(() => undefined);

	const email = String(row?.email ?? session.user.email ?? '').toLowerCase();

	if (!isAdminEmail(email)) {
		throw new Response('Forbidden', { status: 403 });
	}

	return { userId: session.user.id, email };
}

/** Returns true if the session belongs to an admin (tenant ID or email match). */
export async function isAdminSession(request: Request): Promise<boolean> {
	try {
		await requireAdminSession(request);
		return true;
	} catch {
		return false;
	}
}
