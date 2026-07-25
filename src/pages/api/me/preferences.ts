/**
 * GET  /api/me/preferences  — her notification preferences.
 * POST /api/me/preferences  — update them. Body: { reminders?, due_day_nudge?,
 *                             discreet?, email_opt_in? } (or nested under { prefs }).
 *
 * These live in members.notify_pref (JSONB). Only the four known booleans are ever
 * written, merged over what she already has. Scoped to her own member row.
 */
import type { APIRoute } from 'astro';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { db } from '@/lib/db';

export const prerender = false;

const KEYS = ['reminders', 'due_day_nudge', 'discreet', 'email_opt_in'] as const;
type PrefKey = typeof KEYS[number];
const DEFAULTS: Record<PrefKey, boolean> = {
	reminders: true, due_day_nudge: false, discreet: false, email_opt_in: false,
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}

function safeParse(s: string): Record<string, any> {
	try { return JSON.parse(s); } catch { return {}; }
}

function normalize(pref: Record<string, any>): Record<PrefKey, boolean> {
	const out = {} as Record<PrefKey, boolean>;
	for (const k of KEYS) out[k] = typeof pref?.[k] === 'boolean' ? pref[k] : DEFAULTS[k];
	return out;
}

async function currentMember(request: Request): Promise<{ id: string; email: string | null; pref: Record<string, any> } | null> {
	const session = await requireTenantSession(request);
	if (!session) return null;
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return null;
	const res = await db.execute({
		sql: `SELECT id, email, notify_pref FROM members WHERE user_id = ? LIMIT 1`,
		args: [userId],
	});
	const row = res.rows?.[0] as Record<string, any> | undefined;
	if (!row) return null;
	const pref = typeof row.notify_pref === 'string' ? safeParse(row.notify_pref) : (row.notify_pref ?? {});
	return { id: String(row.id), email: row.email ? String(row.email) : null, pref };
}

export const GET: APIRoute = async ({ request }) => {
	const m = await currentMember(request).catch(() => null);
	if (!m) return json({ ok: true, prefs: DEFAULTS, hasEmail: false });
	return json({ ok: true, prefs: normalize(m.pref), hasEmail: Boolean(m.email) });
};

export const POST: APIRoute = async ({ request }) => {
	const m = await currentMember(request).catch(() => null);
	if (!m) return json({ ok: false, error: 'unauthorized' }, 401);

	let bodyIn: any = {};
	try { bodyIn = await request.json(); } catch { /* empty body = no-op */ }
	const incoming = (bodyIn && typeof bodyIn.prefs === 'object' && bodyIn.prefs) ? bodyIn.prefs : bodyIn;

	const merged = normalize(m.pref);
	for (const k of KEYS) {
		if (typeof incoming?.[k] === 'boolean') merged[k] = incoming[k];
	}

	try {
		await db.execute({
			sql: `UPDATE members SET notify_pref = ?::jsonb, updated_at = now() WHERE id = ?`,
			args: [JSON.stringify(merged), m.id],
		});
		return json({ ok: true, prefs: merged });
	} catch (err) {
		console.error('[api/me/preferences] update failed', err);
		return json({ ok: false, error: 'update_failed' }, 500);
	}
};
