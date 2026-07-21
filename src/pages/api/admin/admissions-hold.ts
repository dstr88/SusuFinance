/**
 * POST /api/admin/admissions-hold  { held: boolean }
 *
 * Throws the admissions hold. While it is on, nobody can open a join request and a
 * person who signs up waits in the lobby; an operator can still create a circle and
 * place members himself.
 *
 * Guarded by requireAdminSession, and the admin's email is recorded against the
 * change. Lifting the hold is the single most consequential switch on the platform —
 * it is what lets strangers start becoming candidates — so it must never be possible
 * to look at an open door and not know who opened it.
 */

import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/adminGuard';
import { setAdmissionsHeld, getAdmissionsHold } from '@/lib/platformSettings';

export const prerender = false;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const POST: APIRoute = async ({ request }) => {
	let who;
	try {
		who = await requireAdminSession(request);
	} catch (resp) {
		return resp instanceof Response ? resp : json({ ok: false, error: 'Unauthorized' }, 401);
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, 400);
	}

	// Strict boolean. A missing or malformed field must not be read as "open it" —
	// this is the one setting where a coercion bug lets strangers in.
	if (typeof body.held !== 'boolean') {
		return json({ ok: false, error: 'held must be true or false' }, 400);
	}

	await setAdmissionsHeld(body.held, who.email);
	return json({ ok: true, ...(await getAdmissionsHold()) });
};
